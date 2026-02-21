import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'
import { getAuthContext, unauthorized, cached, withCache } from '@/lib/api-helpers'
import { cacheKeys, cacheTTL, buildCacheHash } from '@/lib/redis'

// ─── Types ──────────────────────────────────────────────────────────

interface PayerInfo {
  cpf: string | null
  name: string | null
  email: string | null
  pixKey: string | null
  nameFromDescription: string | null
}

interface AdvboxTransaction {
  id: number
  type: string
  entry_type: string
  date_due: string
  date_payment: string | null
  amount: number
  description: string
  customer_name: string | null
  identification: string | null
  name: string | null
  category: string | null
  process_number: string | null
  responsible: string | null
  debit_bank: string | null
  credit_bank: string | null
}

interface AdvboxCustomer {
  id: number
  name: string
  identification: string
}

interface MatchReason {
  field: string
  weight: number
  matched: boolean
  details: string
}

interface ClientMappingData {
  advboxCustomerId: number
  advboxCustomerName: string | null
  advboxCustomerIdentification: string | null
}

interface CustomerLookup {
  byCpf: Map<string, AdvboxCustomer>
  byName: Map<string, AdvboxCustomer>
  all: AdvboxCustomer[]
}

// ─── In-memory cache (avoids rate limits on repeated calls) ─────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const customerCache = new Map<string, CacheEntry<CustomerLookup>>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCachedCustomers(tenantId: string): CustomerLookup | null {
  const entry = customerCache.get(tenantId)
  if (!entry || Date.now() > entry.expiresAt) return null
  return entry.data
}

function setCachedCustomers(tenantId: string, data: CustomerLookup) {
  customerCache.set(tenantId, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeDocument(doc: string): string {
  return doc.replace(/[^0-9]/g, '')
}

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Generic banking keywords to strip from description-extracted names
const BANKING_KEYWORDS = new Set([
  'PIX', 'RECEBIDO', 'ENVIADO', 'TED', 'DOC', 'TRANSFERENCIA', 'TRANSF',
  'DEPOSITO', 'DEP', 'PAGAMENTO', 'PAG', 'CREDITO', 'CRED', 'DEBITO',
  'DEB', 'BOLETO', 'FATURA', 'REC', 'ENV', 'LANCAMENTO',
])

/**
 * Extrai o nome do pagador a partir da descrição bancária.
 * Ex: "PIX RECEBIDO   GUILHERME SCHUCK DOS SANT" → "GUILHERME SCHUCK DOS SANT"
 */
function extractNameFromDescription(description: string): string | null {
  if (!description) return null

  const desc = description.replace(/\s+/g, ' ').trim()

  const patterns = [
    /^PIX\s+REC(?:EBIDO)?\s+(.+)/i,
    /^PIX\s+ENV(?:IADO)?\s+(.+)/i,
    /^PIX\s+(.+)/i,
    /^TED\s+(?:DE\s+)?(.+)/i,
    /^DOC\s+(?:DE\s+)?(.+)/i,
    /^TRANSF(?:ERENCIA)?\s+(?:DE\s+)?(.+)/i,
    /^DEP(?:OSITO)?\s+(?:DE\s+)?(.+)/i,
    /^CRED(?:ITO)?\s+(?:DE\s+)?(.+)/i,
  ]

  for (const pattern of patterns) {
    const match = desc.match(pattern)
    if (match?.[1]) {
      const candidate = match[1]
        .replace(/\s+\d{2}\/\d{2}\/\d{4}.*$/, '')
        .replace(/\s+\d{2}:\d{2}.*$/, '')
        .replace(/[-*\s]+$/, '')
        .trim()

      if (candidate.length >= 4 && !/^\d+$/.test(candidate)) {
        const words = candidate.split(' ').filter(w => /[A-Za-zÀ-ÿ]{2,}/.test(w))
        if (words.length >= 1) return candidate
      }
    }
  }
  return null
}

function extractPayerInfo(paymentData: any, description?: string): PayerInfo {
  const info: PayerInfo = { cpf: null, name: null, email: null, pixKey: null, nameFromDescription: null }

  if (description) {
    info.nameFromDescription = extractNameFromDescription(description)
  }

  if (!paymentData) return info

  const payer = paymentData.payer ?? paymentData.sender ?? paymentData

  // CPF / CNPJ
  const rawDoc = payer?.documentNumber?.value ?? payer?.document ?? null
  if (rawDoc) {
    const cleaned = normalizeDocument(String(rawDoc))
    if (cleaned.length >= 11) info.cpf = cleaned
  }

  // Name — guard against string "null"
  const rawName = payer?.name
  if (rawName && String(rawName).toLowerCase() !== 'null' && String(rawName).trim().length >= 2) {
    info.name = String(rawName).trim()
  }

  // Email
  if (payer?.email) info.email = String(payer.email).toLowerCase()

  // PIX key
  const pixKey = paymentData.pixKey ?? payer?.pixKey ?? paymentData.payerKey ?? null
  if (pixKey) {
    info.pixKey = String(pixKey)
    const cleaned = normalizeDocument(info.pixKey)
    if (!info.cpf && (cleaned.length === 11 || cleaned.length === 14)) info.cpf = cleaned
    if (!info.email && info.pixKey.includes('@')) info.email = info.pixKey.toLowerCase()
  }

  return info
}

function getBestPayerName(info: PayerInfo): string | null {
  return info.name ?? info.nameFromDescription
}

function fuzzyNameMatch(nameA: string, nameB: string): number {
  const a = normalizeName(nameA)
  const b = normalizeName(nameB)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85

  const partsA = a.split(' ').filter(p => p.length > 1 && !BANKING_KEYWORDS.has(p))
  const partsB = b.split(' ').filter(p => p.length > 1 && !BANKING_KEYWORDS.has(p))

  if (partsA.length === 0 || partsB.length === 0) return 0

  if (partsA.length === 1 || partsB.length === 1) {
    const single = partsA.length === 1 ? partsA[0] : partsB[0]
    const multi  = partsA.length === 1 ? partsB : partsA
    return multi.includes(single) ? 0.45 : 0
  }

  const shorter = partsA.length <= partsB.length ? partsA : partsB
  const longer  = partsA.length >  partsB.length ? partsA : partsB
  const matched = shorter.filter(p => longer.includes(p))

  if (matched.length === 0) return 0
  return matched.length / Math.max(shorter.length, longer.length)
}

// ─── Advbox fetch helpers ───────────────────────────────────────────

async function fetchAllAdvboxCustomers(
  config: { apiKey: string; baseUrl: string }
): Promise<CustomerLookup> {
  const byCpf = new Map<string, AdvboxCustomer>()
  const byName = new Map<string, AdvboxCustomer>()
  const all: AdvboxCustomer[] = []
  const seenIds = new Set<number>()

  const addCustomer = (c: any) => {
    if (!c?.id || seenIds.has(Number(c.id))) return
    seenIds.add(Number(c.id))
    const customer: AdvboxCustomer = {
      id: Number(c.id),
      name: String(c.name ?? '').trim(),
      identification: normalizeDocument(String(c.identification ?? '')),
    }
    all.push(customer)
    if (customer.identification.length >= 11) byCpf.set(customer.identification, customer)
    const normalized = normalizeName(customer.name)
    if (normalized) byName.set(normalized, customer)
  }

  // Paginate through all customers
  let offset = 0
  const limit = 100
  let hasMore = true
  let totalFetched = 0

  while (hasMore) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    const res = await fetch(`${config.baseUrl}/customers?${q}`, {
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      console.log(`[RECON] Customers fetch failed at offset=${offset}: ${res.status}`)
      break
    }

    const data = await res.json()
    const results: any[] = data.data ?? data ?? []
    for (const c of results) addCustomer(c)
    totalFetched += results.length
    hasMore = results.length === limit
    offset += limit
  }

  console.log(`[RECON] Fetched ${totalFetched} Advbox customers → ${all.length} unique`)
  return { byCpf, byName, all }
}

async function fetchAdvboxTransactions(
  config: { apiKey: string; baseUrl: string },
  params: URLSearchParams
): Promise<AdvboxTransaction[]> {
  const all: AdvboxTransaction[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const query = new URLSearchParams(params)
    query.set('limit', String(limit))
    query.set('offset', String(offset))

    const url = `${config.baseUrl}/transactions?${query.toString()}`
    const res = await fetch(url, { headers: advboxHeaders(config.apiKey) })
    if (!res.ok) {
      console.error(`[RECON] Transactions fetch failed: ${res.status}`)
      break
    }

    const data = await res.json()
    const items: AdvboxTransaction[] = data.data ?? []
    all.push(...items)
    hasMore = items.length === limit
    offset += limit
  }

  return all
}

// ─── Customer matching ──────────────────────────────────────────────

function findCustomerForPayer(info: PayerInfo, lookup: CustomerLookup): AdvboxCustomer | null {
  // 1. By CPF (strongest)
  if (info.cpf && info.cpf.length >= 11) {
    const c = lookup.byCpf.get(info.cpf)
    if (c) return c
  }

  const payerName = getBestPayerName(info)
  if (!payerName) return null

  // 2. Exact normalized name
  const norm = normalizeName(payerName)
  const exact = lookup.byName.get(norm)
  if (exact) return exact

  // 3. Fuzzy match
  let best: AdvboxCustomer | null = null
  let bestSim = 0
  for (const customer of lookup.all) {
    const sim = fuzzyNameMatch(payerName, customer.name)
    if (sim > bestSim && sim >= 0.6) {
      bestSim = sim
      best = customer
    }
  }
  return best
}

// ─── Scoring ────────────────────────────────────────────────────────

interface MatchWeightsConfig {
  identity: number
  name: number
  contact: number
  amount: number
}

interface ConfidenceThresholdsConfig {
  high: number
  medium: number
}

const DEFAULT_WEIGHTS: MatchWeightsConfig = { identity: 40, name: 25, contact: 15, amount: 20 }
const DEFAULT_THRESHOLDS: ConfidenceThresholdsConfig = { high: 60, medium: 35 }

function computeMatch(
  payerInfo: PayerInfo,
  pluggyAmount: number,
  advTx: AdvboxTransaction,
  advboxCustomer: AdvboxCustomer | null,
  mapping: ClientMappingData | null,
  weights: MatchWeightsConfig = DEFAULT_WEIGHTS
): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = []
  let totalScore = 0

  const txCustomerName = advTx.customer_name ?? advTx.name ?? ''
  const txIdentification = advTx.identification ? normalizeDocument(advTx.identification) : ''
  const payerName = getBestPayerName(payerInfo)

  // ── 1. Identidade / CPF ───────────────────────────────────────────
  let identityMatched = false
  let identityField = 'CPF'
  let identityDetails = ''

  if (payerInfo.cpf && txIdentification && txIdentification.length >= 11) {
    identityMatched = payerInfo.cpf === txIdentification
    if (identityMatched) {
      identityDetails = `CPF direto corresponde: ***${payerInfo.cpf.slice(-4)}`
    }
  }

  if (!identityMatched && advboxCustomer) {
    const custNorm = normalizeName(advboxCustomer.name)
    const txNorm = normalizeName(txCustomerName)
    const cpfMatch = advboxCustomer.identification.length >= 11
      && txIdentification.length >= 11
      && advboxCustomer.identification === txIdentification
    const nameMatch = custNorm.length > 0 && txNorm.length > 0
      && (custNorm === txNorm || fuzzyNameMatch(advboxCustomer.name, txCustomerName) >= 0.7)

    if (cpfMatch || nameMatch) {
      identityMatched = true
      identityDetails = cpfMatch
        ? `Cliente encontrado por CPF: ${advboxCustomer.name}`
        : `Cliente encontrado por nome: ${advboxCustomer.name}`
    }
  }

  if (!identityMatched && mapping) {
    identityField = 'Vínculo'
    const mapCpf = mapping.advboxCustomerIdentification
      ? normalizeDocument(mapping.advboxCustomerIdentification) : ''
    const mapName = normalizeName(mapping.advboxCustomerName ?? '')
    const txNorm = normalizeName(txCustomerName)

    if (mapCpf.length >= 11 && txIdentification.length >= 11) {
      identityMatched = mapCpf === txIdentification
    } else if (mapName && txNorm) {
      identityMatched = mapName === txNorm
    }
    identityDetails = identityMatched
      ? `Cliente vinculado: ${mapping.advboxCustomerName}`
      : 'Vínculo não corresponde a esta transação'
  }

  if (!identityDetails) {
    identityDetails = payerInfo.cpf
      ? `CPF ***${payerInfo.cpf.slice(-4)} não encontrado nesta transação`
      : 'CPF/identidade não disponível'
  }

  reasons.push({ field: identityField, weight: weights.identity, matched: identityMatched, details: identityDetails })
  if (identityMatched) totalScore += weights.identity

  // ── 2. Nome ───────────────────────────────────────────────────────
  if (payerName && txCustomerName) {
    const similarity = fuzzyNameMatch(payerName, txCustomerName)
    const matched = similarity >= 0.4
    const earned = Math.round(similarity * weights.name)
    const source = payerInfo.name ? 'PIX/Banco' : 'descrição'
    reasons.push({
      field: 'Nome',
      weight: weights.name,
      matched,
      details: matched
        ? `Nome similar via ${source} (${Math.round(similarity * 100)}%): "${payerName}" ≈ "${txCustomerName}"`
        : `Nomes diferentes: "${payerName}" ≠ "${txCustomerName}"`,
    })
    totalScore += earned
  } else {
    reasons.push({
      field: 'Nome',
      weight: weights.name,
      matched: false,
      details: !payerName
        ? 'Nome do pagador não disponível'
        : 'Nome do cliente não disponível no lançamento Advbox',
    })
  }

  // ── 3. Contato / PIX ─────────────────────────────────────────────
  const contactDetails: string[] = []
  let contactScore = 0
  const emailPortion = Math.ceil(weights.contact * 0.53)
  const pixPortion = weights.contact - emailPortion
  if (payerInfo.email) { contactDetails.push(`email: ${payerInfo.email}`); contactScore += emailPortion }
  if (payerInfo.pixKey) { contactDetails.push(`PIX: ${payerInfo.pixKey}`); contactScore += pixPortion }

  const contactMatched = contactScore > 0
  reasons.push({
    field: 'Contato/PIX',
    weight: weights.contact,
    matched: contactMatched,
    details: contactMatched
      ? `Dados disponíveis: ${contactDetails.join(', ')}`
      : 'Sem email ou chave PIX',
  })
  if (contactMatched) totalScore += Math.min(contactScore, weights.contact)

  // ── 4. Valor ──────────────────────────────────────────────────────
  const absPluggy = Math.abs(pluggyAmount)
  const absAdvbox = Math.abs(advTx.amount)
  if (absPluggy > 0 && absAdvbox > 0) {
    const diff = Math.abs(absPluggy - absAdvbox)
    const tolerance = Math.max(absPluggy, absAdvbox) * 0.02
    const matched = diff <= tolerance
    reasons.push({
      field: 'Valor',
      weight: weights.amount,
      matched,
      details: matched
        ? `Valores correspondem: R$ ${absPluggy.toFixed(2)} ≈ R$ ${absAdvbox.toFixed(2)}`
        : `Valores diferentes: R$ ${absPluggy.toFixed(2)} ≠ R$ ${absAdvbox.toFixed(2)}`,
    })
    if (matched) totalScore += weights.amount
  }

  return { score: totalScore, reasons }
}

function getConfidence(score: number, thresholds: ConfidenceThresholdsConfig = DEFAULT_THRESHOLDS): 'high' | 'medium' | 'low' {
  if (score >= thresholds.high) return 'high'
  if (score >= thresholds.medium) return 'medium'
  return 'low'
}

// ─── Main handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const config = await getAdvboxConfig(ctx.userId)
    if (!config) return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })

    const { searchParams } = req.nextUrl
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const entryType = searchParams.get('entryType') ?? 'income'
    const tenantId = ctx.tenantId

    const hash = buildCacheHash({ from, to, entryType })
    const key = cacheKeys.reconciliation(tenantId, hash)
    const cachedResult = await import('@/lib/redis').then(m => m.getCached(key))
    if (cachedResult) {
      return cached(cachedResult, cacheTTL.reconciliation, true)
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    })
    const matchWeights: MatchWeightsConfig = {
      identity: tenantSettings?.matchWeightCpf ?? DEFAULT_WEIGHTS.identity,
      name: tenantSettings?.matchWeightName ?? DEFAULT_WEIGHTS.name,
      contact: tenantSettings?.matchWeightEmail ?? DEFAULT_WEIGHTS.contact,
      amount: tenantSettings?.matchWeightAmount ?? DEFAULT_WEIGHTS.amount,
    }
    const confidenceThresholds: ConfidenceThresholdsConfig = {
      high: tenantSettings?.confidenceHigh ?? DEFAULT_THRESHOLDS.high,
      medium: tenantSettings?.confidenceMedium ?? DEFAULT_THRESHOLDS.medium,
    }

    // ── 1. Pluggy transactions ──────────────────────────────────────
    const pluggyWhere: any = { tenantId }
    if (from || to) {
      pluggyWhere.date = {}
      if (from) pluggyWhere.date.gte = new Date(from)
      if (to) pluggyWhere.date.lte = new Date(to + 'T23:59:59')
    }
    if (entryType === 'income') pluggyWhere.type = 'CREDIT'
    else if (entryType === 'expense') pluggyWhere.type = 'DEBIT'

    const pluggyTransactions = await prisma.pluggyTransaction.findMany({
      where: pluggyWhere,
      include: {
        pluggyAccount: { select: { name: true, customName: true, accountId: true } },
        reconciliationRecord: true,
      },
      orderBy: { date: 'desc' },
      take: 500,
    })

    console.log(`[RECON] Pluggy txs: ${pluggyTransactions.length} (entryType=${entryType})`)

    // ── 2. Extract payer info ───────────────────────────────────────
    const payerInfoMap = new Map<string, PayerInfo>()
    for (const ptx of pluggyTransactions) {
      payerInfoMap.set(ptx.id, extractPayerInfo(ptx.paymentData, ptx.description))
    }

    const withCpf = [...payerInfoMap.values()].filter(i => i.cpf).length
    const withName = [...payerInfoMap.values()].filter(i => i.name || i.nameFromDescription).length
    console.log(`[RECON] PayerInfo: total=${pluggyTransactions.length} withCpf=${withCpf} withName=${withName}`)

    // ── 3. Fetch ALL Advbox customers ONCE (cached) ────────────────
    let customerLookup = getCachedCustomers(tenantId)
    if (!customerLookup) {
      customerLookup = await fetchAllAdvboxCustomers(config)
      setCachedCustomers(tenantId, customerLookup)
    } else {
      console.log(`[RECON] Using cached customers: ${customerLookup.all.length}`)
    }

    // ── 4. Fetch Advbox transactions ────────────────────────────────
    const advboxParams = new URLSearchParams()
    // Broader date range: 90 days before 'from' to catch overdue bills
    if (from) {
      const d = new Date(from)
      d.setDate(d.getDate() - 90)
      advboxParams.set('date_due_start', d.toISOString().split('T')[0])
    }
    if (to) {
      const d = new Date(to)
      d.setDate(d.getDate() + 30)
      advboxParams.set('date_due_end', d.toISOString().split('T')[0])
    }

    const advboxTransactions = await fetchAdvboxTransactions(config, advboxParams)
    console.log(`[RECON] Advbox raw txs: ${advboxTransactions.length}`)

    // Log first 3 to debug type field
    for (let j = 0; j < Math.min(3, advboxTransactions.length); j++) {
      const atx = advboxTransactions[j]
      console.log(`[RECON] Advbox TX id=${atx.id} type="${atx.type}" entry_type="${atx.entry_type}" paid="${atx.date_payment}" customer="${atx.customer_name ?? atx.name}" identification="${atx.identification}" amt=${atx.amount}`)
    }

    // Filter by entry type (accept multiple possible values from Advbox)
    const filteredByType = advboxTransactions.filter((tx) => {
      const t = ((tx.type ?? tx.entry_type) ?? '').toLowerCase()
      if (entryType === 'income') return t === 'income' || t === 'revenue' || t === 'receita' || t === 'credito'
      if (entryType === 'expense') return t === 'expense' || t === 'despesa' || t === 'debito'
      return true
    })

    // Prefer unpaid transactions; if none found, include all (paid too)
    const unpaid = filteredByType.filter(tx => !tx.date_payment)
    const advboxForMatching = unpaid.length > 0 ? unpaid : filteredByType
    console.log(`[RECON] Advbox for matching: ${advboxForMatching.length} (typeFiltered=${filteredByType.length} unpaid=${unpaid.length})`)

    // ── 5. Stored client mappings ───────────────────────────────────
    const mappings = await prisma.clientMapping.findMany({ where: { tenantId } })
    const mappingByCpf = new Map(mappings.map(m => [m.payerCpf, m]))

    // ── 6. Match ────────────────────────────────────────────────────
    const usedAdvboxIds = new Set<number>()
    const items: any[] = []

    for (const ptx of pluggyTransactions) {
      const payerInfo = payerInfoMap.get(ptx.id)!

      if (ptx.reconciliationRecord?.status === 'paid') {
        items.push({
          pluggyTransaction: formatPluggyTx(ptx, payerInfo),
          matchStatus: 'reconciled',
          bestMatch: null,
          linkedCustomer: null,
          advboxCustomerFound: null,
          reconciliationId: ptx.reconciliationRecord.id,
          advboxTransactionId: ptx.reconciliationRecord.advboxTransactionId,
          paidAt: ptx.reconciliationRecord.paidAt,
        })
        continue
      }

      const advboxCustomer = findCustomerForPayer(payerInfo, customerLookup)
      const mapping = payerInfo.cpf ? mappingByCpf.get(payerInfo.cpf) : null
      const mappingData: ClientMappingData | null = mapping
        ? { advboxCustomerId: mapping.advboxCustomerId, advboxCustomerName: mapping.advboxCustomerName, advboxCustomerIdentification: mapping.advboxCustomerIdentification }
        : null

      let bestMatch: any = null
      let bestScore = 0

      for (const atx of advboxForMatching) {
        if (usedAdvboxIds.has(atx.id)) continue
        const { score, reasons } = computeMatch(payerInfo, ptx.amount, atx, advboxCustomer, mappingData, matchWeights)
        if (score > bestScore) {
          bestScore = score
          bestMatch = { advboxTransaction: atx, score, confidence: getConfidence(score, confidenceThresholds), matchReasons: reasons }
        }
      }

      const hasCustomerSignal = !!advboxCustomer || !!mapping
      const matchStatus: 'auto' | 'partial' | 'none' =
        bestScore >= confidenceThresholds.high ? 'auto'
        : (bestScore >= confidenceThresholds.medium || hasCustomerSignal) ? 'partial'
        : 'none'

      if (bestMatch && matchStatus !== 'none') {
        usedAdvboxIds.add(bestMatch.advboxTransaction.id)
      } else if (matchStatus === 'none') {
        // Keep bestMatch as null for "none" — no reliable transaction candidate
        bestMatch = null
      }
      // For 'partial' with hasCustomerSignal but score=0, keep bestMatch if it exists (even low score)

      items.push({
        pluggyTransaction: formatPluggyTx(ptx, payerInfo),
        matchStatus,
        bestMatch,
        linkedCustomer: mapping
          ? { id: mapping.advboxCustomerId, name: mapping.advboxCustomerName, identification: mapping.advboxCustomerIdentification }
          : null,
        advboxCustomerFound: advboxCustomer
          ? { id: advboxCustomer.id, name: advboxCustomer.name, identification: advboxCustomer.identification }
          : null,
        reconciliationId: null,
        advboxTransactionId: null,
        paidAt: null,
      })
    }

    const statusOrder: Record<string, number> = { none: 0, partial: 1, auto: 2, reconciled: 3 }
    items.sort((a, b) => {
      const d = (statusOrder[a.matchStatus] ?? 0) - (statusOrder[b.matchStatus] ?? 0)
      return d !== 0 ? d : (b.bestMatch?.score ?? 0) - (a.bestMatch?.score ?? 0)
    })

    const none = items.filter(i => i.matchStatus === 'none').length
    const partial = items.filter(i => i.matchStatus === 'partial').length
    const auto = items.filter(i => i.matchStatus === 'auto').length
    const reconciled = items.filter(i => i.matchStatus === 'reconciled').length
    console.log(`[RECON] Result: none=${none} partial=${partial} auto=${auto} reconciled=${reconciled}`)

    const result = {
      items,
      summary: {
        totalPluggy: pluggyTransactions.length,
        totalAdvbox: advboxForMatching.length,
        none, partial, auto, reconciled,
        autoMatchAmount: items
          .filter(i => i.matchStatus === 'auto' && i.bestMatch)
          .reduce((sum, i) => sum + Math.abs(i.pluggyTransaction.amount), 0),
      },
    }

    const { setCached: setCache } = await import('@/lib/redis')
    await setCache(key, result, cacheTTL.reconciliation)

    return cached(result, cacheTTL.reconciliation, false)
  } catch (error: any) {
    console.error('GET /api/reconciliation error:', error)
    return NextResponse.json({ error: 'Erro ao processar conciliação' }, { status: 500 })
  }
}

function formatPluggyTx(ptx: any, payerInfo: PayerInfo) {
  return {
    id: ptx.id,
    transactionId: ptx.transactionId,
    description: ptx.description,
    descriptionRaw: ptx.descriptionRaw,
    amount: ptx.amount,
    date: ptx.date instanceof Date ? ptx.date.toISOString() : ptx.date,
    type: ptx.type,
    category: ptx.category,
    accountName: ptx.pluggyAccount?.customName ?? ptx.pluggyAccount?.name ?? null,
    payerInfo,
  }
}

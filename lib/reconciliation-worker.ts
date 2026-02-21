import { prisma } from '@/lib/prisma'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'
import { setCached, cacheKeys, cacheTTL, buildCacheHash, getCached } from '@/lib/redis'
import { publishEvent } from '@/lib/sse'

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

const BANKING_KEYWORDS = new Set([
  'PIX', 'RECEBIDO', 'ENVIADO', 'TED', 'DOC', 'TRANSFERENCIA', 'TRANSF',
  'DEPOSITO', 'DEP', 'PAGAMENTO', 'PAG', 'CREDITO', 'CRED', 'DEBITO',
  'DEB', 'BOLETO', 'FATURA', 'REC', 'ENV', 'LANCAMENTO',
])

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
  if (description) info.nameFromDescription = extractNameFromDescription(description)
  if (!paymentData) return info
  const payer = paymentData.payer ?? paymentData.sender ?? paymentData
  const rawDoc = payer?.documentNumber?.value ?? payer?.document ?? null
  if (rawDoc) {
    const cleaned = normalizeDocument(String(rawDoc))
    if (cleaned.length >= 11) info.cpf = cleaned
  }
  const rawName = payer?.name
  if (rawName && String(rawName).toLowerCase() !== 'null' && String(rawName).trim().length >= 2) {
    info.name = String(rawName).trim()
  }
  if (payer?.email) info.email = String(payer.email).toLowerCase()
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
    const multi = partsA.length === 1 ? partsB : partsA
    return multi.includes(single) ? 0.45 : 0
  }
  const shorter = partsA.length <= partsB.length ? partsA : partsB
  const longer = partsA.length > partsB.length ? partsA : partsB
  const matched = shorter.filter(p => longer.includes(p))
  if (matched.length === 0) return 0
  return matched.length / Math.max(shorter.length, longer.length)
}

async function fetchAllAdvboxCustomers(
  config: { apiKey: string; baseUrl: string },
  tenantId: string
): Promise<CustomerLookup> {
  const customerCacheKey = cacheKeys.customers(tenantId)
  const cachedCustomers = await getCached<{ all: Array<{ id: number; name: string; identification: string }> }>(customerCacheKey)

  if (cachedCustomers) {
    const byCpf = new Map<string, AdvboxCustomer>()
    const byName = new Map<string, AdvboxCustomer>()
    for (const c of cachedCustomers.all) {
      if (c.identification?.length >= 11) byCpf.set(c.identification, c)
      const norm = normalizeName(c.name)
      if (norm) byName.set(norm, c)
    }
    return { byCpf, byName, all: cachedCustomers.all }
  }

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

  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    const res = await fetch(`${config.baseUrl}/customers?${q}`, {
      headers: advboxHeaders(config.apiKey),
    })
    if (!res.ok) break
    const data = await res.json()
    const results: any[] = data.data ?? data ?? []
    for (const c of results) addCustomer(c)
    hasMore = results.length === limit
    offset += limit
  }

  await setCached(customerCacheKey, { all }, cacheTTL.customers)
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
    if (!res.ok) break
    const data = await res.json()
    const items: AdvboxTransaction[] = data.data ?? []
    all.push(...items)
    hasMore = items.length === limit
    offset += limit
  }
  return all
}

function findCustomerForPayer(info: PayerInfo, lookup: CustomerLookup): AdvboxCustomer | null {
  if (info.cpf && info.cpf.length >= 11) {
    const c = lookup.byCpf.get(info.cpf)
    if (c) return c
  }
  const payerName = getBestPayerName(info)
  if (!payerName) return null
  const norm = normalizeName(payerName)
  const exact = lookup.byName.get(norm)
  if (exact) return exact
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

  let identityMatched = false
  let identityField = 'CPF'
  let identityDetails = ''

  if (payerInfo.cpf && txIdentification && txIdentification.length >= 11) {
    identityMatched = payerInfo.cpf === txIdentification
    if (identityMatched) identityDetails = `CPF direto corresponde: ***${payerInfo.cpf.slice(-4)}`
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

  if (payerName && txCustomerName) {
    const similarity = fuzzyNameMatch(payerName, txCustomerName)
    const matched = similarity >= 0.4
    const earned = Math.round(similarity * weights.name)
    const source = payerInfo.name ? 'PIX/Banco' : 'descrição'
    reasons.push({
      field: 'Nome', weight: weights.name, matched,
      details: matched
        ? `Nome similar via ${source} (${Math.round(similarity * 100)}%): "${payerName}" ≈ "${txCustomerName}"`
        : `Nomes diferentes: "${payerName}" ≠ "${txCustomerName}"`,
    })
    totalScore += earned
  } else {
    reasons.push({
      field: 'Nome', weight: weights.name, matched: false,
      details: !payerName ? 'Nome do pagador não disponível' : 'Nome do cliente não disponível no lançamento Advbox',
    })
  }

  const contactDetails: string[] = []
  let contactScore = 0
  const emailPortion = Math.ceil(weights.contact * 0.53)
  const pixPortion = weights.contact - emailPortion
  if (payerInfo.email) { contactDetails.push(`email: ${payerInfo.email}`); contactScore += emailPortion }
  if (payerInfo.pixKey) { contactDetails.push(`PIX: ${payerInfo.pixKey}`); contactScore += pixPortion }
  const contactMatched = contactScore > 0
  reasons.push({
    field: 'Contato/PIX', weight: weights.contact, matched: contactMatched,
    details: contactMatched ? `Dados disponíveis: ${contactDetails.join(', ')}` : 'Sem email ou chave PIX',
  })
  if (contactMatched) totalScore += Math.min(contactScore, weights.contact)

  const absPluggy = Math.abs(pluggyAmount)
  const absAdvbox = Math.abs(advTx.amount)
  if (absPluggy > 0 && absAdvbox > 0) {
    const diff = Math.abs(absPluggy - absAdvbox)
    const tolerance = Math.max(absPluggy, absAdvbox) * 0.02
    const matched = diff <= tolerance
    reasons.push({
      field: 'Valor', weight: weights.amount, matched,
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

/**
 * Pre-compute reconciliation matches for a tenant and store results in Redis.
 * Called after sync/webhook events to have data ready for instant reads.
 */
export async function precomputeReconciliation(
  tenantId: string,
  userId: string,
  params: { from?: string; to?: string; entryType?: string }
): Promise<void> {
  const entryType = params.entryType ?? 'income'

  try {
    const config = await getAdvboxConfig(userId)
    if (!config) return

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

    const pluggyWhere: any = { tenantId }
    if (params.from || params.to) {
      pluggyWhere.date = {}
      if (params.from) pluggyWhere.date.gte = new Date(params.from)
      if (params.to) pluggyWhere.date.lte = new Date(params.to + 'T23:59:59')
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

    const payerInfoMap = new Map<string, PayerInfo>()
    for (const ptx of pluggyTransactions) {
      payerInfoMap.set(ptx.id, extractPayerInfo(ptx.paymentData, ptx.description))
    }

    const customerLookup = await fetchAllAdvboxCustomers(config, tenantId)

    const advboxParams = new URLSearchParams()
    if (params.from) {
      const d = new Date(params.from)
      d.setDate(d.getDate() - 90)
      advboxParams.set('date_due_start', d.toISOString().split('T')[0])
    }
    if (params.to) {
      const d = new Date(params.to)
      d.setDate(d.getDate() + 30)
      advboxParams.set('date_due_end', d.toISOString().split('T')[0])
    }

    const advboxTransactions = await fetchAdvboxTransactions(config, advboxParams)

    const filteredByType = advboxTransactions.filter((tx) => {
      const t = ((tx.type ?? tx.entry_type) ?? '').toLowerCase()
      if (entryType === 'income') return t === 'income' || t === 'revenue' || t === 'receita' || t === 'credito'
      if (entryType === 'expense') return t === 'expense' || t === 'despesa' || t === 'debito'
      return true
    })

    const unpaid = filteredByType.filter(tx => !tx.date_payment)
    const advboxForMatching = unpaid.length > 0 ? unpaid : filteredByType

    const mappings = await prisma.clientMapping.findMany({ where: { tenantId } })
    const mappingByCpf = new Map(mappings.map(m => [m.payerCpf, m]))

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
        bestMatch = null
      }

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

    const hash = buildCacheHash({ from: params.from, to: params.to, entryType })
    const key = cacheKeys.reconciliation(tenantId, hash)
    await setCached(key, result, cacheTTL.reconciliation * 10)

    publishEvent(tenantId, { type: 'reconciliation_ready', entryType })
    console.log(`[WORKER] Precomputed reconciliation for tenant ${tenantId}: ${items.length} items`)
  } catch (err) {
    console.error(`[WORKER] Precompute reconciliation failed for tenant ${tenantId}:`, err)
  }
}

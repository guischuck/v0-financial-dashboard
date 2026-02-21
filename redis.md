# Infraestrutura de Cache, Banco de Dados e Performance

## Visão Geral da Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌────────────┐
│  Frontend    │────▶│  Next.js API │────▶│  Redis (Upstash)  │     │ PostgreSQL │
│  React Query │◀───│  Routes      │────▶│  Cache Distribuído│     │ + Prisma   │
│  + SSE       │     │  + Middleware│     └──────────────────┘     └────────────┘
└─────────────┘     └──────────────┘              │
       ▲                    │                     │ Rate Limiting
       │                    ▼                     │ Cache-aside
       │              ┌────────────┐              │
       └──────────────│ SSE Events │◀─────────────┘
                      │ /api/events│
                      └────────────┘
```

---

## 1. Redis (Upstash)

### Status: OPCIONAL (graceful degradation)

O sistema funciona **com ou sem Redis**. Quando configurado, ativa cache distribuído e rate limiting. Sem ele, todas as requisições vão direto ao banco.

### Variáveis de Ambiente

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxx
```

### Pacotes Utilizados

- `@upstash/redis` — Client REST para Redis (compatível com Edge e Serverless)
- `@upstash/ratelimit` — Rate limiting distribuído via Redis

### Arquivo Principal: `lib/redis.ts`

O Redis é inicializado via **lazy-loading** — só cria a conexão quando realmente necessário e quando as env vars existem. Se não configurado, todas as funções retornam `null`/`void` sem erro.

### Funções Disponíveis

| Função | Descrição |
|---|---|
| `getCached<T>(key)` | Busca valor no Redis. Retorna `null` se não existe ou Redis indisponível |
| `setCached<T>(key, data, ttl)` | Armazena valor com TTL em segundos |
| `invalidateCache(...keys)` | Remove chaves específicas |
| `invalidatePattern(pattern)` | Remove todas as chaves que correspondem ao padrão (ex: `tenant:abc:*`) |
| `getRateLimiter()` | Retorna instância do rate limiter ou `null` |
| `buildCacheHash(params)` | Gera hash determinístico de query params para chaves de cache |

### Chaves de Cache (tenant-scoped)

Todas as chaves seguem o padrão `tenant:{tenantId}:{recurso}`:

| Recurso | Padrão da Chave | TTL |
|---|---|---|
| Settings | `tenant:{id}:settings` | 5 min (300s) |
| Contas Pluggy | `tenant:{id}:accounts` | 2 min (120s) |
| Transações | `tenant:{id}:txns:{hash}` | 1 min (60s) |
| Clientes Advbox | `tenant:{id}:customers` | 10 min (600s) |
| Conciliação | `tenant:{id}:recon:{hash}` | 30 seg |
| KPIs | `tenant:{id}:kpis:{month}` | 2 min (120s) |
| Invalidar tudo | `tenant:{id}:*` | — |

O `{hash}` é gerado por `buildCacheHash()` a partir dos query params (filtros de data, paginação, etc), garantindo que cada combinação de filtros tenha sua própria entrada no cache.

### Rate Limiting

- **Algoritmo**: Sliding Window (60 requisições por minuto por usuário)
- **Escopo**: Todas as rotas `/api/*` autenticadas
- **Identificador**: `userId` do Clerk
- **Resposta ao exceder**: HTTP 429 com headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- **Implementação**: `middleware.ts` (global) + `lib/rate-limit-middleware.ts` (por rota)

---

## 2. Banco de Dados — PostgreSQL + Prisma

### Status: ATIVO

### Variáveis de Ambiente

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Arquivo Principal: `lib/prisma.ts`

- Usa `@prisma/adapter-pg` com `pg.Pool` para conexão direta ao PostgreSQL
- Singleton global em desenvolvimento (evita múltiplas conexões com hot reload)
- Logs: `error` + `warn` em development, apenas `error` em production

### Schema: `prisma/schema.prisma`

**Modelos principais:**

| Modelo | Tabela | Descrição |
|---|---|---|
| `Tenant` | `tenants` | Escritório/organização |
| `TenantSettings` | `tenant_settings` | Configurações do tenant (chaves API, pesos de match, preferências) |
| `TenantUser` | `tenant_users` | Usuários vinculados ao tenant |
| `PluggyItem` | `pluggy_items` | Conexões bancárias Pluggy |
| `PluggyAccount` | `pluggy_accounts` | Contas bancárias sincronizadas |
| `PluggyTransaction` | `pluggy_transactions` | Transações bancárias |
| `ReconciliationRecord` | `reconciliation_records` | Registros de conciliação confirmados |
| `ClientMapping` | `client_mappings` | Vínculos CPF pagador → cliente Advbox |
| `AuditLog` | `audit_logs` | Log de auditoria |
| `Notification` | `notifications` | Notificações do sistema |
| `PluggyWebhook` | `pluggy_webhooks` | Webhooks registrados no Pluggy |

### Índices Compostos para Performance

Definidos no schema e aplicados via migration `20260221000000_add_performance_indexes`:

| Tabela | Índice | Colunas | Uso |
|---|---|---|---|
| `pluggy_transactions` | `idx_pluggy_tx_tenant_date_type` | `tenant_id, date DESC, type` | Listagem principal de transações |
| `pluggy_transactions` | `idx_pluggy_tx_tenant_account_date` | `tenant_id, pluggy_account_db_id, date DESC` | Transações por conta |
| `reconciliation_records` | `idx_recon_tenant_status` | `tenant_id, status` | Filtro de conciliações |
| `audit_logs` | `idx_audit_tenant_created` | `tenant_id, created_at DESC` | Histórico recente |
| `client_mappings` | `idx_client_mapping_tenant_customer` | `tenant_id, advbox_customer_id` | Busca de vínculos |

### Materialized View — KPIs do Dashboard

```sql
CREATE MATERIALIZED VIEW mv_tenant_kpis AS
SELECT
  tenant_id,
  date_trunc('month', date) AS month,
  type,
  COUNT(*)::int AS tx_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  COUNT(*) FILTER (WHERE ignored = false)::int AS active_tx_count,
  SUM(amount) FILTER (WHERE ignored = false) AS active_total_amount
FROM pluggy_transactions
GROUP BY tenant_id, date_trunc('month', date), type;
```

- **Índice único**: `(tenant_id, month, type)` — permite `REFRESH CONCURRENTLY`
- **Refresh**: Chamado via `refreshKpiView()` em `lib/kpi-view.ts` após sync e webhooks
- **Consulta**: `getKpisForTenant(tenantId, month?)` retorna KPIs pré-computados

---

## 3. Prisma Accelerate

### Status: OPCIONAL (não configurado atualmente)

Quando `PRISMA_ACCELERATE_URL` estiver definida, o Prisma carrega `@prisma/extension-accelerate` e habilita:
- Connection pooling gerenciado
- Cache de queries no nível do Prisma (via `cacheStrategy`)

```env
PRISMA_ACCELERATE_URL=prisma://accelerate.prisma-data.net/?api_key=xxx
```

Sem essa env var, o sistema usa conexão direta via `pg.Pool` — que é o modo atual.

---

## 4. Cache-Aside Pattern (API Routes)

### Arquivo: `lib/api-helpers.ts`

A função `withCache<T>()` implementa o padrão cache-aside:

```
Request → Redis GET → HIT? → retorna cache (X-Cache: HIT)
                     → MISS? → consulta Prisma → salva no Redis → retorna (X-Cache: MISS)
```

### Rotas que utilizam cache:

| Rota | Cache Key | TTL | Invalidação |
|---|---|---|---|
| `GET /api/pluggy/accounts` | `tenant:{id}:accounts` | 2 min | Sync, Webhook |
| `GET /api/settings` | `tenant:{id}:settings` | 5 min | `POST /api/settings` |
| `GET /api/pluggy/transactions` | `tenant:{id}:txns:{hash}` | 1 min | Sync, Webhook |
| `GET /api/reconciliation` | `tenant:{id}:recon:{hash}` | 30s | Confirm, Link, Sync |

### Headers HTTP de cache na resposta:

```
X-Cache: HIT | MISS
Cache-Control: private, max-age={ttl}, stale-while-revalidate={ttl/2}
```

### Invalidação de Cache

A invalidação acontece automaticamente em:

| Evento | Chaves Invalidadas |
|---|---|
| `POST /api/settings` | `tenant:{id}:settings` |
| `POST /api/pluggy/sync` | `tenant:{id}:*` (tudo) |
| Webhook Pluggy recebido | `tenant:{id}:*` (tudo) |
| Conciliação confirmada | `tenant:{id}:recon:*` |
| Vínculo de cliente | `tenant:{id}:recon:*` |

---

## 5. Frontend — React Query

### Arquivo: `lib/query-provider.tsx`

Configuração global do `@tanstack/react-query`:

| Opção | Valor | Descrição |
|---|---|---|
| `staleTime` | 60s | Dados considerados "frescos" por 1 minuto |
| `gcTime` | 10 min | Dados mantidos em memória por 10 minutos após inatividade |
| `refetchOnWindowFocus` | `true` | Revalida ao voltar à aba |
| `retry` | 2 | Tenta novamente 2x em caso de falha |
| `retryDelay` | Exponencial (1s, 2s, 4s...) | Delay crescente entre retries |

### Hooks Disponíveis (`lib/hooks/`)

| Hook | Query Key | Fonte API |
|---|---|---|
| `useAccounts()` | `['accounts']` | `GET /api/pluggy/accounts` |
| `useSettings()` | `['settings']` | `GET /api/settings` |
| `useTransactions(params)` | `['transactions', params]` | `GET /api/pluggy/transactions` |
| `useReconciliation(params)` | `['reconciliation', params]` | `GET /api/reconciliation` |
| `useNotifications(limit)` | `['notifications', limit]` | `GET /api/notifications` |

Cada hook inclui mutations correspondentes que invalidam automaticamente as queries relacionadas após sucesso.

---

## 6. Real-time — Server-Sent Events (SSE)

### Backend: `lib/sse.ts` + `app/api/events/route.ts`

Pub/sub in-memory por tenant. Quando um evento é publicado:

1. Backend chama `publishEvent(tenantId, { type: 'sync_complete' })`
2. Todos os clientes conectados ao SSE daquele tenant recebem o evento
3. O endpoint `/api/events` mantém a conexão aberta com heartbeat

### Frontend: `lib/hooks/use-sse.ts`

O hook `useSSE()` (montado globalmente via `QueryProvider`) escuta os eventos e invalida as queries certas:

| Evento SSE | Queries Invalidadas |
|---|---|
| `sync_complete` | `accounts`, `transactions`, `reconciliation` |
| `reconciliation_ready` | `reconciliation` |
| `sync` | `accounts`, `transactions` |
| `notification` | `notifications` |

- Reconexão automática com exponential backoff (1s → 2s → 4s → ... → 30s max)

---

## 7. Background Workers

### Reconciliação Pré-computada: `lib/reconciliation-worker.ts`

Após sync ou webhook, a conciliação pesada é executada em background:

1. Busca transações Pluggy do banco
2. Busca clientes e transações da API Advbox (com cache Redis de clientes)
3. Executa algoritmo de matching (CPF, nome fuzzy, valor, contato)
4. Salva resultado no Redis (`tenant:{id}:recon:{hash}`)
5. Publica evento SSE `reconciliation_ready`

O endpoint `GET /api/reconciliation` verifica o Redis primeiro — se já foi pré-computado, retorna instantaneamente.

### KPI View Refresh: `lib/kpi-view.ts`

`refreshKpiView()` é chamado após sync e webhooks para manter a materialized view atualizada. Usa `REFRESH CONCURRENTLY` para não bloquear leituras.

---

## 8. Fluxo Completo de uma Sync

```
1. POST /api/pluggy/sync
   ├── Busca transações da Pluggy API
   ├── Salva/atualiza no PostgreSQL
   ├── invalidatePattern("tenant:{id}:*")  ← limpa todo cache Redis
   ├── refreshKpiView()                    ← atualiza materialized view
   ├── precomputeReconciliation()          ← background worker
   └── publishEvent("sync_complete")       ← notifica frontend via SSE
       │
       ▼
2. Frontend recebe SSE "sync_complete"
   ├── React Query invalida: accounts, transactions, reconciliation
   └── Componentes re-renderizam com dados frescos
       │
       ▼
3. Frontend refaz GET /api/pluggy/transactions
   ├── Redis MISS (cache foi limpo)
   ├── Consulta PostgreSQL (usa índices compostos)
   ├── Salva resultado no Redis (TTL 60s)
   └── Retorna com X-Cache: MISS
       │
       ▼
4. Próxima requisição (dentro de 60s)
   ├── Redis HIT
   └── Retorna com X-Cache: HIT (sem tocar no banco)
```

---

## 9. Checklist para Configuração em Produção

### Mínimo (funciona sem Redis/Accelerate):

- [x] `DATABASE_URL` — conexão PostgreSQL
- [x] `CLERK_SECRET_KEY` — autenticação
- [x] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — auth frontend
- [x] Prisma migrations aplicadas (`npx prisma migrate deploy`)

### Recomendado (performance otimizada):

- [ ] `UPSTASH_REDIS_REST_URL` — habilita cache distribuído
- [ ] `UPSTASH_REDIS_REST_TOKEN` — token do Redis Upstash
- [ ] Executar migration de índices: `20260221000000_add_performance_indexes`
- [ ] Criar materialized view `mv_tenant_kpis` (incluída na migration acima)

### Opcional (connection pooling avançado):

- [ ] `PRISMA_ACCELERATE_URL` — habilita Prisma Accelerate (pooling + cache de queries)

---

## 10. Arquivos Relacionados

| Arquivo | Responsabilidade |
|---|---|
| `lib/redis.ts` | Client Redis, cache helpers, rate limiter, cache keys/TTLs |
| `lib/prisma.ts` | Client Prisma, conexão PostgreSQL, Accelerate condicional |
| `lib/api-helpers.ts` | `getAuthContext()`, `withCache()`, `cached()`, respostas padronizadas |
| `lib/sse.ts` | Pub/sub in-memory para Server-Sent Events |
| `lib/kpi-view.ts` | Refresh e consulta da materialized view `mv_tenant_kpis` |
| `lib/reconciliation-worker.ts` | Worker de pré-computação da conciliação |
| `lib/rate-limit-middleware.ts` | Rate limiting por rota (wrapper) |
| `lib/query-provider.tsx` | Provider React Query + SSE listener |
| `lib/hooks/use-sse.ts` | Hook SSE com reconexão automática |
| `lib/hooks/use-accounts.ts` | Hook React Query para contas |
| `lib/hooks/use-settings.ts` | Hook React Query para configurações |
| `lib/hooks/use-transactions.ts` | Hook React Query para transações |
| `lib/hooks/use-reconciliation.ts` | Hook React Query para conciliação |
| `lib/hooks/use-notifications.ts` | Hook React Query para notificações |
| `middleware.ts` | Rate limiting global no Edge |
| `prisma/schema.prisma` | Schema com índices compostos |
| `prisma/migrations/20260221000000_add_performance_indexes/migration.sql` | Índices + materialized view |

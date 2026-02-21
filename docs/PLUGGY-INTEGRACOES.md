# Pluggy — Guia Completo de Integrações

> Referência interna para o projeto **AdvBox**.
> Baseado na documentação oficial: https://docs.pluggy.ai
> Última atualização: Fevereiro 2026

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Autenticação](#2-autenticação)
3. [Pluggy Connect Widget](#3-pluggy-connect-widget)
4. [Produtos de Dados (Data)](#4-produtos-de-dados-data)
   - 4.1 [Accounts (Contas)](#41-accounts-contas)
   - 4.2 [Transactions (Transações)](#42-transactions-transações)
   - 4.3 [Credit Card Bills (Faturas)](#43-credit-card-bills-faturas)
   - 4.4 [Investments (Investimentos)](#44-investments-investimentos)
   - 4.5 [Loans (Empréstimos)](#45-loans-empréstimos)
   - 4.6 [Identity (Identidade)](#46-identity-identidade)
5. [Intelligence APIs](#5-intelligence-apis)
   - 5.1 [Connection Insights](#51-connection-insights)
   - 5.2 [Transaction Enrichment](#52-transaction-enrichment)
   - 5.3 [Recurring Payments Analysis](#53-recurring-payments-analysis)
6. [Payments (Pagamentos)](#6-payments-pagamentos)
   - 6.1 [Payment Intent](#61-payment-intent)
   - 6.2 [Scheduled Payments (Pix Agendado)](#62-scheduled-payments-pix-agendado)
   - 6.3 [PIX Automático](#63-pix-automático)
7. [Smart Transfers](#7-smart-transfers)
8. [Boleto Management API](#8-boleto-management-api)
9. [Webhooks](#9-webhooks)
10. [Connectores Disponíveis](#10-conectores-disponíveis)
11. [Rate Limits e Erros](#11-rate-limits-e-erros)
12. [Sandbox (Testes)](#12-sandbox-testes)
13. [Integração com o AdvBox — O que já temos](#13-integração-com-o-advbox--o-que-já-temos)
14. [Integrações Futuras — Roadmap](#14-integrações-futuras--roadmap)

---

## 1. Visão Geral

O Pluggy é uma API unificada de Open Finance que permite acessar dados financeiros dos usuários (contas, transações, investimentos, identidade) e executar pagamentos (PIX, boleto, smart transfers) a partir de integrações com instituições financeiras brasileiras e internacionais.

**Conceitos principais:**

| Conceito | Descrição |
|---|---|
| **Connector** | Integração com uma instituição financeira (ex: Itaú, Nubank) |
| **Item** | Conexão ativa de um usuário via um Connector. Ponto de entrada para acessar os dados |
| **Product** | Dados padronizados (Accounts, Transactions, Investments, Identity, etc.) |
| **API Key** | Token server-side com validade de 2h, criado com CLIENT_ID + CLIENT_SECRET |
| **Connect Token** | Token client-side com validade de 30min, acesso limitado |

**API Base URL:** `https://api.pluggy.ai`

**SDK Node.js:**
```bash
npm install pluggy-sdk
```

---

## 2. Autenticação

### 2.1. API Key (Server-side)

Usado para acessar todos os endpoints da API. Expira em 2 horas.

```typescript
import { PluggyClient } from 'pluggy-sdk'

const client = new PluggyClient({
  clientId: process.env.PLUGGY_CLIENT_ID!,
  clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
})
```

**Endpoint direto:**
```
POST https://api.pluggy.ai/auth
Content-Type: application/json

{
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET"
}
```

Retorna: `{ "apiKey": "eyJ..." }`

### 2.2. Connect Token (Client-side)

Token de escopo limitado, usado no widget Pluggy Connect. Validade: 30 minutos.

```typescript
const connectToken = await client.createConnectToken({
  webhookUrl: "https://meuapp.com/api/webhooks/pluggy",
  clientUserId: "user-123",
  avoidDuplicates: true,
})
```

**Opções ao criar o Connect Token:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `webhookUrl` | string | URL para receber eventos do item |
| `clientUserId` | string | Identificador externo do seu sistema |
| `avoidDuplicates` | boolean | Previne conexão duplicada (mesmas credenciais) |
| `oauthRedirectUrl` | string | URL de redirect para OAuth |
| `products` | string[] | Produtos específicos: `ACCOUNTS`, `TRANSACTIONS`, `CREDIT_CARDS`, `INVESTMENTS`, `IDENTITY` |

---

## 3. Pluggy Connect Widget

Widget drop-in que gerencia todo o fluxo de conexão bancária: credenciais, MFA, erros, etc.

### 3.1. Instalação (React/Next.js)

```bash
npm install react-pluggy-connect
```

### 3.2. Uso no Next.js (nosso caso)

```tsx
import { PluggyConnect } from 'react-pluggy-connect'

export function BankConnection({ connectToken }: { connectToken: string }) {
  return (
    <PluggyConnect
      connectToken={connectToken}
      includeSandbox={process.env.NODE_ENV === 'development'}
      onSuccess={({ item }) => {
        // item.id = ID do item criado
        // Enviar para o backend para salvar
        fetch('/api/pluggy/create-item', {
          method: 'POST',
          body: JSON.stringify({ itemId: item.id }),
        })
      }}
      onError={({ message, data }) => {
        console.error('Erro na conexão:', message)
      }}
      onClose={() => {
        console.log('Widget fechado')
      }}
      // Callbacks opcionais:
      onEvent={(payload) => {
        // SUBMITTED_CONSENT, SELECTED_INSTITUTION, SUBMITTED_LOGIN, etc.
      }}
    />
  )
}
```

### 3.3. Configurações avançadas

| Propriedade | Tipo | Descrição |
|---|---|---|
| `connectToken` | string | **Obrigatório** |
| `includeSandbox` | boolean | Mostra conectores sandbox |
| `updateItem` | string | Item ID para atualizar (reconexão) |
| `selectedConnectorId` | number | Pular seleção e ir direto para login |
| `connectorTypes` | string[] | Filtrar por tipo: `PERSONAL_BANK`, `BUSINESS_BANK`, etc. |
| `products` | string[] | Limitar produtos coletados |
| `connectorIds` | number[] | Listar apenas conectores específicos |
| `countries` | string[] | Filtrar por país (ISO alpha-2) |
| `language` | string | `'pt'`, `'en'`, `'es'` |
| `theme` | string | `'light'` ou `'dark'` |

### 3.4. Ambientes disponíveis

- React: `react-pluggy-connect`
- React Native: `react-native-pluggy-connect`
- Flutter: `flutter_pluggy_connect`
- Next.js: via quickstart
- Plain Javascript: via quickstart

---

## 4. Produtos de Dados (Data)

### 4.1. Accounts (Contas)

Representa contas bancárias do usuário (corrente, poupança, cartão de crédito).

```typescript
const accounts = await client.fetchAccounts(itemId)

// accounts.results = Array<Account>
// Account: { id, name, type, subtype, number, balance, currencyCode, bankData }
```

**Tipos de conta:** `BANK` (corrente/poupança) e `CREDIT` (cartão de crédito)

**Como integrar no AdvBox:**

```typescript
// Já implementado em lib/pluggy.ts → syncAccountsForItem()
const accounts = await client.fetchAccounts(itemId)
for (const acc of accounts.results) {
  await prisma.pluggyAccount.upsert({
    where: { accountId: acc.id },
    create: { /* ... dados da conta */ },
    update: { /* ... dados atualizados */ },
  })
}
```

### 4.2. Transactions (Transações)

Transações financeiras de uma conta (débitos, créditos, transferências).

```typescript
const transactions = await client.fetchTransactions(accountId, {
  from: '2026-01-01',
  to: '2026-02-20',
  page: 1,
  pageSize: 500,
})

// Transaction: { id, description, descriptionRaw, amount, type, date, category,
//   categoryId, balance, status, merchant, creditCardMetadata, paymentData }
```

**Paginação:** A API retorna `{ total, totalPages, page, results }`. Iterar todas as páginas.

**Categorização automática:** O Pluggy categoriza transações automaticamente com campos `category` e `categoryId`.

**Como integrar no AdvBox:**

```typescript
// Já implementado em lib/pluggy.ts → syncTransactionsForAccount()
// Faz upsert de todas as transações paginando automaticamente
```

### 4.3. Credit Card Bills (Faturas)

Faturas de cartão de crédito com detalhes de encargos.

```typescript
const bills = await client.fetchBills(accountId)

// Bill: { id, dueDate, totalAmount, totalAmountCurrencyCode,
//   minimumPaymentAmount, allowsInstallments, financeCharges }
```

**Relevância para o AdvBox:** Monitorar faturas de cartão corporativo do escritório de advocacia. Pode ser usado para conciliação com despesas do Advbox.

**Como integrar:**

```typescript
// Novo endpoint: app/api/pluggy/bills/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')

  const { client } = await getPluggyClientForTenant(tenantId)
  const bills = await client.fetchBills(accountId)

  return NextResponse.json(bills)
}
```

**Schema Prisma sugerido:**

```prisma
model PluggyCreditCardBill {
  id                  String   @id @default(cuid())
  pluggyAccountDbId   String   @map("pluggy_account_db_id")
  tenantId            String   @map("tenant_id")
  billId              String   @unique @map("bill_id")
  dueDate             DateTime @map("due_date")
  totalAmount         Float    @map("total_amount")
  currencyCode        String   @default("BRL") @map("currency_code")
  minimumPayment      Float?   @map("minimum_payment")
  allowsInstallments  Boolean  @default(false) @map("allows_installments")
  financeCharges      Json?    @map("finance_charges")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  pluggyAccount PluggyAccount @relation(fields: [pluggyAccountDbId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("pluggy_credit_card_bills")
}
```

### 4.4. Investments (Investimentos)

Investimentos do usuário com dados detalhados por tipo.

```typescript
const investments = await client.fetchInvestments(itemId)

// Investment: { id, name, type, balance, currencyCode, annualRate, date, ... }
// Tipos: FIXED_INCOME, SECURITY, MUTUAL_FUND, EQUITY, COE, ETF, CRYPTOCURRENCY
```

**Investment Transactions (movimentações de investimento):**

```typescript
const investmentTransactions = await client.fetchInvestmentTransactions(investmentId)
```

**Relevância para o AdvBox:** Rastrear investimentos do escritório ou de clientes que tenham conta de investimento vinculada.

**Como integrar:**

```typescript
// Novo endpoint: app/api/pluggy/investments/route.ts
export async function GET(request: Request) {
  const { client } = await getPluggyClientForTenant(tenantId)
  const items = await prisma.pluggyItem.findMany({ where: { tenantId } })

  const allInvestments = []
  for (const item of items) {
    const response = await client.fetchInvestments(item.itemId)
    allInvestments.push(...response.results)
  }

  return NextResponse.json(allInvestments)
}
```

**Schema Prisma sugerido:**

```prisma
model PluggyInvestment {
  id              String   @id @default(cuid())
  pluggyItemDbId  String   @map("pluggy_item_db_id")
  tenantId        String   @map("tenant_id")
  investmentId    String   @unique @map("investment_id")
  name            String
  type            String
  balance         Float    @default(0)
  currencyCode    String   @default("BRL") @map("currency_code")
  annualRate      Float?   @map("annual_rate")
  date            DateTime
  metadata        Json?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  pluggyItem PluggyItem @relation(fields: [pluggyItemDbId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("pluggy_investments")
}
```

### 4.5. Loans (Empréstimos)

Informações sobre empréstimos e financiamentos.

```typescript
const loans = await client.fetchLoans(itemId)
```

**Relevância para o AdvBox:** Visão de empréstimos ativos do escritório. Útil para planejamento financeiro.

### 4.6. Identity (Identidade)

Dados de identidade do titular da conta.

```typescript
const identity = await client.fetchIdentityByItemId(itemId)

// Identity: { id, fullName, document, documentType, birthDate, emails, phoneNumbers, addresses }
```

**Relevância para o AdvBox:** Cruzar identidade do titular com dados de clientes do Advbox para conciliação automática (CPF matching).

---

## 5. Intelligence APIs

### 5.1. Connection Insights

Análise da qualidade das conexões, incluindo score de saúde e recomendações.

```
GET /items/{id}/insights
```

**Relevância:** Monitorar qualidade das conexões bancárias e alertar quando reconexão for necessária.

### 5.2. Transaction Enrichment

Enriquecimento automático de transações com categorização, logo do merchant e dados adicionais.

Já incluso nas transações retornadas pela API — campos `category`, `categoryId`, `merchant`.

**Relevância para o AdvBox:** Usar categorias para classificar despesas automaticamente e facilitar conciliação com tipos de lançamento do Advbox.

### 5.3. Recurring Payments Analysis

Identificação de pagamentos recorrentes (assinaturas, mensalidades).

```
GET /items/{id}/recurring-payments
```

**Relevância:** Detectar honorários recorrentes recebidos e comparar com plano de honorários do Advbox.

---

## 6. Payments (Pagamentos)

### 6.1. Payment Intent (Pix Instantâneo)

Permite iniciar pagamentos PIX do usuário.

**Fluxo:**
1. Criar um Payment Request (ordem de pagamento)
2. Usuário autoriza via Payment Intent
3. Receber confirmação via webhook

```typescript
// Criar payment request
const paymentRequest = await client.createPaymentRequest({
  amount: 150.00,
  recipientAccount: {
    pixKey: "email@escritorio.com",
  },
  description: "Pagamento de honorários",
  callbackUrls: {
    success: "https://meuapp.com/pagamento/sucesso",
    error: "https://meuapp.com/pagamento/erro",
  },
})
```

**Webhooks de pagamento:**

| Evento | Descrição |
|---|---|
| `payment_intent/created` | Intent criado |
| `payment_intent/completed` | Pagamento concluído com sucesso |
| `payment_intent/waiting_payer_authorization` | Aguardando autorização |
| `payment_intent/error` | Erro no pagamento |
| `payment_request/updated` | Status do request mudou |

**Relevância para o AdvBox:** Permitir que clientes paguem honorários diretamente pelo sistema via PIX.

### 6.2. Scheduled Payments (Pix Agendado)

Pagamentos PIX programados para datas futuras.

**Webhooks:**

| Evento | Descrição |
|---|---|
| `scheduled_payment/created` | Agendamento criado |
| `scheduled_payment/completed` | Pagamento executado |
| `scheduled_payment/error` | Erro na execução |
| `scheduled_payment/canceled` | Cancelado pelo usuário/cliente |

**Relevância:** Parcelar honorários com PIX agendado.

### 6.3. PIX Automático

Pagamentos recorrentes automáticos via PIX (débito automático).

**Webhooks:**

| Evento | Descrição |
|---|---|
| `automatic_pix_payment/created` | Pagamento agendado |
| `automatic_pix_payment/completed` | Pagamento realizado |
| `automatic_pix_payment/error` | Erro |
| `automatic_pix_payment/canceled` | Cancelado |

**Relevância:** Cobrar honorários recorrentes automaticamente dos clientes.

---

## 7. Smart Transfers

Transferências inteligentes com pré-autorização via Open Finance.

**Fluxo:**
1. Criar pré-autorização (consent do usuário)
2. Após aprovação, executar pagamentos dentro do valor autorizado
3. Não precisa de autorizações adicionais para cada pagamento

**Webhooks:**

| Evento | Descrição |
|---|---|
| `smart_transfer_preauthorization/completed` | Pré-autorização aprovada |
| `smart_transfer_preauthorization/error` | Erro (ex: rejeitado pelo usuário) |
| `smart_transfer_payment/completed` | Pagamento executado |
| `smart_transfer_payment/error` | Erro no pagamento (ex: saldo insuficiente) |

**Relevância:** Permitir que o escritório cobre honorários diretamente da conta do cliente após uma única autorização.

---

## 8. Boleto Management API

API para criar e gerenciar boletos diretamente integrada com bancos.

> **Status:** BETA — Suporte atual: Inter Empresas

**Fluxo:**
1. Criar uma Boleto Connection (a partir de um Item existente)
2. Criar boletos programaticamente
3. Receber notificação de pagamento via webhook

```typescript
// 1. Criar conexão de boleto a partir do item
const boletoConnection = await fetch('https://api.pluggy.ai/boleto-connections', {
  method: 'POST',
  headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ itemId: 'seu-item-id' }),
})

// 2. Criar um boleto
const boleto = await fetch('https://api.pluggy.ai/boletos', {
  method: 'POST',
  headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    boletoConnectionId: 'connection-id',
    boleto: {
      seuNumero: '12345',
      amount: 1500.00,
      dueDate: '2026-03-15',
      payer: {
        taxNumber: '12345678901',  // CPF do cliente
        name: 'João Silva',
        addressState: 'SP',
        addressZipCode: '01239030',
      },
    },
  }),
})
```

**Resposta inclui:** `digitableLine` (linha digitável), `barcode`, `pixQr` (QR code PIX para pagamento).

**Webhook:** `boleto/updated` — notifica quando o boleto é pago.

**Relevância para o AdvBox:** Emitir boletos de honorários diretamente pelo sistema, com notificação automática de pagamento e conciliação.

**Schema Prisma sugerido:**

```prisma
model PluggyBoletoConnection {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  connectionId    String   @unique @map("connection_id")
  pluggyItemDbId  String   @map("pluggy_item_db_id")
  connectorId     Int      @map("connector_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  boletos PluggyBoleto[]

  @@index([tenantId])
  @@map("pluggy_boleto_connections")
}

model PluggyBoleto {
  id                  String    @id @default(cuid())
  tenantId            String    @map("tenant_id")
  boletoConnectionId  String    @map("boleto_connection_id")
  boletoId            String    @unique @map("boleto_id")
  amount              Float
  status              String    @default("OPEN") // OPEN, PAID, CANCELED, EXPIRED
  seuNumero           String    @map("seu_numero")
  dueDate             DateTime  @map("due_date")
  payerTaxNumber      String    @map("payer_tax_number")
  payerName           String    @map("payer_name")
  digitableLine       String?   @map("digitable_line")
  barcode             String?
  pixQr               String?   @map("pix_qr")
  amountPaid          Float?    @map("amount_paid")
  paymentOrigin       String?   @map("payment_origin") // PIX, BOLETO
  paidAt              DateTime? @map("paid_at")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  connection PluggyBoletoConnection @relation(fields: [boletoConnectionId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([status])
  @@map("pluggy_boletos")
}
```

---

## 9. Webhooks

### 9.1. Configuração

Há duas formas de configurar webhooks:

**A) Via Connect Token (por item):**
```typescript
const token = await client.createConnectToken({
  webhookUrl: "https://meuapp.com/api/webhooks/pluggy",
})
```

**B) Via API (global — todos os items):**
```typescript
const webhook = await client.createWebhook({
  url: "https://meuapp.com/api/webhooks/pluggy",
  event: "all", // ou evento específico
})
```

### 9.2. Todos os eventos disponíveis

#### Dados

| Evento | Descrição |
|---|---|
| `item/created` | Item criado com sucesso |
| `item/updated` | Item atualizado/sincronizado |
| `item/deleted` | Item deletado |
| `item/error` | Erro no item |
| `item/waiting_user_input` | Aguardando input do usuário (MFA) |
| `item/login_succeeded` | Login na instituição bem-sucedido |
| `connector/status_updated` | Status do conector mudou (ONLINE/UNSTABLE/OFFLINE) |
| `transactions/created` | Novas transações criadas |
| `transactions/updated` | Transações atualizadas |
| `transactions/deleted` | Transações removidas |

#### Pagamentos

| Evento | Descrição |
|---|---|
| `payment_intent/created` | Payment intent criado |
| `payment_intent/completed` | Pagamento concluído |
| `payment_intent/waiting_payer_authorization` | Aguardando autorização |
| `payment_intent/error` | Erro no pagamento |
| `payment_request/updated` | Status do request atualizado |
| `scheduled_payment/created` | Pagamento agendado criado |
| `scheduled_payment/completed` | Pagamento agendado executado |
| `scheduled_payment/error` | Erro no agendamento |
| `scheduled_payment/canceled` | Agendamento cancelado |
| `automatic_pix_payment/created` | PIX automático criado |
| `automatic_pix_payment/completed` | PIX automático executado |
| `automatic_pix_payment/error` | Erro |
| `automatic_pix_payment/canceled` | Cancelado |

#### Smart Transfers & Boleto

| Evento | Descrição |
|---|---|
| `smart_transfer_preauthorization/completed` | Pré-autorização aprovada |
| `smart_transfer_preauthorization/error` | Erro na pré-autorização |
| `smart_transfer_payment/completed` | Pagamento concluído |
| `smart_transfer_payment/error` | Erro no pagamento |
| `boleto/updated` | Boleto atualizado (pago, expirado, etc.) |

### 9.3. Payload dos webhooks

```typescript
// Item events
interface ItemWebhookPayload {
  event: string           // "item/created", "item/updated", etc.
  eventId: string         // UUID do evento
  itemId: string          // UUID do item
  triggeredBy: 'USER' | 'CLIENT' | 'SYNC' | 'INTERNAL'
  clientUserId?: string
  error?: { code: string; message: string; parameter?: string }
}

// Transaction events
interface TransactionWebhookPayload {
  event: string
  eventId: string
  itemId: string
  accountId: string
  transactionIds?: string[]          // para updated/deleted
  transactionsCount?: number         // para created
  transactionsMinDate?: string
  createdTransactionsLink?: string   // URL paginada com as transações criadas
}

// Payment events
interface PaymentWebhookPayload {
  event: string
  eventId: string
  paymentRequestId: string
  paymentIntentId?: string
  referenceId?: string               // E2E ID do PIX
  error?: { code: string; description: string; detail: string }
}

// Boleto events
interface BoletoWebhookPayload {
  event: 'boleto/updated'
  eventId: string
  boletoId: string
}
```

### 9.4. Tratamento de falhas

- Pluggy tenta entregar até **9 vezes** (3 tentativas imediatas + 3 após 1h + 3 após 2h)
- Seu endpoint deve retornar **2XX em menos de 5 segundos**
- Processe o evento **após** responder ao Pluggy
- Após receber o evento, sempre faça `GET /items/{id}` para obter dados mais recentes

### 9.5. Implementação no AdvBox (já existente)

```
app/api/webhooks/pluggy/route.ts  → Recebe webhooks
app/api/pluggy/webhooks/setup/route.ts → Configura webhooks
```

**IP para whitelist:** `177.71.238.212`

---

## 10. Conectores Disponíveis

### Pessoal (PF)

| Conector | Contas | Transações | Cartão | Investimentos | Identity | MFA | Auto-sync |
|---|---|---|---|---|---|---|---|
| Itaú Cartões | - | - | Sim | - | Sim | Não | Sim |
| Caixa Federal | Sim | Sim | Sim | Sim | Sim | Não* | Sim |
| Banco Inter | Sim | Sim | Sim | Sim | Sim | Sim | Não |
| Mercado Pago | Sim | Sim | - | - | Sim | Não | Sim |
| Safra | Sim | Sim | - | Sim | - | Não* | Sim |
| Wise | Sim | Sim | - | - | Sim | Não | Sim |
| Ethereum | - | - | - | Sim | - | Não | Sim |

*Caixa requer autorização de dispositivo (~30min). Safra requer autorização na primeira conexão.

### Empresarial (PJ)

| Conector | Contas | Transações | Cartão | Investimentos | Identity | Auto-sync |
|---|---|---|---|---|---|---|
| Santander Empresas | Sim | Sim | Sim | Sim | Sim | Sim* |
| Bradesco Empresas | Sim | Sim | Sim | Sim | Sim | Operador |
| Itaú Empresas | Sim | Sim | Sim | Sim | Sim | Sem MFA |
| Caixa Empresas | Sim | Sim | Sim | Sim | Sim | Admin |
| BB Empresas | Sim | Sim | Sim | Sim | Sim | Sim |
| Inter Empresas | Sim | Sim | - | - | Sim | Admin |
| Sicredi Empresas | Sim | Sim | - | - | - | Admin |
| Conta Azul | Sim | Sim | - | - | Sim | Admin |
| Cora | Sim | Sim | - | - | - | Não |
| Sicoob API | Sim | Sim | - | - | Sim | Sim |
| Itaú BBA | Sim | Sim | - | - | Sim | Sim |
| Efí Bank | Sim | Sim | - | - | - | Sim |

### Investimentos

| Conector | Investimentos | Mov. Investimentos | MFA | Auto-sync |
|---|---|---|---|---|
| XP Investimentos | Sim | Sim | Sim | PJ apenas |
| BTG Pactual | Sim | Sim | Sim | Não |
| Avenue | Sim | Sim | Alguns | Não |
| Mercado Bitcoin | Sim | Sim | Não | Sim |
| Ágora | Sim | - | Não | Sim |
| Clear | Sim | - | Não | Sim |

### Open Finance (via regulação)

Conectores Open Finance suportam todos os produtos padrão e utilizam autenticação por CPF/CNPJ + redirect para o app da instituição.

---

## 11. Rate Limits e Erros

### Rate Limits

| Endpoint | Máx req/min/IP |
|---|---|
| `POST /auth` | 360 |
| `GET /transactions` | 360 |
| `GET /investments` | 360 |
| `GET /investments/{id}/transactions` | 360 |
| `PATCH /items` (update) | 20 |

Quando exceder: HTTP 429 com headers `RateLimit-Reset` e `Retry-After`.

### Códigos de Erro HTTP

| Código | Significado |
|---|---|
| 400 | Request inválido |
| 401 | API key inválida |
| 403 | Sem permissão (ex: Connect Token tentando acessar dados detalhados) |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: item duplicado com `avoidDuplicates`) |
| 429 | Rate limit excedido |
| 500 | Erro interno do Pluggy |
| 503 | Manutenção |

### Erros de Execução do Item

| Status | Descrição |
|---|---|
| `SUCCESS` | Conexão/sync bem-sucedida |
| `PARTIAL_SUCCESS` | Erro em algum produto mas outros OK |
| `INVALID_CREDENTIALS` | Credenciais inválidas |
| `INVALID_CREDENTIALS_MFA` | MFA incorreto |
| `ALREADY_LOGGED_IN` | Usuário já logado na instituição |
| `ACCOUNT_LOCKED` | Conta bloqueada |
| `SITE_NOT_AVAILABLE` | Instituição fora do ar |
| `ACCOUNT_NEEDS_ACTION` | Ação manual necessária |
| `CONNECTION_ERROR` | Erro de conexão com o provedor |
| `USER_AUTHORIZATION_PENDING` | Aguardando autorização (ex: Caixa) |
| `USER_NOT_SUPPORTED` | Usuário não suportado |

---

## 12. Sandbox (Testes)

### Credenciais de teste

| Cenário | Usuário | Senha | MFA |
|---|---|---|---|
| Sucesso | `user-ok` | `password-ok` | `123456` |
| Credenciais inválidas | qualquer outro | `password-ok` | - |
| Já logado | `user-logged` | `password-ok` | - |
| Conta bloqueada | `user-locked` | `password-ok` | - |
| Erro inesperado | `user-error` | `password-ok` | - |
| Erro de conexão | `user-connection-error` | `password-ok` | - |
| Sucesso parcial | `user-ok-account-error` | `password-ok` | - |
| Performance (muitas tx) | `user-ok-perf-1000x` | `password-ok` | - |

### Open Finance Sandbox

| Cenário | CPF |
|---|---|
| Fluxo básico | `761.092.776-73` |
| Múltipla alçada (aprovado) | `238.242.640-30` |
| Múltipla alçada (rejeitado) | `051.177.670-55` |

Login na página mock: `ralph.bragg@gmail.com` / `P@ssword01`

---

## 13. Integração com o AdvBox — O que já temos

### Já implementado

| Funcionalidade | Arquivos | Status |
|---|---|---|
| Autenticação com Pluggy SDK | `lib/pluggy.ts` | Funcionando |
| Widget Pluggy Connect | `app/onboarding/page.tsx` | Funcionando |
| Sync de contas | `lib/pluggy.ts` → `syncAccountsForItem()` | Funcionando |
| Sync de transações | `lib/pluggy.ts` → `syncTransactionsForAccount()` | Funcionando |
| Webhook receiver | `app/api/webhooks/pluggy/route.ts` | Funcionando |
| Setup de webhooks | `app/api/pluggy/webhooks/setup/route.ts` | Funcionando |
| CRUD de contas | `app/api/pluggy/accounts/route.ts` | Funcionando |
| CRUD de transações | `app/api/pluggy/transactions/route.ts` | Funcionando |
| Conciliação bancária | `app/api/reconciliation/route.ts` | Funcionando |
| Criação de item | `app/api/pluggy/create-item/route.ts` | Funcionando |
| Sync manual | `app/api/pluggy/sync/route.ts` | Funcionando |

### Schema Prisma atual

- `PluggyItem` — Conexões com instituições
- `PluggyAccount` — Contas bancárias sincronizadas
- `PluggyTransaction` — Transações sincronizadas
- `PluggyWebhook` — Webhooks registrados
- `ReconciliationRecord` — Registros de conciliação
- `ClientMapping` — Mapeamento CPF → Cliente Advbox

---

## 14. Integrações Futuras — Roadmap

### Prioridade Alta (valor direto para escritórios)

| # | Integração | Descrição | Complexidade |
|---|---|---|---|
| 1 | **Boleto Management** | Emitir boletos de honorários direto pelo sistema | Média |
| 2 | **Payment Intent (PIX)** | Gerar cobranças PIX para clientes pagarem | Média |
| 3 | **Credit Card Bills** | Monitorar faturas do cartão corporativo | Baixa |
| 4 | **Identity sync** | Cruzar dados de identidade para matching automático | Baixa |

### Prioridade Média (melhorias na conciliação)

| # | Integração | Descrição | Complexidade |
|---|---|---|---|
| 5 | **Transaction Enrichment** | Usar categorias enriquecidas para classificação automática | Baixa |
| 6 | **Recurring Payments Analysis** | Detectar honorários recorrentes automaticamente | Baixa |
| 7 | **Scheduled Payments** | Parcelar honorários com PIX agendado | Média |
| 8 | **Connection Insights** | Alertar quando conexão bancária precisar de atenção | Baixa |

### Prioridade Baixa (expansão futura)

| # | Integração | Descrição | Complexidade |
|---|---|---|---|
| 9 | **Smart Transfers** | Cobranças automáticas via Open Finance | Alta |
| 10 | **PIX Automático** | Débito automático para honorários recorrentes | Alta |
| 11 | **Investments** | Dashboard de investimentos do escritório | Média |
| 12 | **Loans** | Visualização de empréstimos ativos | Baixa |
| 13 | **Open Finance PJ** | Conectar via Open Finance regulado | Média |

### Templates de implementação

Cada integração futura deve seguir o padrão:

```
1. Criar schema Prisma (model + migration)
2. Criar lib helper (lib/pluggy-<feature>.ts)
3. Criar API routes (app/api/pluggy/<feature>/route.ts)
4. Atualizar webhook handler para novos eventos
5. Criar componentes de UI
6. Adicionar à sidebar e dashboard
```

---

## Referências

- Documentação oficial: https://docs.pluggy.ai
- API Reference: https://docs.pluggy.ai/reference
- SDK Node.js: https://www.npmjs.com/package/pluggy-sdk
- React Widget: https://www.npmjs.com/package/react-pluggy-connect
- Quickstarts: https://github.com/pluggyai/quickstart
- Status dos conectores: https://status.pluggy.ai
- OAS (OpenAPI Spec): https://api.pluggy.ai/oas3.json

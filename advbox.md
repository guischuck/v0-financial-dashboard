# 🎯 Visão Geral

A integração com **AdvBox** permite que o sistema HonorariosPay sincronize dados financeiros, processos jurídicos e clientes do software jurídico AdvBox. Esta integração funciona em múltiplos níveis:

- **Clientes (Contacts)**: Listar, criar e atualizar clientes
- **Processos (Lawsuits)**: Gerenciar processos jurídicos
- **Transações Financeiras**: Sincronizar e criar lançamentos financeiros
- **Configurações**: Recuperar dados de categorias, bancos, centros de custo e departamentos

### Arquitetura

```
┌─────────────────────────────────────────────────────┐
│           HonorariosPay (Laravel)                   │
└─────────────────────────────────────────────────────┘
            │
            ├─ AdvBoxController
            ├─ AdvBoxService (API Abstraction)
            └─ AdvboxTransaction (Model)
            │
            ▼
    API AdvBox v1
    https://app.advbox.com.br/api/v1
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```env
ADVBOX_API_KEY=seu_token_api_here
ADVBOX_API_URL=https://app.advbox.com.br/api/v1
```

### Arquivo de Configuração

Localização: `config/services.php`

```php
'advbox' => [
    'api_key' => env('ADVBOX_API_KEY'),
    'api_url' => env('ADVBOX_API_URL', 'https://app.advbox.com.br/api/v1'),
]
```

### Middleware e Permissões

As rotas da integração utilizam os seguintes middlewares:

| Middleware | Rotas Afetadas | Propósito |
|-----------|---|---|
| `auth` | Todas | Requer autenticação |
| `verified` | Todas | Requer email verificado |
| `role:operador` | POST/PUT para transações | Apenas operadores podem modificar |

---

## 🔐 Autenticação

Todas as requisições para a API AdvBox incluem headers padrão:

```php
Authorization: Bearer {API_KEY}
Accept: application/json
Content-Type: application/json
User-Agent: HonorariosPay/1.0
```

**Métodos HTTP Suportados:**
- `GET` - Consultar dados
- `POST` - Criar recursos
- `PUT` - Atualizar recursos
- `DELETE` - Deletar recursos

### Referência oficial da API (Transações)

Documentação pública dos endpoints de transações:

| Ação | Método | Endpoint | Documentação |
|------|--------|----------|--------------|
| Listar transações | `GET` | `/transactions` | [Obtenha uma lista de transações financeiras](https://api.softwareadvbox.com.br/docs/transactions/getTransactions) |
| Criar transação | `POST` | `/transactions` | [Crie uma nova transação financeira](https://api.softwareadvbox.com.br/docs/transactions/createTransaction) |
| Atualizar transação | `PUT` | `/transactions/{id}` | [Atualize uma transação financeira existente](https://api.softwareadvbox.com.br/docs/transactions/updateTransaction) |

**Resumo rápido:**

- **GET /transactions** — Filtros: `date_due_start`, `date_due_end`, `category`, `debit_bank`, `responsible`, `customer_name`, `description`, `process_number`, `created_start`/`created_end`, `date_payment_start`/`date_payment_end`, `competence_start`/`competence_end`. Resposta: `{ totalCount, limit, offset, data[] }` com campos como `id`, `type` (income/expense), `date_due`, `date_payment`, `amount`, `description`, `responsible`, `category`, `debit_bank`, `credit_bank`, `cost_center`, `name`, `identification`, `lawsuit_id`, `process_number`, etc.
- **POST /transactions** — Obrigatórios: `users_id`, `entry_type` (income|expense), `debit_account`, `categories_id`, `cost_centers_id`, `amount`, `date_due`. Opcionais: `customers_id`, `lawsuits_id`, `sectors_id`, `description`, `date_payment`, `competence`. Categoria deve bater com o tipo: income → categorias tipo CRÉDITO; expense → tipo DÉBITO. IDs vêm de GET `/api/v1/settings`.
- **PUT /transactions/{id}** — Campos alteráveis: `entry_type`, `categories_id`, `amount`, `date_due`, `date_payment` (ou `null` para em aberto), `description`, `competence`. Ao alterar `categories_id` é obrigatório enviar `entry_type`. Rate limit: 500 req/dia.

---

## 🔌 Endpoints

### 1. Transações Financeiras

#### 1.1 Listar Transações (Frontend)

**Rota:** `GET /transacoes-box`

**Middleware:** `auth`, `verified`

**Descrição:** Exibe página com transações do AdvBox sincronizadas no banco de dados local.

**Parâmetros de Query:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `limit` | int | 50 | Itens por página |
| `offset` | int | 0 | Deslocamento para paginação |
| `status` | string | `not_paid` | Filtrar por: `all`, `not_paid`, `paid`, `pending`, `overdue` |
| `type` | string | `revenue` | Filtrar por: `revenue`, `expense`, `all` |
| `category` | string | - | Filtrar por categoria |
| `search` | string | - | Busca por cliente, descrição ou número |
| `date_due_start` | date | - | Data de vencimento inicial (YYYY-MM-DD) |
| `date_due_end` | date | - | Data de vencimento final (YYYY-MM-DD) |
| `show_old` | boolean | false | Mostrar transações antigas (antes de 2026-01-01) |
| `hide_future` | boolean | true | Ocultar pendentes com +60 dias |
| `sort_by` | string | `date_due` | Campo para ordenação: `date_due`, `customer_name`, `amount` |
| `sort_dir` | string | `asc` | Direção: `asc` ou `desc` |

**Resposta (Inertia):**

```json
{
  "transactions": [
    {
      "id": 1,
      "advbox_id": "12345",
      "type": "income",
      "entry_type": "revenue",
      "date_due": "2026-02-28",
      "date_payment": null,
      "competence": "2026-02",
      "amount": 5000.00,
      "description": "Honorários de sucumbência",
      "customer_name": "João Silva",
      "status": "overdue",
      "category": "HONORÁRIOS DE SUCUMBÊNCIA"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 128
  },
  "summary": {
    "total": 128,
    "totalAmount": 45000.00,
    "paid": 45,
    "pending": 50,
    "overdue": 33,
    "revenues": 100,
    "revenuesAmount": 40000.00,
    "expenses": 28,
    "expensesAmount": 5000.00
  },
  "categories": ["ALVARÁS", "HONORÁRIOS FINAIS", "HONORÁRIOS INICIAIS"],
  "lastSync": "2026-02-20T10:30:00Z"
}
```

#### 1.2 Sincronizar Transações Manualmente

**Rota:** `POST /api/advbox/sync`

**Middleware:** `auth`, `verified`

**Descrição:** Dispara sincronização manual de transações do AdvBox para o banco de dados local.

**Request:**

```json
{}
```

**Resposta:**

```json
{
  "message": "Sincronização concluída.",
  "output": "Importadas 25 transações do AdvBox..."
}
```

**Status Code:** `200 OK`

---

#### 1.3 Criar Transação

**Rota:** `POST /api/advbox/transactions`

**Middleware:** `auth`, `verified`, `role:operador`

**Descrição:** Cria uma nova transação financeira no AdvBox.

**Request:**

```json
{
  "users_id": 5,
  "entry_type": "income",
  "debit_account": 12,
  "categories_id": 3,
  "cost_centers_id": 2,
  "amount": 1500.50,
  "date_due": "2026-03-15",
  "customers_id": 42,
  "lawsuits_id": 789,
  "sectors_id": 1,
  "description": "Honorários de consultoria jurídica",
  "date_payment": null
}
```

**Validação:**

| Campo | Tipo | Requerido | Validação |
|-------|------|----------|-----------|
| `users_id` | integer | ✅ | Deve existir em /settings |
| `entry_type` | string | ✅ | Valores: `income`, `expense` |
| `debit_account` | integer | ✅ | Conta bancária do AdvBox |
| `categories_id` | integer | ✅ | Categoria do AdvBox |
| `cost_centers_id` | integer | ✅ | Centro de custo do AdvBox |
| `amount` | decimal | ✅ | Mínimo: 0.01 |
| `date_due` | date | ✅ | Formato: YYYY-MM-DD |
| `customers_id` | integer | ❌ | Cliente do AdvBox |
| `lawsuits_id` | integer | ❌ | Processo do AdvBox |
| `sectors_id` | integer | ❌ | Departamento do AdvBox |
| `description` | string | ❌ | Máximo: 500 caracteres |
| `date_payment` | date | ❌ | Formato: YYYY-MM-DD |

**Resposta (Sucesso - 201 Created):**

```json
{
  "message": "Transação criada com sucesso no AdvBox.",
  "transaction": {
    "id": 98765,
    "status": "pending",
    "amount": 1500.50,
    "date_due": "2026-03-15",
    "created_at": "2026-02-20T14:30:00Z"
  }
}
```

**Resposta (Erro - 422 Unprocessable Entity):**

```json
{
  "message": "Erro ao criar transação no AdvBox. Verifique os dados e tente novamente.",
  "errors": {
    "amount": ["O valor deve ser maior que zero."],
    "date_due": ["A data de vencimento deve estar no formato AAAA-MM-DD."]
  }
}
```

---

#### 1.4 Atualizar Transação

**Rota:** `PUT /api/advbox/transactions/{id}`

**Middleware:** `auth`, `verified`, `role:operador`

**Descrição:** Atualiza uma transação existente no AdvBox (geralmente para marcar como pago).

**Parâmetros de URL:**

```
{id} - ID da transação no AdvBox
```

**Request:**

```json
{
  "date_payment": "2026-02-20",
  "amount": 1500.50,
  "description": "Honorários atualizados",
  "date_due": "2026-03-15",
  "category": "HONORÁRIOS DE SUCUMBÊNCIA"
}
```

**Validação:**

| Campo | Tipo | Requerido | Validação |
|-------|------|----------|-----------|
| `date_payment` | date | ❌ | Formato: YYYY-MM-DD |
| `amount` | numeric | ❌ | Mínimo: 0 |
| `description` | string | ❌ | Máximo: 500 caracteres |
| `date_due` | date | ❌ | Formato: YYYY-MM-DD |
| `category` | string | ❌ | Deve ser válida |

**Resposta (Sucesso - 200 OK):**

```json
{
  "message": "Transação atualizada com sucesso no AdvBox.",
  "transaction": {
    "id": 98765,
    "date_payment": "2026-02-20",
    "status": "paid",
    "updated_at": "2026-02-20T14:35:00Z"
  }
}
```

---

### 2. Configurações Financeiras

#### 2.1 Buscar Dados para Formulário

**Rota:** `GET /api/advbox/financial-settings`

**Middleware:** `auth`, `verified`

**Descrição:** Retorna dados necessários para preencher formulários de criação/edição de transações.

**Request:**

```
GET /api/advbox/financial-settings
```

**Resposta:**

```json
{
  "users": [
    {"id": 1, "name": "João Silva"},
    {"id": 2, "name": "Maria Santos"}
  ],
  "banks": [
    {
      "id": 10,
      "name": "Banco do Brasil",
      "account": "123456-7",
      "type": "corrente"
    }
  ],
  "categories": [
    {"id": 1, "name": "HONORÁRIOS INICIAIS", "type": "income"},
    {"id": 2, "name": "ALVARÁS", "type": "income"},
    {"id": 3, "name": "DESPESAS OPERACIONAIS", "type": "expense"}
  ],
  "cost_centers": [
    {"id": 1, "name": "Centro Principal"},
    {"id": 2, "name": "Centro de Inovação"}
  ],
  "departments": [
    {"id": 1, "name": "Jurídico"},
    {"id": 2, "name": "Administrativo"}
  ]
}
```

---

### 3. Clientes/Contatos

#### 3.1 Listar Clientes

**Método:** `AdvBoxService::getCustomers(array $filters = []): array`

**Endpoint AdvBox:** `GET /customers`

**Parâmetros:**

```php
$filters = [
    'limit' => 100,      // Itens por página
    'offset' => 0,       // Deslocamento
    // outros filtros do AdvBox
]
```

**Resposta:**

```json
{
  "data": [
    {
      "id": 42,
      "name": "João Silva",
      "document": "123.456.789-00",
      "identification": "123456789",
      "email": "joao@example.com",
      "phone": "(11) 98765-4321",
      "lawsuits": [
        {
          "lawsuit_id": 789,
          "process_number": "0001234-56.2025.8.26.0100"
        }
      ]
    }
  ],
  "totalCount": 500
}
```

---

#### 3.2 Criar Cliente

**Método:** `AdvBoxService::createCustomer(array $data): ?array`

**Endpoint AdvBox:** `POST /customers`

**Request:**

```php
$data = [
    'name' => 'João Silva',
    'document' => '123.456.789-00',
    'email' => 'joao@example.com',
    'phone' => '(11) 98765-4321'
];
```

---

#### 3.3 Buscar Cliente por ID

**Método:** `AdvBoxService::getCustomer(int $id): ?array`

**Endpoint AdvBox:** `GET /customers/{id}`

---

#### 3.4 Buscar Aniversariantes

**Método:** `AdvBoxService::getCustomerBirthdays(): array`

**Endpoint AdvBox:** `GET /customers/birthdays`

---

### 4. Processos Jurídicos

#### 4.1 Listar Processos

**Método:** `AdvBoxService::getLawsuits(array $filters = []): array`

**Endpoint AdvBox:** `GET /lawsuits`

**Parâmetros:**

```php
$filters = [
    'limit' => 50,
    'offset' => 0
]
```

---

#### 4.2 Criar Processo

**Método:** `AdvBoxService::createLawsuit(array $data): ?array`

**Endpoint AdvBox:** `POST /lawsuits`

**Request:**

```php
$data = [
    'customer_id' => 42,
    'process_number' => '0001234-56.2025.8.26.0100',
    'type' => 'civil',
    'stage' => 'first_instance',
    'description' => 'Ação de cobrança'
];
```

---

#### 4.3 Buscar Processo por ID

**Método:** `AdvBoxService::getLawsuit(int $id): ?array`

**Endpoint AdvBox:** `GET /lawsuits/{id}`

---

#### 4.4 Atualizar Processo

**Método:** `AdvBoxService::updateLawsuit(int $id, array $data): ?array`

**Endpoint AdvBox:** `PUT /lawsuits/{id}`

---

#### 4.5 Histórico de Tarefas

**Método:** `AdvBoxService::getLawsuitHistory(int $lawsuitId): array`

**Endpoint AdvBox:** `GET /history/{lawsuitId}`

---

#### 4.6 Movimentações do Processo

**Método:** `AdvBoxService::getLawsuitMovements(int $lawsuitId): array`

**Endpoint AdvBox:** `GET /movements/{lawsuitId}`

---

#### 4.7 Criar Movimentação

**Método:** `AdvBoxService::createMovement(array $data): ?array`

**Endpoint AdvBox:** `POST /lawsuits/movement`

---

#### 4.8 Últimas Movimentações

**Método:** `AdvBoxService::getLastMovements(array $filters = []): array`

**Endpoint AdvBox:** `GET /last_movements`

---

#### 4.9 Publicações

**Método:** `AdvBoxService::getPublications(int $lawsuitId): array`

**Endpoint AdvBox:** `GET /publications/{lawsuitId}`

---

### 5. Tarefas

#### 5.1 Listar Tarefas

**Método:** `AdvBoxService::getTasks(array $filters = []): array`

**Endpoint AdvBox:** `GET /posts`

---

#### 5.2 Criar Tarefa

**Método:** `AdvBoxService::createTask(array $data): ?array`

**Endpoint AdvBox:** `POST /posts`

---

### 6. Configurações

#### 6.1 Buscar Configurações da Conta

**Método:** `AdvBoxService::getSettings(): ?array`

**Endpoint AdvBox:** `GET /settings`

**Resposta:**

```json
{
  "users": [
    {"id": 1, "name": "Usuário 1"}
  ],
  "financial": {
    "banks": [
      {"id": 10, "name": "Banco do Brasil", "account": "123456-7"}
    ],
    "categories": [
      {"id": 1, "category": "HONORÁRIOS INICIAIS", "type": "income"}
    ],
    "cost_centers": [
      {"id": 1, "cost_center": "Centro Principal"}
    ],
    "departments": [
      {"id": 1, "department": "Jurídico"}
    ]
  }
}
```

---

#### 6.2 Testar Conexão

**Método:** `AdvBoxService::testConnection(): bool`

**Descrição:** Verifica se a API está acessível com a chave configurada.

```php
if ($advBoxService->testConnection()) {
    echo "Conexão OK";
} else {
    echo "Erro na conexão";
}
```

---

## 📋 Requisitos Funcionais

### 1. Sincronização de Transações

**ID:** RF-001

**Descrição:** O sistema deve sincronizar automaticamente transações financeiras do AdvBox para o banco de dados local.

**Fluxo:**
1. Sistema executa comando `advbox:sync` regularmente
2. Conecta à API do AdvBox para buscar transações
3. Normaliza dados recebidos
4. Valida e armazena no banco (`advbox_transactions`)
5. Registra timestamp de sincronização

**Dados Sincronizados:**
- ID da transação (AdvBox)
- Tipo (income/expense)
- Data de vencimento
- Data de pagamento
- Valor
- Descrição
- Responsável
- Categoria
- Cliente
- Processo
- Centro de custo

---

### 2. Classificação Automática de Receitas vs Despesas

**ID:** RF-002

**Descrição:** O sistema deve classificar transações como receita ou despesa baseado na categoria.

**Categorias de Receita:**
- ALVARÁS
- APORTE DE SÓCIO
- HONORÁRIOS CONSULTORIAS
- HONORÁRIOS DE SUCUMBÊNCIA
- HONORÁRIOS FINAIS
- HONORÁRIOS INICIAIS
- HONORÁRIOS POR MENSALIDADE

**Categorias de Despesa:** Todas as demais

**Localização:** [AdvBoxController.php](app/Http/Controllers/AdvBoxController.php#L24)

---

### 3. Filtros de Transações

**ID:** RF-003

**Descrição:** O sistema deve permitir filtrar transações por múltiplos critérios.

**Filtros Disponíveis:**
- Status de pagamento: pagos, pendentes, vencidas
- Tipo: receita, despesa, ambos
- Categoria
- Data de vencimento (intervalo)
- Busca por cliente/descrição/número
- Ocultar transações fut

uras (+60 dias)
- Mostrar dados históricos

**Scope Query:**
- `paid()` - Transações pagas
- `notPaid()` - Transações não pagas
- `pending()` - Pendentes com vencimento futuro
- `overdue()` - Vencidas
- `revenues()` - Apenas receitas
- `expenses()` - Apenas despesas
- `search(string $term)` - Busca textual

---

### 4. Resumo Financeiro

**ID:** RF-004

**Descrição:** Exibir resumo consolidado das transações com aplicação dos mesmos filtros.

**Dados do Resumo:**
- Quantidade total de transações
- Valor total
- Quantidade de transações pagas/pendentes/vencidas
- Quantidade de receitas vs despesas
- Valor total de receitas vs despesas

---

### 5. Paginação e Ordenação

**ID:** RF-005

**Descrição:** Implementar paginação eficiente das transações com ordenação flexível.

**Campos de Ordenação:**
- Data de vencimento (padrão)
- Nome do cliente
- Valor

**Padrões:**
- Limite: 50 itens por página
- Método: offset/limit

---

### 6. Criação de Transações

**ID:** RF-006

**Descrição:** Permitir aos operadores criar novas transações no AdvBox diretamente.

**Restrições:**
- Apenas role `operador` pode criar
- Validação completa de dados
- Log de auditoria obrigatório
- Retorno da transação criada no AdvBox

**Campos Obrigatórios:**
- Usuário responsável
- Tipo (income/expense)
- Conta bancária
- Categoria
- Centro de custo
- Valor
- Data de vencimento

---

### 7. Atualização de Transações

**ID:** RF-007

**Descrição:** Permitir aos operadores atualizar transações existentes.

**Casos de Uso:**
- Marcar como pago (adicionar data_payment)
- Alterar valor
- Alterar descrição
- Alterar data de vencimento
- Alterar categoria

**Restrições:**
- Apenas role `operador` pode atualizar
- Log de auditoria obrigatório

---

### 8. Matching de Clientes

**ID:** RF-008

**Descrição:** Identificar automaticamente clientes do AdvBox baseado em informações da transação.

**Estratégia de Matching (em ordem de prioridade):**

1. **Documento (CPF/CNPJ exacto)**
   - Normaliza documento (remove pontuação)
   - Compara com campo `document` do AdvBox

2. **Identificação (CPF alternativo)**
   - Busca no campo `identification` do AdvBox

3. **Chave PIX (documento)**
   - Se PIX é CPF/CNPJ, normaliza e compara

4. **Chave PIX (telefone)**
   - Se PIX é telefone, normaliza e compara

5. **Chave PIX (email)**
   - Comparação case-insensitive

6. **Nome Fuzzy Match**
   - Normaliza ambos os nomes (maiúsculas)
   - Remove caracteres especiais
   - Valida se todas as partes do nome curto estão no longo
   - Exige no mínimo 2 partes por nome

---

### 9. Enriquecimento de Dados de Cliente

**ID:** RF-009

**Descrição:** Buscar detalhes completos dos processos associados ao cliente.

**Fluxo:**
1. Cliente encontrado via matching
2. Sistema verifica se processo tem informações completas
3. Se não, busca detalhes completos do processo na API
4. Incrementa dados do cliente com `process_number`, `protocol_number`, `type`, `stage`

---

### 10. Cache de Clientes para Matching

**ID:** RF-010

**Descrição:** Manter cache em memória de clientes do AdvBox para otimizar matching.

**Funcionalidade:**
- `getAllCustomersForMatching()`: Busca todos os clientes com paginação
- Paginação: 100 clientes por request
- Agregação automática de todos os resultados

---

### 11. Transações Vencidas

**ID:** RF-011

**Descrição:** Exibir página dedicada com transações vencidas.

**Rota:** `GET /vencidas`

**Middleware:** `auth`, `verified`

**Filtros Específicos:**
- Data de vencimento < hoje
- Status: não pago

---

### 12. Auditoria

**ID:** RF-012

**Descrição:** Registrar todas as ações de criação/atualização de transações.

**Informações Registradas:**
- Ação (create/update)
- Tipo de entidade
- ID da entidade
- Usuário responsável
- Timestamp
- Dados enviados (payload)
- Campos modificados (para update)

---

## 🗂️ Modelos de Dados

### AdvboxTransaction

**Localização:** [app/Models/AdvboxTransaction.php](app/Models/AdvboxTransaction.php)

**Campos:**

```php
$fillable = [
    'tenant_id',              // ID do tenant (multi-tenancy)
    'advbox_id',              // ID da transação no AdvBox
    'type',                   // Tipo de transação
    'entry_type',             // 'revenue' ou 'expense'
    'date_due',               // Data de vencimento
    'date_payment',           // Data de pagamento (null se não pago)
    'competence',             // Competência (ex: 2026-02)
    'amount',                 // Valor (decimal: 2 casas)
    'description',            // Descrição
    'responsible',            // Responsável
    'category',               // Categoria
    'lawsuit_id',             // ID do processo
    'process_number',         // Número do processo
    'protocol_number',        // Número do protocolo
    'customer_name',          // Nome do cliente
    'customer_identification',// CPF/CNPJ do cliente
    'debit_bank',             // Banco devedor
    'credit_bank',            // Banco credor
    'cost_center',            // Centro de custo
    'synced_at',              // Última sincronização
];
```

**Cast (Tipos):**

```php
$casts = [
    'amount' => 'decimal:2',
    'date_due' => 'date',
    'date_payment' => 'date',
    'synced_at' => 'datetime',
];
```

**Relações:**

```php
public function tenant(): BelongsTo
```

**Scopes Disponíveis:**

| Scope | Descrição |
|-------|-----------|
| `forTenant(int $id)` | Filtrar por tenant |
| `paid()` | Transações pagas |
| `notPaid()` | Transações não pagas |
| `pending()` | Pendentes futuras |
| `overdue()` | Vencidas |
| `revenues()` | Tipos receita |
| `expenses()` | Tipos despesa |
| `fromDate(string $date)` | A partir da data |
| `toDate(string $date)` | Até a data |
| `hideFuturePending(int $days)` | Ocultar pendentes +N dias |
| `search(string $term)` | Busca textual |

---

## 📝 Exemplos de Uso

### Exemplo 1: Sincronizar Transações

```bash
php artisan advbox:sync --tenant=1
```

---

### Exemplo 2: Criar Transação

**JavaScript/Fetch:**

```javascript
const response = await fetch('/api/advbox/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
  },
  body: JSON.stringify({
    users_id: 5,
    entry_type: 'income',
    debit_account: 12,
    categories_id: 3,
    cost_centers_id: 2,
    amount: 1500.50,
    date_due: '2026-03-15',
    customers_id: 42,
    lawsuits_id: 789,
    description: 'Honorários de consultoria'
  })
});

const data = await response.json();
console.log(data.message); // "Transação criada com sucesso no AdvBox."
```

---

### Exemplo 3: Filtrar Transações com Query

```php
$transactions = AdvboxTransaction::where('tenant_id', $tenantId)
    ->revenues()
    ->notPaid()
    ->where('date_due', '>=', '2026-01-01')
    ->orderBy('date_due', 'asc')
    ->paginate(50);
```

---

### Exemplo 4: Matching de Cliente

```php
$advBoxService = app(AdvBoxService::class);
$customers = $advBoxService->getAllCustomersForMatching();

$transactionData = [
    'name' => 'João Silva Santos',
    'document' => '123.456.789-00',
    'pix_key' => '11987654321'
];

$match = $advBoxService->findMatchingCustomer(
    $transactionData,
    $customers,
    enrichLawsuits: true
);

if ($match) {
    echo "Cliente encontrado: " . $match['customer']['name'];
    echo "Tipo de match: " . $match['match_type'];
}
```

---

### Exemplo 5: Buscar Configurações Financeiras

```javascript
const response = await fetch('/api/advbox/financial-settings');
const settings = await response.json();

settings.categories.forEach(cat => {
  console.log(`${cat.name} (${cat.type})`);
});
```

---

## ❌ Tratamento de Erros

### Códigos de Status HTTP

| Código | Significado | Situação |
|--------|-------------|---------|
| 200 | OK | Requisição bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 422 | Unprocessable Entity | Validação falhou ou erro na API |
| 401 | Unauthorized | Não autenticado |
| 403 | Forbidden | Sem permissão (role) |
| 500 | Internal Server Error | Erro do servidor |

---

### Respostas de Erro Comuns

**Serviço não configurado:**

```json
{
  "message": "AdvBox não configurado para este tenant.",
  "status": 422
}
```

**Validação de formulário:**

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "amount": ["O valor deve ser maior que zero."],
    "date_due": ["A data de vencimento deve estar no formato AAAA-MM-DD."]
  }
}
```

**Operação falhou no AdvBox:**

```json
{
  "message": "Erro ao criar transação no AdvBox. Verifique os dados e tente novamente.",
  "status": 422
}
```

---

### Logs de Erro

Todos os erros são registrados em `storage/logs/laravel.log` com contexto:

```log
[2026-02-20 14:30:00] local.ERROR: AdvBox: Erro ao criar transação {
  "status": 422,
  "body": "Invalid category_id",
  "data": {...}
}
```

---

## 🔄 Fluxo Completo de Integração

```
┌─────────────────────────────────────┐
│    Usuário acessa /transacoes-box    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ AdvBoxController::transactions()     │
│  • Busca filtros da query            │
│  • Valida tenant                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Query AdvboxTransaction             │
│  • Aplica filtros                   │
│  • Calcula summary                  │
│  • Pagina resultados                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Retorna Inertia Response            │
│  • Transações formatadas            │
│  • Summary calculado                │
│  • Categorias únicas                │
│  • Última sincronização             │
└─────────────────────────────────────┘
```

---

## 🛠️ Configurações Avançadas

### Normalize de Dados

O serviço normaliza automaticamente dados antes de processar:

- **Documentos (CPF/CNPJ)**: Remove `., -, /`
- **Nomes**: Maiúscula, remove caracteres especiais
- **Telefones**: Remove pontuação, trata +55
- **Email**: Lowercase

```php
protected function normalizeDocument(string $document): string
{
    return preg_replace('/[^0-9]/', '', $document);
}

protected function normalizeName(string $name): string
{
    $name = mb_strtoupper($name, 'UTF-8');
    $name = preg_replace('/[^A-Z\s]/', '', $name);
    return preg_replace('/\s+/', ' ', trim($name));
}
```
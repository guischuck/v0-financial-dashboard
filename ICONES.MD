# 🏦 Obtenção de Ícones dos Bancos

## 📋 Visão Geral

O sistema HonorariosPay obtém os logos/ícones dos bancos através da integração **Pluggy**, que fornece imagens oficiais dos conectores (instituições financeiras). Esses logos são armazenados no banco de dados e exibidos na interface do usuário.

---

## 🔄 Fluxo de Obtenção dos Ícones

### 1. API Pluggy → Backend

```
┌─────────────────────────────────────┐
│      API Pluggy (pluggy.ai)         │
│  Retorna: connector.imageUrl        │
└──────────────────┬──────────────────┘
                   │
                   ▼
       ┌───────────────────────────┐
       │  PluggyController.php      │
       │  storeConnection()         │
       │  (linha 480-495)           │
       └───────────────┬───────────┘
                       │
                       ▼
       ┌─────────────────────────────┐
       │  PluggyItem::create()        │
       │  connector_logo armazenado  │
       └───────────────┬─────────────┘
                       │
                       ▼
       ┌─────────────────────────────┐
       │  Banco de Dados             │
       │  pluggy_items.connector_logo│
       └────────────────────────────┘
```

---

## 💾 Armazenamento no Banco de Dados

### Tabela: `pluggy_items`

**Localização da migração:** [database/migrations/2025_01_28_000001_create_pluggy_tables.php](database/migrations/2025_01_28_000001_create_pluggy_tables.php#L21)

```php
$table->string('connector_logo')->nullable();
```

**Exemplo de dados armazenados:**

```json
{
  "id": 1,
  "pluggy_item_id": "itm_abc123xyz",
  "connector_id": "546",
  "connector_name": "Banco do Brasil",
  "connector_logo": "https://cdn.pluggy.ai/connectors/546/logo.png",
  "status": "UPDATED",
  "last_updated_at": "2026-02-20T10:30:00Z"
}
```

---

## 🔌 Model Correspondente

**Arquivo:** [app/Models/PluggyItem.php](app/Models/PluggyItem.php#L20)

```php
protected $fillable = [
    'user_id',
    'tenant_id',
    'pluggy_item_id',
    'connector_id',
    'connector_name',
    'connector_logo',  // ← URL do logo do banco
    'status',
    'execution_status',
    'last_updated_at',
    'next_auto_sync_at',
    'products',
    'error',
];
```

---

## 🛠️ Implementação no Backend

### 1. Controlador que Armazena o Logo

**Arquivo:** [app/Http/Controllers/PluggyController.php](app/Http/Controllers/PluggyController.php#L488)

**Método:** `storeConnection()`

```php
// Linha 480-495
$item = PluggyItem::create([
    'user_id' => $user->id,
    'tenant_id' => $user->tenant_id,
    'pluggy_item_id' => $itemId,
    'connector_id' => $itemData['connector']['id'] ?? null,
    'connector_name' => $itemData['connector']['name'] ?? null,
    'connector_logo' => $itemData['connector']['imageUrl'] ?? null,  // ← Logo obtido aqui
    'status' => $itemData['status'] ?? 'UPDATING',
    'execution_status' => $itemData['executionStatus'] ?? null,
    'last_updated_at' => isset($itemData['lastUpdatedAt']) ? now()->parse($itemData['lastUpdatedAt']) : null,
    'next_auto_sync_at' => isset($itemData['nextAutoSyncAt']) ? now()->parse($itemData['nextAutoSyncAt']) : null,
    'products' => $itemData['parameter']['products'] ?? null,
]);
```

**Fluxo:**
1. Função recebe `$itemData` da API Pluggy
2. Extrai `$itemData['connector']['imageUrl']`
3. Armazena na coluna `connector_logo`

---

### 2. Recuperação no Controlador da Dashboard

**Arquivo:** [app/Http/Controllers/DashboardController.php](app/Http/Controllers/DashboardController.php#L64)

```php
// Linhas 40-75
$items = PluggyItem::with(['accounts' => function ($query) {
    $query->orderBy('type')->orderBy('name');
}])
    ->orderBy('created_at', 'desc')
    ->get();

$accounts = [];

foreach ($items as $item) {
    foreach ($item->accounts as $account) {
        $accountData = [
            'id' => $account->id,
            'name' => $account->name,
            'type' => $account->type,
            'balance' => (float) $account->balance,
            'bank_name' => $item->connector_name,
            'bank_logo' => $item->connector_logo,  // ← Logo é passado aqui
            'status' => $item->status,
            'last_updated_at' => $item->last_updated_at?->toISOString(),
        ];

        $accounts[] = $accountData;
    }
}

return Inertia::render('Dashboard', [
    'accounts' => $accounts,
    // ...
]);
```

---

### 3. Recuperação na Conciliação

**Arquivo:** [app/Http/Controllers/ReconciliationController.php](app/Http/Controllers/ReconciliationController.php#L160)

Em dois locais diferentes:

```php
// Linha 160
'bank_logo' => $pluggyTx->account->item->connector_logo ?? null,

// Linha 375
'bank_logo' => $pluggyTx->account->item->connector_logo ?? null,
```

---

## 🎨 Exibição no Frontend

### Componente React

**Arquivo:** [resources/js/components/dashboard/bank-accounts-summary.tsx](resources/js/components/dashboard/bank-accounts-summary.tsx)

**Interface TypeScript:**

```typescript
export interface AccountInfo {
    id: number;
    name: string;
    type: 'BANK' | 'CREDIT';
    balance: number;
    bank_name: string;
    bank_logo: string | null;  // ← URL do logo
    status: string;
    last_updated_at: string | null;
    reconciled_percent?: number;
}
```

**Renderização do Logo (linhas 71-84):**

```tsx
{/* Bank logo */}
<div className="flex-shrink-0">
    {account.bank_logo ? (
        <img
            src={account.bank_logo}
            alt={account.bank_name}
            className="h-8 w-8 rounded-full object-contain"
        />
    ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            {account.type === 'CREDIT' ? (
                <CreditCard className="h-4 w-4 text-purple-500" />
            ) : (
                <Building2 className="h-4 w-4 text-blue-500" />
            )}
        </div>
    )}
</div>
```

**Comportamento:**

1. **Se `bank_logo` existe**: Exibe a imagem do logo
   - Tamanho: 8x8 unidades CSS (32px)
   - Arredondado: `rounded-full`
   - Ajuste: `object-contain`

2. **Se `bank_logo` é null**: Exibe ícone fallback
   - Cartão de crédito: ícone roxo
   - Conta bancária: ícone azul
   - Usa ícones do Lucide React

---

## 🔗 Estrutura de URLs de Logos

### Exemplo de URLs Reais

```
https://cdn.pluggy.ai/connectors/546/logo.png           (Banco do Brasil)
https://cdn.pluggy.ai/connectors/612/logo.png           (Caixa)
https://cdn.pluggy.ai/connectors/655/logo.png           (Itaú)
https://cdn.pluggy.ai/connectors/629/logo.png           (Santander)
https://cdn.pluggy.ai/connectors/635/logo.png           (Bradesco)
```

### Padrão de URL

```
https://cdn.pluggy.ai/connectors/{connector_id}/logo.png
```

**Onde:**
- `connector_id` = ID único do conector na plataforma Pluggy
- Todos os logos estão hospedados na CDN do Pluggy

---

## 📊 Fluxo Completo End-to-End

```
┌────────────────────────────────────┐
│   1. Usuário conecta banco         │
│      (clica em "Conectar")         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   2. Widget Pluggy abre            │
│      (frontend/JavaScript)         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   3. Usuário seleciona banco       │
│      e valida credenciais          │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   4. API Pluggy retorna:           │
│      - itemId                      │
│      - connector.name              │
│      - connector.imageUrl          │
│      - connector.id                │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   5. PluggyController armazena     │
│      connector_logo no banco       │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   6. DashboardController recupera  │
│      bank_logo (connector_logo)    │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   7. Inertia passa para React      │
│      (Prop: accounts[].bank_logo)  │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   8. BankAccountsSummary renderiza │
│      - <img src={account.bank_logo}│
│      - ou ícone fallback           │
└────────────────────────────────────┘
```

---

## 🔍 Localização dos Arquivos

| Componente | Arquivo | Linha |
|-----------|---------|-------|
| **Integração Pluggy** | [app/Services/PluggyService.php](app/Services/PluggyService.php) | - |
| **Armazenamento do Logo** | [app/Http/Controllers/PluggyController.php](app/Http/Controllers/PluggyController.php#L488) | 488 |
| **Recuperação (Dashboard)** | [app/Http/Controllers/DashboardController.php](app/Http/Controllers/DashboardController.php#L64) | 64 |
| **Recuperação (Conciliação)** | [app/Http/Controllers/ReconciliationController.php](app/Http/Controllers/ReconciliationController.php#L160) | 160, 375 |
| **Model Pluggy** | [app/Models/PluggyItem.php](app/Models/PluggyItem.php#L20) | 20 |
| **Migração DB** | [database/migrations/2025_01_28_000001_create_pluggy_tables.php](database/migrations/2025_01_28_000001_create_pluggy_tables.php#L21) | 21 |
| **Componente React** | [resources/js/components/dashboard/bank-accounts-summary.tsx](resources/js/components/dashboard/bank-accounts-summary.tsx) | 71-84 |
| **Interface TS** | [resources/js/components/dashboard/bank-accounts-summary.tsx](resources/js/components/dashboard/bank-accounts-summary.tsx#L19) | 19-25 |

---

## 🐛 Tratamento de Erros

### Cenário: Logo indisponível

```tsx
// Fallback automático quando bank_logo é null
{account.bank_logo ? (
    <img src={account.bank_logo} alt={account.bank_name} />
) : (
    // Exibe ícone genérico
    <Building2 className="h-4 w-4" />
)}
```

### Motivos comuns:

1. **API Pluggy retornou null** → Banco não possui logo personalizado
2. **Erro na sincronização** → Campo `connector_logo` ficou vazio
3. **URL quebrada** → CDN Pluggy indisponível (raro)

---

## 🚀 Atualização de Logos

### Como são atualizados?

Os logos são sincronizados quando:

1. **Primeira conexão**: Armazenado em `storeConnection()`
2. **Re-sincronização**: Ao atualizar a conexão via `updateItem()`
3. **Manual**: Quando usuário clica em "Sincronizar"

### Código de Re-sincronização

**Arquivo:** [app/Http/Controllers/PluggyController.php](app/Http/Controllers/PluggyController.php)

```php
public function syncItem(PluggyItem $item): JsonResponse
{
    // Obtém dados atualizados da API Pluggy
    $itemData = $this->pluggyService->getItem($item->pluggy_item_id);
    
    // Atualiza com novo logo (se fornecido)
    $item->update([
        'connector_logo' => $itemData['connector']['imageUrl'] ?? $item->connector_logo,
        'status' => $itemData['status'],
        // ...
    ]);
    
    return response()->json(['success' => true]);
}
```

---

## 📝 Exemplo de Resposta da API Pluggy

Quando você conecta um banco, a API Pluggy retorna:

```json
{
  "id": "itm_abc123xyz",
  "status": "UPDATED",
  "connector": {
    "id": 546,
    "name": "Banco do Brasil",
    "imageUrl": "https://cdn.pluggy.ai/connectors/546/logo.png",
    "type": "PERSONAL_BANK"
  },
  "accounts": [
    {
      "id": "acc_xyz789",
      "type": "BANK",
      "name": "Conta Corrente",
      "number": "12345-6",
      "balance": 5000.00
    }
  ]
}
```

---

## ✅ Checklist de Implementação

- [x] Logo vem de `connector.imageUrl` (API Pluggy)
- [x] Armazenado em `pluggy_items.connector_logo`
- [x] Passado para frontend via Inertia props
- [x] Exibido no componente `BankAccountsSummary`
- [x] Fallback de ícone quando logo não existe
- [x] URL segura (HTTPS)
- [x] Cache implementado (PluggyService)
- [x] Logs de erro configurados

---

## 🔐 Segurança

| Aspecto | Status |
|--------|--------|
| Logos servidos via HTTPS | ✅ |
| CDN Pluggy confiável | ✅ |
| Sem armazenamento local de imagens | ✅ |
| Sem manipulação de URL no frontend | ✅ |
| Validação de tipo MIME | ✅ |

---

## 📚 Referências

- **Documentação Pluggy:** https://pluggy.ai/developers
- **CDN de Logos:** https://cdn.pluggy.ai/connectors/
- **Integração no projeto:** [ADVBOX_INTEGRATION.md](ADVBOX_INTEGRATION.md)
- **Modelos de dados:** [app/Models/PluggyItem.php](app/Models/PluggyItem.php)

---

**Última atualização:** Fevereiro 20, 2026  
**Versão:** 1.0  
**Status:** ✅ Documentado

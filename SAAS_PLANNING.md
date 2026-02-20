# 🚀 Planejamento: Transformação em SaaS Multi-Tenant

## Visão Geral

Transformar o dashboard de conciliação bancária atual em um SaaS escalável com suporte a múltiplas empresas (multi-tenant), autenticação segura e configuração individualizada de APIs por tenant.

---

## 📐 Arquitetura Multi-Tenant

### Modelo de Isolamento
Utilizaremos o modelo **Shared Database, Separate Schema** (ou por campo `tenant_id`):
- Banco de dados único (PostgreSQL via Supabase ou Neon)
- Cada registro possui um campo `tenant_id` (UUID) vinculado à empresa
- Isolamento garantido por Row-Level Security (RLS) no banco

### Estrutura de Tenants
```
Tenant (Empresa)
├── id (UUID)
├── name (nome da empresa)
├── slug (ex: "advbox-sa") ← usado na URL: app.dominio.com/[slug]/dashboard
├── plan (free | pro | enterprise)
├── created_at
└── settings
    ├── pluggy_api_key (AES-256 encrypted)
    ├── pluggy_webhook_secret
    ├── advbox_api_key (AES-256 encrypted)
    └── advbox_api_url
```

---

## 🔐 Fase 1 — Autenticação (Login)

### Stack Recomendada
- **[NextAuth.js v5](https://authjs.dev/)** ou **[Clerk](https://clerk.com/)** (mais rápido de implementar)
- Banco de dados: **Supabase** (PostgreSQL + Auth integrado) ou **PlanetScale**

### O que implementar

#### 1.1 Páginas de Auth
- `/login` — tela de login (email/senha + Google OAuth opcional)
- `/register` — criação de conta + empresa
- `/forgot-password` — recuperação de senha
- `/auth/callback` — callback OAuth

#### 1.2 Fluxo de Cadastro
```
Usuário cria conta
    → Informa nome da empresa
    → Sistema cria registro em `tenants`
    → Usuário associado como admin do tenant
    → Redireciona para onboarding (configuração de APIs)
```

#### 1.3 Controle de Acesso (RBAC)
| Role        | Permissões                                |
|-------------|-------------------------------------------|
| `owner`     | Tudo — gerenciar usuários, deletar tenant |
| `admin`     | Configurar APIs, convidar usuários        |
| `member`    | Visualizar dashboard, exportar dados      |
| `viewer`    | Somente leitura                           |

#### 1.4 Middleware de Proteção
- Middleware Next.js intercepta todas as rotas `/dashboard/*`
- Valida sessão + verifica `tenant_id` do usuário
- Redireciona para `/login` se não autenticado

---

## 🏗️ Fase 2 — Multi-Tenant

### 2.1 Estrutura de Rotas (App Router)
```
app/
├── (auth)/                    ← grupo de rotas públicas
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
├── (dashboard)/               ← grupo protegido por middleware
│   ├── layout.tsx             ← inject tenant context
│   ├── dashboard/page.tsx     ← página principal atual
│   ├── configuracoes/page.tsx ← configuração de APIs
│   ├── usuarios/page.tsx      ← gerenciar membros do tenant
│   └── planos/page.tsx        ← planos e billing
├── api/
│   ├── auth/[...nextauth]/    ← endpoints de autenticação
│   ├── tenant/                ← CRUD de tenant
│   ├── settings/              ← salvar/ler configurações criptografadas
│   └── pluggy/                ← proxy seguro para Pluggy API
│   └── advbox/                ← proxy seguro para Advbox API
└── middleware.ts              ← proteção de rotas + resolução de tenant
```

### 2.2 Resolução de Tenant
Estratégia por **subdomínio** ou **path**:
- **Subdomínio** (recomendado para SaaS maduro): `empresa.app.dominio.com`
- **Path** (mais simples para começar): `app.dominio.com/dashboard` (tenant via sessão)

### 2.3 Banco de Dados — Tabelas Principais
```sql
-- Empresas
tenants (id, name, slug, plan, created_at)

-- Usuários
users (id, email, name, avatar_url, created_at)

-- Relação usuário-tenant (suporte a múltiplas empresas)
tenant_users (id, tenant_id, user_id, role, invited_at, joined_at)

-- Configurações criptografadas por tenant
tenant_settings (id, tenant_id, pluggy_api_key_enc, advbox_api_key_enc, ...)

-- Log de auditoria
audit_logs (id, tenant_id, user_id, action, metadata, created_at)
```

---

## ⚙️ Fase 3 — Página de Configurações

### 3.1 Seções da Página `/configuracoes`

#### Configurações de Integração (Pluggy)
- Campo: `Pluggy API Key` (input tipo password com toggle)
- Campo: `Pluggy Webhook Secret`
- Botão: "Testar Conexão" → faz chamada de validação na API Pluggy
- Status visual: ✅ Conectado / ❌ Erro de autenticação

#### Configurações de Integração (Advbox)
- Campo: `Advbox API Key` (input tipo password com toggle)
- Campo: `Advbox API URL` (ex: `https://api.advbox.com.br`)
- Botão: "Testar Conexão"
- Status visual: ✅ Conectado / ❌ Erro de autenticação

#### Informações da Empresa
- Nome da empresa
- Slug (URL amigável)
- Logo (upload)
- Fuso horário

#### Membros e Permissões
- Listar membros com seus papéis
- Convidar por e-mail
- Alterar roles / remover membros

#### Plano e Faturamento
- Plano atual
- Data de renovação
- Link para upgrade (integração Stripe)

### 3.2 Segurança das Chaves de API
- As chaves **nunca são armazenadas em texto puro**
- Criptografia: **AES-256-GCM** usando uma `ENCRYPTION_KEY` como variável de ambiente
- Na exibição: mostrar apenas os últimos 4 caracteres (`••••••••••••abcd`)
- Ao salvar: re-criptografar e sobrescrever

---

## 📦 Fase 4 — Infraestrutura e Deploy

### Stack Técnica
| Camada         | Tecnologia                               |
|----------------|------------------------------------------|
| Frontend/API   | Next.js 15 (App Router)                  |
| Auth           | Clerk ou NextAuth.js v5                  |
| Banco de dados | Supabase (PostgreSQL + Auth)             |
| ORM            | Prisma ou Drizzle ORM                    |
| Criptografia   | Node.js crypto (AES-256-GCM)            |
| Deploy         | Vercel                                   |
| Pagamentos     | Stripe (fase futura)                     |
| E-mail         | Resend (convites, recuperação de senha)  |

### Variáveis de Ambiente
```env
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database
DATABASE_URL=

# Criptografia
ENCRYPTION_KEY=   # 32 bytes aleatórios (gerado via openssl rand -hex 32)

# APIs externas (usadas no proxy seguro)
# Não armazenar aqui — vêm do banco por tenant!

# Clerk (se usar)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

---

## 📋 Checklist de Implementação

### Fase 1 — Auth + Base
- [ ] Instalar e configurar Clerk (ou NextAuth.js)
- [ ] Criar schema do banco (Prisma/Drizzle)
- [ ] Criar migrations: `tenants`, `users`, `tenant_users`
- [ ] Página `/login`
- [ ] Página `/register` com criação de tenant
- [ ] Middleware de proteção de rotas
- [ ] Hook `useTenant()` para acessar contexto do tenant atual

### Fase 2 — Multi-tenant
- [ ] Injetar `tenant_id` em todas as queries do banco
- [ ] Configurar Row-Level Security (RLS) no Supabase
- [ ] Adaptar APIs `/api/pluggy/*` e `/api/advbox/*` para usar chaves por tenant
- [ ] Página `/usuarios` com convites e gerenciamento de roles

### Fase 3 — Configurações
- [ ] Migration: `tenant_settings`
- [ ] Funções de encrypt/decrypt (AES-256-GCM)
- [ ] API Route: `POST /api/settings` (salvar chaves criptografadas)
- [ ] API Route: `GET /api/settings` (retornar chaves mascaradas)
- [ ] API Route: `POST /api/settings/test-pluggy` (validar chave)
- [ ] API Route: `POST /api/settings/test-advbox` (validar chave)
- [ ] Página `/configuracoes` com todas as seções

### Fase 4 — Testes e Deploy
- [ ] Testes E2E (Playwright)
- [ ] Configurar Vercel com variáveis de ambiente
- [ ] Configurar domínio customizado
- [ ] Monitoramento (Sentry)

---

## 🗓️ Estimativa de Tempo

| Fase                        | Estimativa |
|-----------------------------|------------|
| Fase 1 — Auth + Base        | 3–5 dias   |
| Fase 2 — Multi-tenant       | 3–4 dias   |
| Fase 3 — Configurações      | 2–3 dias   |
| Fase 4 — Infra + Deploy     | 1–2 dias   |
| **Total**                   | **~2 semanas** |

---

## 🔜 Próximos Passos Imediatos

1. **Decidir stack de auth** → Clerk (mais rápido) ou NextAuth.js (mais controle)
2. **Criar projeto no Supabase** → banco de dados + auth
3. **Definir se o modelo de URL será por path ou subdomínio**
4. Iniciar pela **Fase 1** — login/registro + proteção de rotas

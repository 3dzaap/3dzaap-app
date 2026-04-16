# 3DZAAP Print Manager — SaaS Blueprint
**v1.3 · Março 2026 · MVP Homologado & Launch Ready**  
Stack: `HTML/Vanilla JS (MVP)` → `Next.js` · `TypeScript` · `Supabase` · `Stripe` · `Cloudflare`  
Módulos: Calculadora · Filamentos · Pedidos · Financeiro · BackOffice · Catálogo de Impressoras

---

## 0. Estado Atual do Projeto (Progresso)
- **Frontend / MVP (Concluído):** A aplicação HTML/Vanilla CSS (`index.html`, `dashboard.html`, `orders.html`, etc.) está 100% funcional, animada e homologada para lançamento.
- **Backend / Supabase (Concluído):**
  - Conexão e credenciais validadas.
  - **RLS (Row Level Security):** Script final de isolamento multi-tenant pronto no ficheiro `/DOC/supabase_rls_script.md`.
  - **Onboarding:** Fluxo de 4 passos com configuração inicial de máquinas/materiais live.
- **Próximos Passos (Evolução SaaS):** Iniciar a reescrita da UI para a arquitetura Next.js 14, preservando a lógica de negócio já validada no MVP.

---

## 1. Sumário Executivo

SaaS multi-tenant para gestão profissional de pequenos negócios de impressão 3D. Migra uma aplicação HTML monolítica homologada para arquitetura cloud-native escalável, segura e monetizável.

**Objetivos principais:**
- Preservar 100% da lógica de negócio e cálculos homologados no HTML original
- Multi-tenancy com isolamento completo por empresa (Supabase RLS)
- Monetização via planos (Trial / Starter / Pro / Business) com Stripe
- Deploy serverless em Cloudflare Pages + Supabase Edge Functions
- Personalização de marca (logo, cores, nome) no plano Business

**Stack de decisões:**

| Dimensão | Decisão Técnica |
|---|---|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| Billing | Stripe (cartão, Apple/Google Pay, SEPA, Pix) |
| Infra/CDN | Cloudflare Pages + Workers + R2 |
| CI/CD | GitHub Actions |
| Monorepo | Turborepo + pnpm workspaces |

---

## 2. Arquitetura do Sistema

**Padrão BFF** (Backend For Frontend). Next.js como orquestrador principal; Supabase via SDK client-side (operações com RLS) e via Edge Functions (lógica sensível e Stripe webhooks).

**Fluxo de dados:**
```
Browser → Cloudflare CDN → Next.js (Cloudflare Pages)
Next.js → Supabase JS Client → Postgres (RLS ativo)
Next.js → Supabase Edge Functions → Stripe API
Stripe → Edge Function webhook → Postgres (atualiza subscriptions)
Supabase Storage → Cloudflare R2 (logos, assets Business)
```

**Princípios de design:**
- **Tenant Isolation First** — RLS ativo em todas as tabelas com dados de empresa
- **Feature Gating no servidor** — plano verificado na Edge Function antes de qualquer operação sensível
- **Optimistic UI** — React Query com mutações otimistas para UX instantânea
- **Type Safety end-to-end** — types gerados do schema Supabase + Zod validation
- **Zero downtime deploys** — Cloudflare Pages atomic deployments

---

## 3. Estrutura de Pastas (Monorepo)

```
3dzaap/
├── apps/
│   └── web/                        # Next.js 14 App Router
│       ├── app/
│       │   ├── (auth)/             # Login, Signup, Reset Password
│       │   ├── (dashboard)/        # Área autenticada
│       │   │   ├── layout.tsx      # Sidebar + tenant context
│       │   │   ├── calculator/
│       │   │   ├── filaments/
│       │   │   ├── orders/
│       │   │   ├── financial/
│       │   │   ├── backoffice/
│       │   │   ├── settings/
│       │   │   └── billing/
│       │   ├── (marketing)/        # Landing page pública
│       │   └── api/webhooks/stripe/route.ts
│       ├── components/
│       │   ├── ui/                 # Re-exports shadcn/ui
│       │   ├── layout/             # Sidebar, Header, Breadcrumb
│       │   ├── calculator/
│       │   ├── filaments/
│       │   ├── orders/
│       │   ├── financial/
│       │   └── billing/            # PlanCard, UpgradeModal
│       ├── lib/
│       │   ├── supabase/           # Client + server helpers
│       │   ├── stripe/
│       │   └── utils.ts
│       └── hooks/                  # React Query hooks por módulo
├── services/api/                   # Supabase Edge Functions
│   ├── stripe-checkout/
│   ├── stripe-portal/
│   ├── stripe-webhook/
│   └── export-csv/
├── packages/
│   ├── ui/                         # Design system compartilhado
│   ├── config/                     # ESLint, TS, Tailwind configs
│   ├── types/                      # Types + DB types
│   └── utils/
│       ├── calculator.ts           # Lógica de cálculo (homologada)
│       └── formatters.ts
├── database/
│   ├── migrations/
│   └── seeds/
├── infra/
│   ├── cloudflare/
│   └── stripe/
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 4. Schema SQL

PostgreSQL 15+ via Supabase. Todas as tabelas com dados de tenant incluem `company_id` com RLS.

### companies
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B8FD4',
  accent_color TEXT DEFAULT '#F5943A',
  plan_id UUID REFERENCES plans(id),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### plans
```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- 'trial' | 'starter' | 'pro' | 'business'
  display_name TEXT NOT NULL,
  price_eur DECIMAL(10,2) NOT NULL,
  price_brl DECIMAL(10,2),
  stripe_price_id_eur TEXT,
  stripe_price_id_brl TEXT,
  features JSONB DEFAULT '{}',  -- { calculator, filaments, orders, financial, customization }
  max_users INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing', -- trialing | active | past_due | canceled | unpaid
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### memberships
```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_company ON memberships(company_id);
```

### filaments
```sql
CREATE TABLE filaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,       -- PLA | PETG | ABS | TPU | ASA | Nylon | PC | HIPS | PVA | Wood | Carbon | Metal
  variation TEXT NOT NULL,  -- Basic | Generic | + | PRO | Matte | Silk | Glow | Marble | Galaxy | Sparkle | Dual | High Speed | Hyper
  color TEXT NOT NULL,
  color_hex TEXT,
  brands TEXT[] NOT NULL DEFAULT '{}',
  roll_size TEXT NOT NULL DEFAULT '1kg', -- 1kg | 500g | 300g | 250g | 100g
  total INTEGER NOT NULL DEFAULT 0,
  in_use INTEGER NOT NULL DEFAULT 0,
  new_rolls INTEGER GENERATED ALWAYS AS (GREATEST(0, total - in_use)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE filaments ADD CONSTRAINT chk_in_use_lte_total CHECK (in_use <= total);
ALTER TABLE filaments ADD CONSTRAINT chk_total_gte_zero CHECK (total >= 0);
```

### orders & order_items
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,    -- PED-0001
  order_numeric INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  status TEXT NOT NULL DEFAULT 'orcamento', -- orcamento | modelagem | validacao | aprovado | printing | done
  payment_status TEXT NOT NULL DEFAULT 'pendente', -- pendente | pago
  payment_date DATE,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INTEGER DEFAULT 0
);
```

### settings
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  calc_filament_price DECIMAL(10,2) DEFAULT 25.00,
  calc_printer_price DECIMAL(10,2) DEFAULT 600.00,
  calc_printer_life INTEGER DEFAULT 5000,
  calc_power_consumption INTEGER DEFAULT 200,
  calc_electricity_price DECIMAL(10,4) DEFAULT 0.22,
  calc_failure_rate DECIMAL(5,2) DEFAULT 5.00,
  calc_indirect_costs DECIMAL(5,2) DEFAULT 10.00,
  calc_profit_margin DECIMAL(5,2) DEFAULT 30.00,
  last_order_number INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  stripe_payment_id TEXT UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL,              -- succeeded | failed | pending
  payment_method_type TEXT,          -- card | sepa_debit | pix | apple_pay | google_pay
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Políticas RLS

Principal camada de isolamento multi-tenant.

### Helper Functions
```sql
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT company_id FROM memberships WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_company_admin(cid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid() AND company_id = cid AND role IN ('owner', 'admin')
  );
$$;
```

### Políticas por Tabela
```sql
-- FILAMENTS (padrão replicado para orders, order_items, settings)
ALTER TABLE filaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY filaments_select ON filaments FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY filaments_insert ON filaments FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY filaments_update ON filaments FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY filaments_delete ON filaments FOR DELETE USING (company_id = get_user_company_id());

-- SUBSCRIPTIONS (escrita apenas por Edge Functions via service role)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_read ON subscriptions FOR SELECT USING (company_id = get_user_company_id());

-- COMPANIES
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_read ON companies FOR SELECT USING (id = get_user_company_id());
CREATE POLICY company_update ON companies FOR UPDATE USING (is_company_admin(id));
```

---

## 6. Módulos do Sistema

### 6.1 Calculadora
**Planos:** Trial · Starter · Pro · Business

**Campos de entrada (defaults homologados):**

| Campo | Tipo | Default |
|---|---|---|
| filamentPrice | €/kg | 25 |
| partWeight | g | 50 |
| printTime | h | 3 |
| printerPrice | € | 600 |
| printerLife | h | 5000 |
| powerConsumption | W | 200 |
| electricityPrice | €/kWh | 0.22 |
| failureRate | % | 5 |
| indirectCosts | % | 10 |
| profitMargin | % | 30 |

**Fórmulas (não alterar):**
```ts
// packages/utils/calculator.ts
export function calculate(inputs: CalculatorInputs): CalculatorResults {
  const filamentCost = (inputs.filamentPrice / 1000) * inputs.partWeight;
  const amortizationCost = (inputs.printerPrice / inputs.printerLife) * inputs.printTime;
  const electricityCost = (inputs.powerConsumption / 1000) * inputs.printTime * inputs.electricityPrice;
  const baseCost = filamentCost + amortizationCost + electricityCost;
  const failureCost = baseCost * (inputs.failureRate / 100);
  const indirectCost = baseCost * (inputs.indirectCosts / 100);
  const marginCost = (baseCost + failureCost + indirectCost) * (inputs.profitMargin / 100);
  const finalPrice = baseCost + failureCost + indirectCost + marginCost;
  return { filamentCost, amortizationCost, electricityCost, baseCost, failureCost, indirectCost, marginCost, finalPrice };
}
```

**Funcionalidades:** Calcular · Reset · Exportar CSV · Copiar para clipboard

**Implementado:**
- Botão "Criar Pedido com estes dados" — pré-preenche o módulo de Pedidos via query string/sessionStorage e regista despesa automática de material no módulo Financeiro (v1.3).

**Melhorias planeadas (v1.4):**
- Modo Resina (toggle FDM/Resina) com campos: `resinPrice`, `resinVolume`, `resinDensity`, `washTime`, `cureTime`, `uvLampPower`

### 6.2 Filamentos
**Planos:** Trial · Starter · Pro · Business

**Campos:** `type` (12 opções) · `variation` (13 opções) · `color` (catálogo 60+ cores + custom) · `brands` (multi-select, 30+ marcas) · `rollSize` · `total` · `inUse` · `newRolls` (calculado: `MAX(0, total - inUse)`)

**Regras de negócio:** status visual verde/amarelo/vermelho · inUse auto-ajustado se total reduzido · badge pulsante em esgotado

**Ações:** Adicionar · Editar · Excluir · Exportar CSV · Filtros por tipo/cor/marca/variação

### 6.3 Pedidos
**Planos:** Trial · Pro · Business

**Pipeline de status:** `orcamento → modelagem → validacao → aprovado → printing → done`

**Numeração:** PED-XXXX (sequencial por empresa)

**Campos principais:** clientName · clientEmail · clientPhone · itens (description + quantity + unitPrice) · status · paymentStatus · createdAt · dueDate · notes

**Funcionalidades:** Total automático por item e pedido · paymentDate gerada ao marcar pago · Receipt/OS em PDF com logo da empresa

### 6.4 Financeiro
**Planos:** Trial · Business

**Métricas por período (mês):**
```
revenue = SUM(total) WHERE paymentStatus = 'pago'
pendingRevenue = SUM(total) WHERE paymentStatus = 'pendente'
completedOrders = COUNT() WHERE status = 'done'
avgValue = SUM(total) / COUNT()
```

**Exportações:** CSV Financeiro · CSV Orçamento (pedidos pendentes)

### 6.5 BackOffice
**Planos:** Todos

**Operações de backup/restauro:** Exportar/Importar Filamentos · Exportar/Importar Pedidos · Backup Geral (combinado) · Restaurar Backup — todos em CSV com preview e opção merge/substituir

**Backup automático:** diário à meia-noite, máximo 7 backups no histórico · Log de atividade com timestamps

---

## 7. Sistema de Planos

| Plano | EUR/mês | Módulos | Extras |
|---|---|---|---|
| Trial | Grátis | Todos | 7 dias; sem cartão |
| Starter | €9.90 | Calculadora + Filamentos | — |
| Pro | €19.90 | Starter + Pedidos | — |
| Business | €39.90 | Pro + Financeiro + BackOffice | Personalização marca; multi-user |

### Feature Gating (duplo nível)
```ts
// packages/utils/plans.ts
export const PLAN_FEATURES = {
  trial:    { calculator: true,  filaments: true,  orders: true,  financial: true,  customization: true  },
  starter:  { calculator: true,  filaments: true,  orders: false, financial: false, customization: false },
  pro:      { calculator: true,  filaments: true,  orders: true,  financial: false, customization: false },
  business: { calculator: true,  filaments: true,  orders: true,  financial: true,  customization: true  },
};
export function canAccess(plan: PlanName, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.[feature] ?? false;
}
```

- **UI Level:** `<FeatureGate>` bloqueia elementos e exibe modal de upgrade
- **API Level:** Edge Function verifica plano antes de qualquer operação sensível

---

## 8. Integração Stripe

### Setup de Produtos/Preços
```bash
stripe products create --name='3DZAAP Starter' --id='prod_starter'
stripe products create --name='3DZAAP Pro' --id='prod_pro'
stripe products create --name='3DZAAP Business' --id='prod_business'

# EUR (mensal)
stripe prices create --product=prod_starter --unit-amount=990  --currency=eur --recurring[interval]=month
stripe prices create --product=prod_pro     --unit-amount=1990 --currency=eur --recurring[interval]=month
stripe prices create --product=prod_business --unit-amount=3990 --currency=eur --recurring[interval]=month

# BRL
stripe prices create --product=prod_starter  --unit-amount=4990  --currency=brl --recurring[interval]=month
stripe prices create --product=prod_pro      --unit-amount=9990  --currency=brl --recurring[interval]=month
stripe prices create --product=prod_business --unit-amount=19990 --currency=brl --recurring[interval]=month
```

**Métodos de pagamento:** Europa — Cartão · Apple Pay · Google Pay · SEPA | Brasil — Cartão · Pix

### Eventos Webhook Processados

| Evento | Ação | Campos |
|---|---|---|
| `checkout.session.completed` | Cria/atualiza subscription | status, stripe_subscription_id |
| `customer.subscription.updated` | Atualiza plano/status | plan_id, status |
| `customer.subscription.deleted` | Cancela subscription | status = canceled |
| `invoice.payment_succeeded` | Regista pagamento | amount, status = succeeded |
| `invoice.payment_failed` | Marca falha | status = past_due |

---

## 9. Autenticação

Supabase Auth com JWT em cookie HttpOnly via `@supabase/ssr`.

**Fluxos:** Email+Password · Google OAuth · Password Reset · Magic Link

### Onboarding pós-signup
1. Signup → middleware verifica company → redirect `/onboarding`
2. Formulário: nome + slug → cria `company` + `membership(owner)` + `settings(defaults)` + trial subscription
3. Redirect para dashboard

### Middleware Next.js
```ts
export async function middleware(request: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard') ||
                      request.nextUrl.pathname.startsWith('/calculator');
  if (isDashboard && !session) return NextResponse.redirect(new URL('/login', request.url));
  if (session && request.nextUrl.pathname === '/login') return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

---

## 10. Multi-Tenancy

Isolamento garantido por `company_id` em todas as tabelas + RLS automático via `get_user_company_id()`. Sem possibilidade de cross-tenant access via API pública.

### TenantContext Provider
```ts
interface TenantContext {
  company: Company;
  subscription: Subscription;
  plan: Plan;
  features: PlanFeatures;
  canAccess: (feature: Feature) => boolean;
}
// Uso: if (!canAccess('financial')) return <UpgradeModal feature='financial' />;
```

### Personalização Business
- Logo → Supabase Storage → exibido no header e receipts
- Cor primária/destaque → CSS variables `--primary-color` / `--accent-color`
- Nome da empresa → header, receipts e documentos

---

## 11. Landing Page

SSG via Next.js App Router, deployada no Cloudflare CDN.

**Secções:** Hero (CTA "Começar Trial Grátis") · Features (4 cards) · Como Funciona (3 passos) · Pricing (4 planos) · Testimonials · FAQ (8–10 perguntas) · CTA Final · Footer

**SEO:** `generateMetadata` · OpenGraph via `@vercel/og` · Schema.org `SoftwareApplication` · Core Web Vitals otimizados

---

## 12. Dashboard

### Layout
Sidebar fixa (desktop) / drawer (mobile). Header com logo, nome do utilizador e menu de conta.

| Elemento | Comportamento |
|---|---|
| Sidebar | Links por módulo; badges de acesso restrito |
| Score de Saúde | Card 0–100 com anel animado, 3 insights e delta vs sessão anterior *(ver 12.3)* |
| Home | Receita do mês, pedidos ativos, filamentos esgotados, próximas entregas |
| Subscription Banner | Estado trial / active / expired |
| Upgrade Modal | Comparação de planos ao tentar aceder feature bloqueada |
| Dark Mode | Toggle no header; persiste em localStorage |

### 12.3 Score de Saúde do Negócio *(v1.1)*

Feature anti-churn. Score 0–100 actualizado uma vez por dia; delta vs sessão anterior guardado em `localStorage` (`3dzaap_health_prev`).

| Componente | Peso | Lógica Inteligente (P2) |
|---|---|---|
| Rentabilidade Real (Ticket/g) | 25 pts | ≥0.10€/g=25 · >0.07€=18 · >0.04€=10 · <0.04€=0 |
| Eficiência Operacional Relativa | 25 pts | % Pedidos em Atraso (≤5%=25 · ≤15%=15 · ≤25%=5 · >25%=0) |
| Risco de Cashflow (Valor €) | 20 pts | % Retido no total pendente (≤10%=20 · ≤30%=12 · >30%=0) |
| Supply Chain & Assets | 20 pts | Base 20pts: (-4 por máx. mat. esgotado) (-10 por máx. impressora parada) |
| Tendência Receita Mensal | 10 pts | ≥ mês anterior=10 · queda <20%=5 · queda máx=0 |

**Bandas:** 80–100 Saudável · 55–79 Atenção · 30–54 Em risco · 0–29 Crítico

**Utilizador novo sem dados:** score inicia em 100 (benefício da dúvida), ajustando à medida que dados são inseridos.

**Melhorias planeadas:** v1.2 — histórico diário em Supabase (`health_scores`) + gráfico semanal/mensal · v1.3 — benchmark anónimo vs mediana do setor

### React Query Pattern
```ts
export function useFilaments() {
  const { company } = useTenant();
  return useQuery({
    queryKey: ['filaments', company.id],
    queryFn: () => supabase.from('filaments').select('*').order('type'),
    staleTime: 30_000,
  });
}
```

---

## 13. Segurança

| Camada | Mecanismo |
|---|---|
| Auth | Supabase JWT httpOnly cookies; session rotation; PKCE flow |
| Database | RLS em 100% das tabelas com dados tenant |
| API | Edge Functions verificam session + plan antes de processar |
| Input Validation | Zod schemas em todas as mutations; sanitização no servidor |
| Rate Limiting | Cloudflare WAF nas rotas auth e API |
| CSRF | Next.js built-in + SameSite=Strict cookies |
| XSS | React escaping + CSP headers via Cloudflare |
| Stripe Webhooks | `stripe.webhooks.constructEvent()` signature verification |
| Storage | Supabase Storage policies por company_id; max 5MB |

### Variáveis de Ambiente
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Apenas server-side
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...             # Apenas server-side
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://app.3dzaap.com
```

---

## 14. Deploy

### Infraestrutura

| Serviço | Uso |
|---|---|
| Cloudflare Pages | Hosting Next.js (Edge Runtime) |
| Cloudflare Workers | Middleware, redirects, security headers |
| Cloudflare R2 | Storage de assets (logos, CSV exports) |
| Supabase | Postgres + Auth + Edge Functions + Realtime + Storage |
| GitHub Actions | CI/CD pipeline |
| Stripe | Billing, webhooks, customer portal |

### Ambientes

| Ambiente | Branch | URL | Supabase Project |
|---|---|---|---|
| Development | feature/* | localhost:3000 | local via `supabase start` |
| Preview | PR branches | *.pages.dev | staging |
| Staging | develop | staging.3dzaap.com | staging |
| Production | main | app.3dzaap.com | prod |

### CI/CD (GitHub Actions)
```yaml
on:
  push:
    branches: [main]
jobs:
  test:
    steps:
      - run: pnpm install
      - run: pnpm run typecheck && pnpm run lint && pnpm run test
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - run: pnpm build
      - uses: cloudflare/pages-action@v1
        with: { projectName: 3dzaap-web, directory: apps/web/.next }
      - run: npx supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

---

## 15. Código Chave — Frontend

### CalculatorForm
```tsx
'use client';
import { useState } from 'react';
import { calculate, defaultInputs } from '@3dzaap/utils/calculator';

export function CalculatorForm() {
  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);
  const results = calculate(inputs); // Live calculation
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CalculatorInputsPanel inputs={inputs} onChange={setInputs} />
      <CalculatorResultsPanel results={results} inputs={inputs} />
    </div>
  );
}
```

### FeatureGate
```tsx
export function FeatureGate({ feature, children, fallback }: Props) {
  const { canAccess } = useTenant();
  if (canAccess(feature)) return <>{children}</>;
  return fallback ? <>{fallback}</> : <UpgradePrompt feature={feature} />;
}
// Uso: <FeatureGate feature='financial'><FinancialModule /></FeatureGate>
```

### Supabase Client
```ts
// client.ts
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// server.ts
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
}
```

---

## 16. Código Chave — Backend (Edge Functions)

### stripe-checkout
```ts
Deno.serve(async (req) => {
  const { priceId } = await req.json();
  const user = await getUserFromAuth(req); // valida JWT
  const { data: membership } = await supabase.from('memberships')
    .select('company_id').eq('user_id', user.id).single();
  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: { metadata: { company_id: membership!.company_id } },
    success_url: `${APP_URL}/billing?success=1`,
    cancel_url: `${APP_URL}/billing`,
  });
  return Response.json({ url: session.url });
});
```

### stripe-webhook
```ts
Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  const event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);

  if (event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created') {
    const sub = event.data.object as Stripe.Subscription;
    await supabase.from('subscriptions').upsert({
      company_id: sub.metadata.company_id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    }, { onConflict: 'stripe_subscription_id' });
  }
  return Response.json({ received: true });
});
```

---

## 17. Dependências Principais

```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "typescript": "^5.4.0",
  "@supabase/supabase-js": "^2.43.0",
  "@supabase/ssr": "^0.4.0",
  "@stripe/stripe-js": "^3.4.0",
  "stripe": "^16.0.0",
  "@tanstack/react-query": "^5.40.0",
  "zod": "^3.23.0",
  "zustand": "^4.5.0",
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.390.0",
  "recharts": "^2.12.0",
  "react-hook-form": "^7.52.0",
  "@hookform/resolvers": "^3.6.0"
}
```

---

## 18. Checklist de Lançamento

### Pré-Lançamento (MVP HTML)
- [x] Setup Supabase (produção) + migrations base
- [x] Configurar e testar RLS policies (isolamento multi-tenant)
- [x] Fluxo de Onboarding (4 passos)
- [x] Dashboard Real-time + Health Score
- [x] Animações Premium & Squircle Design
- [ ] Configurar emails transacionais (Supabase + Resend/Postmark)

### Migração SaaS (Next.js)
- [ ] Setup Monorepo (Turbo + pnpm)
- [ ] Setup Stripe: produtos, preços, webhooks endpoint
- [ ] Deploy Edge Functions: stripe-checkout, stripe-portal, stripe-webhook
- [ ] Reescrita completa da UI (React/Radix)
- [ ] Rate Limiting (Cloudflare WAF)
- [ ] Smoke tests em staging antes de apontar DNS para produção

### Pós-Lançamento
- [ ] Alertas de erro (Sentry ou LogFlare)
- [ ] Analytics (Cloudflare Web Analytics ou Plausible)
- [ ] Monitorizar webhooks Stripe em produção
- [ ] A/B test pricing page
- [ ] Coletar feedback dos primeiros 50 utilizadores

---

## 19. Estratégia de Crescimento e Retenção

### Anti-Churn — Features de Loop Diário

O maior risco de churn é o esquecimento. Utilizadores que acedem diariamente têm taxa de cancelamento significativamente menor.

| Feature | Mecanismo | Status |
|---|---|---|
| Score de Saúde | Número 0-100 com delta diário cria tensão positiva de retorno | v1.1 live |
| Benchmark anónimo | Comparação vs mediana do setor (dados anonimizados) | v1.3 planned |
| Notificações ao cliente | WhatsApp/email automático ao cliente em mudança de status | v1.4 planned |
| Pedidos recorrentes | Duplicar pedido anterior em 1 clique | v1.2 planned |

### Roadmap de Diferenciação

| Feature | Valor | Plano |
|---|---|---|
| Link de orçamento público | Cliente aprova online → word-of-mouth orgânico | Pro |
| Calculadora resina (FDM+SLA) | Segundo maior segmento, sem concorrente direto que suporte ambos | Starter+ |
| Botão Calc → Pedido | Elimina fricção entre orçamentação e registo | Pro |
| API pública / Zapier | Integrações Etsy, Shopify, WooCommerce | Business |
| White-label para agências | Motor B2B2C — consultores revendem com marca própria | Business+ |

### Lógica Anti-Churn do Trial

O trial inicia com score 100 (benefício da dúvida). À medida que o utilizador insere dados reais, o score ajusta-se — criando um efeito de "perda antecipada": o utilizador não quer perder o histórico acumulado ao cancelar.

---

## 20. Módulo Biblioteca de Produtos (v1.4 — Integrado)

### Visão Geral

O módulo `products.html` funciona como uma biblioteca reutilizável de peças configuradas. Cada produto é um snapshot completo de um cálculo, permitindo a re-utilização sem recalcular desde zero.

### Schema do Produto (localStorage/Supabase `products`)

```json
{
  "id": "uuid",
  "name": "Vaso Geométrico",
  "description": "Para cliente recorrente.",
  "salePrice": 12.50,
  "config": {
    "mode": "simple|advanced",
    "filament_weight": 45.0,
    "resin_volume": 0.0,
    "est_print_hours": 3.5,
    "material_id": "uuid-do-material",
    "_orig_inputs": {
      "partWeight": 45, "printTime": 3.5,
      "filamentPrice": 25, "printerPrice": 600,
      "printerLife": 5000, "powerConsumption": 200,
      "electricityPrice": 0.22, "failureRate": 5,
      "indirectCosts": 10, "profitMargin": 30,
      "mesas": [], "mode": "simple"
    }
  }
}
```

### Fluxo de Integração Triângulo (Calculadora ↔ Produto ↔ Pedido)

```
Calculadora ──[💾 Guardar]──► Biblioteca de Produtos
     ▲                              │
     │  localStorage                │  onClick [🧪 Calcular]
     │  3dzaap_calc_load            │
     └──────────────────────────────┘
                                    │  onClick [🛒 Gerar Pedido]
                                    ▼
                              Módulo Pedidos
                              (pré-preenchido via sessionStorage)
```

**Implementação chave:**
- `calculator.html` → `doSaveProduct()`: guarda `_orig_inputs` completo como snapshot.
- `calculator.html` → `loadFromLibrary(product)`: restaura modo (simples/avançado), mesas e parâmetros financeiros do `_orig_inputs`.
- `products.html` → `calculateProduct(id)`: escreve em `localStorage['3dzaap_calc_load']` e redireciona para `calculator.html`.
- `products.html` → `createOrderFromProduct(id)`: escreve em `sessionStorage['3dzaap_calc_prefill']` e redireciona para `orders.html?from=product`.
- `orders.html` → lê `sessionStorage['3dzaap_calc_prefill']` no `DOMContentLoaded` e pré-preenche a modal de novo pedido.

### UI da Biblioteca de Produtos

- **Linhas expansíveis**: Clica para expandir; revela Resumo Técnico (consumo, tempo, material, modo).
- **Ações por linha**: 🧪 Calcular · 🛒 Pedido · ✏️ Editar · 🗑️ Eliminar.
- **Eliminar direto**: confirmação inline sem abrir modal.
- **Mobile**: troca tabela por cards (`mob-prod-list`) abaixo de 680px.

---

## 21. Seleção de Clientes em Pedidos (v1.4)

A modal de novo pedido (`orders.html`) inclui autocomplete inteligente no campo "Nome do cliente":

- **Focus trigger**: Ao clicar no campo (mesmo vazio), mostra os 5 clientes mais recentes da BD.
- **Filtro em tempo real**: Filtra por nome ou email enquanto o utilizador escreve.
- **Preenchimento automático**: Selecionar um cliente preenche Email, Telefone, NIF e Morada.
- **Criar novo cliente**: Opção "+ Criar Novo Cliente" redireciona para o modal de registo.
- **Click-outside**: Lista fecha ao clicar fora do campo.

---

## 22. Auditoria Pré-Lançamento (Abril 2026)

### Traduções (i18n)
- ✅ Adicionada secção `common` (delete, cancel, save, edit, close, confirm) a todos os 5 locales.
- ✅ Adicionada `dash.stats.total_label` a todos os 5 locales.
- ✅ Adicionada `nav.tagline` ("Printing Manager") a todos os 5 locales.
- ✅ `dashboard.html`: "Total:" convertido de hardcode para `data-i18n="dash.stats.total_label"`.
- ✅ `orders.html`: "Printing Manager" no rodapé do recibo convertido para `t('nav.tagline', ...)`.
- ✅ Todos os 5 ficheiros JSON validados: sem erros de sintaxe.

### Ícones (Padronização)
- 🧪 Calcular · 🛒 Gerar Pedido · ✏️ Editar · 🗑️ Eliminar · 🔍 Pesquisar · 💾 Guardar
- Iconografia emoji aplicada de forma consistente em: `products.html`, `clients.html`, `orders.html`.

### Debug Code
- ✅ Sem `console.log` em HTML/JS de produção.
- ℹ️ `supabase.js` tem 2 linhas `console.info` informativas — mantidas intencionalmente.

### Responsividade
- `products.html`: tabela oculta < 680px; cards mobile (`mob-prod-list`) com área expansível.
- `orders.html`: estatísticas em grid 2×2 < 680px; lista mobile de pedidos.
- `shared.css`: 3 breakpoints definidos (1100px, 680px, 420px).

---

*3DZAAP Print Manager — SaaS Blueprint v1.4 · Abril 2026 · © 2025 · Documento Confidencial*

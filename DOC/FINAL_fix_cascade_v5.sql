-- ============================================================
-- 3DZAAP: FINAL CASCADE DELETE SCRIPT (v5)
-- Objetivo: Resolver Erro 400 definitivo eliminando loop owner_id
-- ============================================================

-- A. RESOLVER LOOP CRÍTICO DE EXCLUSÃO (Erro 400 Real)
-- Quando a TRIGGER "before delete" tenta apagar o auth.users, o Postgres 
-- bloqueia se companies.owner_id ainda obrigar à existência do utilizador.
ALTER TABLE public.companies
DROP CONSTRAINT IF EXISTS companies_owner_id_fkey,
ADD CONSTRAINT companies_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- B. TABELAS DE NEGÓCIO (Do diagnóstico SQL exato)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_company_id_fkey, ADD CONSTRAINT subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_company_id_fkey, ADD CONSTRAINT payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.printers DROP CONSTRAINT IF EXISTS printers_company_id_fkey, ADD CONSTRAINT printers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.filaments DROP CONSTRAINT IF EXISTS filaments_company_id_fkey, ADD CONSTRAINT filaments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_company_id_fkey, ADD CONSTRAINT orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_company_id_fkey, ADD CONSTRAINT expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_company_id_fkey, ADD CONSTRAINT activity_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invites DROP CONSTRAINT IF EXISTS invites_company_id_fkey, ADD CONSTRAINT invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- C. LIMPEZA SEGURA DE AUTENTICAÇÃO
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_company_id_fkey, ADD CONSTRAINT memberships_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_user_id_fkey, ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.super_admins DROP CONSTRAINT IF EXISTS super_admins_user_id_fkey, ADD CONSTRAINT super_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- SUCESSO: Sem loops nas chaves estrangeiras, a empresa será removida na perfeição.

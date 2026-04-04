-- ============================================================
-- 3DZAAP: FINAL CONSOLIDATED Cascade Delete Fix
-- Baseado na lista exata de tabelas do diagnóstico SQL
-- ============================================================

-- 1. SUBSCRIPTIONS
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_company_id_fkey,
ADD CONSTRAINT subscriptions_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. PAYMENTS
ALTER TABLE public.payments 
DROP CONSTRAINT IF EXISTS payments_company_id_fkey,
ADD CONSTRAINT payments_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. PRINTERS
ALTER TABLE public.printers 
DROP CONSTRAINT IF EXISTS printers_company_id_fkey,
ADD CONSTRAINT printers_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 4. MEMBERSHIPS (Vínculo com Empresa e User)
ALTER TABLE public.memberships 
DROP CONSTRAINT IF EXISTS memberships_company_id_fkey,
ADD CONSTRAINT memberships_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.memberships
DROP CONSTRAINT IF EXISTS memberships_user_id_fkey,
ADD CONSTRAINT memberships_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. FILAMENTS
ALTER TABLE public.filaments 
DROP CONSTRAINT IF EXISTS filaments_company_id_fkey,
ADD CONSTRAINT filaments_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 6. ORDERS
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_company_id_fkey,
ADD CONSTRAINT orders_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 7. EXPENSES
ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS expenses_company_id_fkey,
ADD CONSTRAINT expenses_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 8. ACTIVITY_LOG
ALTER TABLE public.activity_log 
DROP CONSTRAINT IF EXISTS activity_log_company_id_fkey,
ADD CONSTRAINT activity_log_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 9. INVITES
ALTER TABLE public.invites 
DROP CONSTRAINT IF EXISTS invites_company_id_fkey,
ADD CONSTRAINT invites_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 10. SUPER_ADMINS (Segurança de Autenticação)
-- Se o utilizador for apagado da autenticação, limpa o seu perfil de super_admin.
ALTER TABLE public.super_admins
DROP CONSTRAINT IF EXISTS super_admins_user_id_fkey,
ADD CONSTRAINT super_admins_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- SUCCESS: The 9 identified links are now correctly configured for full account removal.

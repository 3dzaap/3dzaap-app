-- ============================================================
-- 3DZAAP: SETUP Cascade Delete for Company Accounts
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. memberships
ALTER TABLE public.memberships 
DROP CONSTRAINT IF EXISTS memberships_company_id_fkey,
ADD CONSTRAINT memberships_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. filaments
ALTER TABLE public.filaments 
DROP CONSTRAINT IF EXISTS filaments_company_id_fkey,
ADD CONSTRAINT filaments_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. printers
ALTER TABLE public.printers 
DROP CONSTRAINT IF EXISTS printers_company_id_fkey,
ADD CONSTRAINT printers_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 4. orders
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_company_id_fkey,
ADD CONSTRAINT orders_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 5. expenses
ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS expenses_company_id_fkey,
ADD CONSTRAINT expenses_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 6. activity_log
ALTER TABLE public.activity_log 
DROP CONSTRAINT IF EXISTS activity_log_company_id_fkey,
ADD CONSTRAINT activity_log_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 7. subscriptions
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_company_id_fkey,
ADD CONSTRAINT subscriptions_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 8. invites
ALTER TABLE public.invites 
DROP CONSTRAINT IF EXISTS invites_company_id_fkey,
ADD CONSTRAINT invites_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- SUCCESS: Database now supports definitive company account deletion with clean data removal.

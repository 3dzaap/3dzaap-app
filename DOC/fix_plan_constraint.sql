-- ============================================================
-- 3DZAAP: ATUALIZAR CHECK CONSTRAINT DA COLUNA "plan"
-- Permite os 7 valores de plano incluindo as variantes anuais.
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. Remove a restrição antiga (apenas os 4 planos base)
ALTER TABLE public.companies 
DROP CONSTRAINT IF EXISTS companies_plan_check;

-- 2. Adiciona a nova restrição com os 7 planos
ALTER TABLE public.companies 
ADD CONSTRAINT companies_plan_check 
CHECK (plan IN ('trial', 'starter', 'starter_ano', 'pro', 'pro_ano', 'business', 'business_ano'));

-- ============================================================
-- 3DZAAP: FIX Global SuperAdmin Access (RLS)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Função eficiente para verificar se o utilizador é Super Admin
-- Define security to ensure it can read from public.super_admins even if RLS is on.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar políticas da tabela 'companies' (Acesso total)
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.companies;
CREATE POLICY "SuperAdmin Full Access" 
ON public.companies 
FOR ALL 
TO authenticated 
USING (public.is_super_admin());

-- 3. Atualizar políticas da tabela 'memberships' (Para ver todos os utilizadores)
DROP POLICY IF EXISTS "SuperAdmin Membership Access" ON public.memberships;
CREATE POLICY "SuperAdmin Membership Access" 
ON public.memberships 
FOR ALL 
TO authenticated 
USING (public.is_super_admin());

-- 4. Atualizar políticas da tabela 'subscriptions' (Se existir/aplicável)
-- Nota: Algumas tabelas podem já ter políticas restritivas, estas novas políticas 
-- funcionam em conjunto (OR) com as existentes.
DROP POLICY IF EXISTS "SuperAdmin Subscription Access" ON public.subscriptions;
CREATE POLICY "SuperAdmin Subscription Access" 
ON public.subscriptions 
FOR ALL 
TO authenticated 
USING (public.is_super_admin());

-- SUCCESS: SuperAdmins now have global visibility across all data.

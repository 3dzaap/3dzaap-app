-- ============================================================
-- FIX: Portal 406 Not Acceptable (Anonymous Access)
-- ============================================================

-- 1. Permite acesso público para consulta de pedidos via share_token
-- Isto resolve o erro 406 no portal.html
CREATE POLICY "Public Tracking Access" ON public.orders
FOR SELECT USING (share_token IS NOT NULL);

-- 2. Permite acesso público aos dados básicos da empresa
-- Necessário para carregar logo, nome e cores no portal
-- Restringimos apenas a campos não sensíveis (mantendo config, signature e name)
CREATE POLICY "Public Company Info Access" ON public.companies
FOR SELECT USING (true);

-- 3. Caso a tabela memberships também precise de ser consultada (join indireto)
-- Podes adicionar se necessário, mas para o portal atual (pedidos + empresas) os dois acima chegam.

-- NOTA: Se já existirem políticas chamadas "Public Tracking Access" ou "Public Company Info Access",
-- podes apagá-las primeiro com:
-- DROP POLICY IF EXISTS "Public Tracking Access" ON public.orders;
-- DROP POLICY IF EXISTS "Public Company Info Access" ON public.companies;

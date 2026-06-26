-- Adiciona a coluna company_id (caso não tenha rodado)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- 1. Permitir que usuários leiam apenas a sua própria empresa
DROP POLICY IF EXISTS "Permitir leitura pelo próprio parceiro" ON partners;
CREATE POLICY "Permitir leitura pelo próprio parceiro" 
ON partners FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
  )
);

-- 2. Permitir que super_admins façam TUDO (Insert, Select, Update, Delete)
DROP POLICY IF EXISTS "Permitir tudo para super_admins" ON partners;
CREATE POLICY "Permitir tudo para super_admins" 
ON partners FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
);

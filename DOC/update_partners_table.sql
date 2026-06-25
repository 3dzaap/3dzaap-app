-- Adiciona a coluna company_id vinculada à tabela companies
ALTER TABLE partners ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Permitir que usuários autenticados leiam apenas a sua própria empresa na tabela de parceiros
CREATE POLICY "Permitir leitura pelo próprio parceiro" 
ON partners FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

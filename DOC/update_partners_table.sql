-- Adiciona a coluna company_id vinculada à tabela companies
ALTER TABLE partners ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

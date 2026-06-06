-- Script para criar a tabela 'acordos' no Supabase
CREATE TABLE acordos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name text NOT NULL,
  partner_rep text,
  start_date date,
  duration integer,
  plan text,
  coupons jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Ativar RLS (Row Level Security) se necessário
ALTER TABLE acordos ENABLE ROW LEVEL SECURITY;

-- Exemplo: Permitir leitura e escrita apenas para utilizadores autenticados (ou ajustar conforme as tuas regras)
CREATE POLICY "Permitir leitura a todos" ON acordos FOR SELECT USING (true);
CREATE POLICY "Permitir inserção a todos (ou apenas admin)" ON acordos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizar" ON acordos FOR UPDATE USING (true);
CREATE POLICY "Permitir apagar" ON acordos FOR DELETE USING (true);

-- Script de Migração: Dicas Públicas, Links Externos e Isolamento por Empresa
-- Execute no SQL Editor do Supabase

-- 1. Adicionar as novas colunas
ALTER TABLE public.wiki_entries ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE public.wiki_entries ADD COLUMN IF NOT EXISTS external_link TEXT;
ALTER TABLE public.wiki_entries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Atualizar as entradas existentes (Opcional, mas recomendado para que dicas antigas não desapareçam)
-- Vamos associar a company_id de cada wiki_entry com base no perfil do utilizador que a criou
UPDATE public.wiki_entries w
SET company_id = m.company_id
FROM public.memberships m
WHERE w.user_id = m.user_id AND w.company_id IS NULL;

-- 3. Atualizar as políticas de Segurança (RLS)
-- Apagar a política de leitura anterior
DROP POLICY IF EXISTS "Anyone authenticated can view wiki entries" ON public.wiki_entries;

-- Nova política: Um utilizador pode ver a dica se pertencer à SUA empresa OU for pública
CREATE POLICY "Anyone authenticated can view wiki entries" 
ON public.wiki_entries 
FOR SELECT 
USING (
  auth.role() = 'authenticated' 
  AND (
    is_public = true 
    OR 
    company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid())
  )
);

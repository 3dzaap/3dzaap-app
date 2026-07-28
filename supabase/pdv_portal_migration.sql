-- ==============================================================================
-- 3DZAAP - Migração: Portal do Lojista (PDV) com PIN
-- Corre este script no Supabase SQL Editor
-- Podes correr com segurança mesmo se as tabelas já existirem (IF NOT EXISTS / IF NOT EXIST)
-- ==============================================================================

-- 1. Adicionar portal_token e portal_pin à tabela pdvs existente
--    (gera automaticamente UUIDs únicos para o token e PINs de 4 dígitos)
ALTER TABLE public.pdvs 
  ADD COLUMN IF NOT EXISTS portal_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS portal_pin TEXT;

-- Garante que PDVs existentes recebem token e PIN
UPDATE public.pdvs 
SET portal_token = uuid_generate_v4() 
WHERE portal_token IS NULL;

UPDATE public.pdvs
SET portal_pin = lpad(floor(random() * 10000)::text, 4, '0')
WHERE portal_pin IS NULL;

-- ==============================================================================
-- 2. Criar tabela de pedidos do portal (baixas e reposições submetidas pelos lojistas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pdv_requests (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    pdv_id     UUID NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,           -- 'sale_report' | 'restock_request'
    status     TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    items      JSONB NOT NULL,          -- [{ id, product_name, quantity, price_unit }]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pdv_requests ENABLE ROW LEVEL SECURITY;

-- Política: utilizadores autenticados só vêem pedidos da sua empresa
DROP POLICY IF EXISTS "Users can manage their own pdv_requests" ON public.pdv_requests;
CREATE POLICY "Users can manage their own pdv_requests"
    ON public.pdv_requests FOR ALL
    USING  ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) )
    WITH CHECK ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_pdv_requests_company ON public.pdv_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_pdv_requests_pdv     ON public.pdv_requests(pdv_id);
CREATE INDEX IF NOT EXISTS idx_pdv_requests_status  ON public.pdv_requests(status);

-- ==============================================================================
-- 3. Funções RPC com SECURITY DEFINER (Acesso Lojista)
-- ==============================================================================

-- 3a. Ler dados do PDV + inventário (GET) - Requer Token e PIN
CREATE OR REPLACE FUNCTION get_pdv_portal_data(p_token UUID, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pdv       RECORD;
    v_inventory JSONB;
BEGIN
    SELECT id, company_id, name, commission_rate, portal_pin
    INTO   v_pdv
    FROM   public.pdvs
    WHERE  portal_token = p_token
      AND  status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_token';
    END IF;

    IF v_pdv.portal_pin != p_pin THEN
        RAISE EXCEPTION 'invalid_pin';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',           id,
        'product_name', product_name,
        'quantity',     quantity,
        'price_unit',   price_unit
    ) ORDER BY product_name), '[]'::jsonb)
    INTO v_inventory
    FROM public.pdv_inventory
    WHERE pdv_id = v_pdv.id AND quantity > 0;

    RETURN jsonb_build_object(
        'pdv_id',          v_pdv.id,
        'company_id',      v_pdv.company_id,
        'name',            v_pdv.name,
        'commission_rate', v_pdv.commission_rate,
        'inventory',       v_inventory
    );
END;
$$;

-- Permitir acesso anónimo
GRANT EXECUTE ON FUNCTION get_pdv_portal_data(UUID, TEXT) TO anon;

-- 3b. Submeter um pedido do lojista (POST) - Requer Token e PIN
CREATE OR REPLACE FUNCTION submit_pdv_request(p_token UUID, p_pin TEXT, p_type TEXT, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pdv   RECORD;
    v_id    UUID;
BEGIN
    SELECT id, company_id, portal_pin
    INTO   v_pdv
    FROM   public.pdvs
    WHERE  portal_token = p_token
      AND  status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_token';
    END IF;

    IF v_pdv.portal_pin != p_pin THEN
        RAISE EXCEPTION 'invalid_pin';
    END IF;

    INSERT INTO public.pdv_requests (company_id, pdv_id, type, status, items)
    VALUES (v_pdv.company_id, v_pdv.id, p_type, 'pending', p_items)
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'request_id', v_id);
END;
$$;

-- Permitir acesso anónimo
GRANT EXECUTE ON FUNCTION submit_pdv_request(UUID, TEXT, TEXT, JSONB) TO anon;

-- ==============================================================================
-- 4. Função auxiliar para ler apenas o nome da loja (para o ecrã de PIN)
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_pdv_portal_name(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pdv RECORD;
BEGIN
    SELECT name
    INTO   v_pdv
    FROM   public.pdvs
    WHERE  portal_token = p_token
      AND  status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_token';
    END IF;

    RETURN jsonb_build_object('name', v_pdv.name);
END;
$$;

GRANT EXECUTE ON FUNCTION get_pdv_portal_name(UUID) TO anon;

-- ==============================================================================
-- Verificação final
-- ==============================================================================
SELECT 
    count(*) as total_pdvs,
    count(portal_token) as pdvs_com_token,
    count(portal_pin) as pdvs_com_pin
FROM public.pdvs;

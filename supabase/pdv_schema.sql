-- ==============================================================================
-- 3DZAAP - Schema para Módulo de Consignados (PDV)
-- ==============================================================================

-- 1. Tabela de Pontos de Venda (PDVs)
CREATE TABLE IF NOT EXISTS public.pdvs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    contact TEXT,
    commission_rate NUMERIC(5,2) DEFAULT 30.00, -- Ex: 30% para a loja
    status TEXT DEFAULT 'active', -- active, inactive
    portal_token UUID UNIQUE DEFAULT uuid_generate_v4(), -- Token seguro para acesso ao portal do lojista
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e criar políticas
ALTER TABLE public.pdvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pdvs" 
    ON public.pdvs FOR ALL 
    USING ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) )
    WITH CHECK ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) );

-- 2. Tabela de Inventário por PDV
CREATE TABLE IF NOT EXISTS public.pdv_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdv_id UUID NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL, -- Pode ser texto livre ou referenciar um produto existente
    sku TEXT,
    quantity INTEGER DEFAULT 0,
    price_unit NUMERIC(10,2) NOT NULL, -- Preço final ao consumidor (a comissão abate aqui)
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint para evitar duplicados do mesmo produto no mesmo PDV
ALTER TABLE public.pdv_inventory ADD CONSTRAINT uq_pdv_product UNIQUE(pdv_id, product_name);

ALTER TABLE public.pdv_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pdv_inventory" 
    ON public.pdv_inventory FOR ALL 
    USING ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) )
    WITH CHECK ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) );

-- 3. Tabela de Transações (Histórico de Remessas e Acertos)
CREATE TABLE IF NOT EXISTS public.pdv_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdv_id UUID NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'transfer_in' (Remessa para loja), 'sale' (Venda/Acerto), 'return' (Devolução)
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_unit NUMERIC(10,2),
    total_value NUMERIC(10,2),
    commission_value NUMERIC(10,2), -- Valor da comissão retida pela loja
    net_value NUMERIC(10,2), -- Valor que o maker recebe
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pdv_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pdv_transactions" 
    ON public.pdv_transactions FOR ALL 
    USING ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) )
    WITH CHECK ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) );

-- Index para otimização
CREATE INDEX idx_pdvs_company ON public.pdvs(company_id);
CREATE INDEX idx_pdv_inventory_pdv ON public.pdv_inventory(pdv_id);
CREATE INDEX idx_pdv_transactions_pdv ON public.pdv_transactions(pdv_id);

-- 4. Tabela de Pedidos do Portal PDV (Baixas e Reposições)
CREATE TABLE IF NOT EXISTS public.pdv_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    pdv_id UUID NOT NULL REFERENCES public.pdvs(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'sale_report' ou 'restock_request'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    items JSONB NOT NULL, -- Array de items com productId/name e qty
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pdv_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pdv_requests" 
    ON public.pdv_requests FOR ALL 
    USING ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) )
    WITH CHECK ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid()) );
    
CREATE INDEX idx_pdv_requests_company ON public.pdv_requests(company_id);
CREATE INDEX idx_pdv_requests_company ON public.pdvs(company_id);
CREATE INDEX idx_pdv_requests_pdv ON public.pdv_requests(pdv_id);

-- ==============================================================================
-- Funções RPC para o Portal Externo (Bypass RLS para Lojistas com Token)
-- ==============================================================================

-- Obter dados do PDV e inventário através do portal_token
CREATE OR REPLACE FUNCTION get_pdv_portal_data(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pdv RECORD;
    v_inventory JSONB;
BEGIN
    SELECT id, company_id, name, commission_rate 
    INTO v_pdv 
    FROM public.pdvs 
    WHERE portal_token = p_token AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PDV não encontrado ou inativo';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'product_name', product_name,
        'quantity', quantity,
        'price_unit', price_unit
    )), '[]'::jsonb)
    INTO v_inventory
    FROM public.pdv_inventory
    WHERE pdv_id = v_pdv.id AND quantity > 0;

    RETURN jsonb_build_object(
        'pdv_id', v_pdv.id,
        'company_id', v_pdv.company_id,
        'name', v_pdv.name,
        'commission_rate', v_pdv.commission_rate,
        'inventory', v_inventory
    );
END;
$$;

-- Submeter um pedido (baixa ou reposição) através do portal_token
CREATE OR REPLACE FUNCTION submit_pdv_request(p_token UUID, p_type TEXT, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pdv RECORD;
    v_req_id UUID;
BEGIN
    SELECT id, company_id 
    INTO v_pdv 
    FROM public.pdvs 
    WHERE portal_token = p_token AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PDV não encontrado ou inativo';
    END IF;

    INSERT INTO public.pdv_requests (company_id, pdv_id, type, status, items)
    VALUES (v_pdv.company_id, v_pdv.id, p_type, 'pending', p_items)
    RETURNING id INTO v_req_id;

    RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$;


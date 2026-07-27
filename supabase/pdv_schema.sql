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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e criar políticas
ALTER TABLE public.pdvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pdvs" 
    ON public.pdvs FOR ALL 
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

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
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

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
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Index para otimização
CREATE INDEX idx_pdvs_company ON public.pdvs(company_id);
CREATE INDEX idx_pdv_inventory_pdv ON public.pdv_inventory(pdv_id);
CREATE INDEX idx_pdv_transactions_pdv ON public.pdv_transactions(pdv_id);

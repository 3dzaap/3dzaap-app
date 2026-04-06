-- ============================================================
-- 3DZAAP: SETUP PRODUCTS AND CLIENTS MODULES
-- Purpose: Creating tables for product library and recurring clients.
-- ============================================================

-- 1) CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    nif TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own company clients" ON public.clients
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = clients.company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = clients.company_id
    ));

CREATE POLICY "Users can insert clients for their company" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = company_id
    ));

CREATE POLICY "Users can update their company clients" ON public.clients
    FOR UPDATE USING (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = clients.company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = clients.company_id
    ));

CREATE POLICY "Users can delete their company clients" ON public.clients
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = clients.company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = clients.company_id
    ));


-- 2) PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sale_price NUMERIC(10,2) DEFAULT 0.00,
    config JSONB DEFAULT '{}'::jsonb, -- Stores calculation parameters (parts, material, printer, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own company products" ON public.products
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = products.company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = products.company_id
    ));

CREATE POLICY "Users can insert products for their company" ON public.products
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = company_id
    ));

CREATE POLICY "Users can update their company products" ON public.products
    FOR UPDATE USING (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = products.company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = products.company_id
    ));

CREATE POLICY "Users can delete their company products" ON public.products
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM public.memberships WHERE company_id = products.company_id
        UNION
        SELECT owner_id FROM public.companies WHERE id = products.company_id
    ));

-- Success
-- Remember to run this in the Supabase SQL Editor.

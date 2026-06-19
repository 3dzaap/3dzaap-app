-- Criação das tabelas para o motor de busca de filamentos

-- Tabela de Lojas
CREATE TABLE public.filaments_stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    website_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Produtos (Filamentos)
CREATE TABLE public.filaments_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.filaments_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    material TEXT NOT NULL, -- Ex: PLA, PETG, ABS
    color TEXT,
    weight_g INTEGER NOT NULL DEFAULT 1000, -- Peso em gramas (para calcular preço por kg)
    product_url TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Histórico de Preços
CREATE TABLE public.filaments_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.filaments_products(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    price_per_kg NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'EUR',
    in_stock BOOLEAN DEFAULT true,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alertas dos Utilizadores
CREATE TABLE public.filaments_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    material TEXT, -- Se null, qualquer material
    target_price_per_kg NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para melhorar a performance de consultas
CREATE INDEX idx_filaments_products_material ON public.filaments_products(material);
CREATE INDEX idx_filaments_price_history_product_id ON public.filaments_price_history(product_id);
CREATE INDEX idx_filaments_price_history_checked_at ON public.filaments_price_history(checked_at);
CREATE INDEX idx_filaments_alerts_user_id ON public.filaments_alerts(user_id);

-- Row Level Security (RLS)
ALTER TABLE public.filaments_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filaments_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filaments_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filaments_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura (Público/Autenticados podem ler os catálogos e históricos)
CREATE POLICY "Lojas visíveis para todos" ON public.filaments_stores FOR SELECT USING (true);
CREATE POLICY "Produtos visíveis para todos" ON public.filaments_products FOR SELECT USING (true);
CREATE POLICY "Histórico de preços visível para todos" ON public.filaments_price_history FOR SELECT USING (true);

-- Alertas são apenas visíveis e modificáveis pelo dono
CREATE POLICY "Utilizadores podem ver seus próprios alertas" 
    ON public.filaments_alerts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Utilizadores podem inserir seus próprios alertas" 
    ON public.filaments_alerts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilizadores podem atualizar seus próprios alertas" 
    ON public.filaments_alerts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Utilizadores podem deletar seus próprios alertas" 
    ON public.filaments_alerts FOR DELETE 
    USING (auth.uid() = user_id);

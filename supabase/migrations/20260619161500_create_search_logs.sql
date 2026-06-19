-- Migration para a Arquitetura On-Demand (Tempo Real)

CREATE TABLE public.filaments_search_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_query TEXT NOT NULL, -- Ex: "Filamento PLA Preto"
    material TEXT,
    color TEXT,
    lowest_price NUMERIC(10, 2),
    results_count INTEGER DEFAULT 0,
    results_json JSONB, -- Cache dos top 3 resultados (nome, link, preco, loja)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index para facilitar a pesquisa pela cache (para saber se já pesquisamos algo parecido hoje)
CREATE INDEX idx_filaments_search_logs_query ON public.filaments_search_logs(search_query);
CREATE INDEX idx_filaments_search_logs_created_at ON public.filaments_search_logs(created_at);

ALTER TABLE public.filaments_search_logs ENABLE ROW LEVEL SECURITY;

-- Toda a gente (autenticada) pode ler a cache para não ter de bater na API externa
CREATE POLICY "Leitura pública da cache" ON public.filaments_search_logs FOR SELECT USING (true);

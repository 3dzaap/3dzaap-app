-- Fase 2: Lógica de Identificação de "Good Deals" (Oportunidades)

-- 1. View para obter o preço MAIS RECENTE de cada produto
CREATE OR REPLACE VIEW public.filaments_current_prices AS
SELECT DISTINCT ON (product_id)
    product_id,
    price,
    price_per_kg,
    currency,
    in_stock,
    checked_at
FROM 
    public.filaments_price_history
ORDER BY 
    product_id, checked_at DESC;

-- 2. View para calcular o histórico (Média dos últimos 30 dias) e identificar ofertas
CREATE OR REPLACE VIEW public.filaments_deals AS
WITH historical_stats AS (
    SELECT 
        product_id,
        AVG(price_per_kg) as avg_price_per_kg_30d,
        MIN(price_per_kg) as min_price_per_kg_30d
    FROM 
        public.filaments_price_history
    WHERE 
        checked_at >= (now() - interval '30 days')
    GROUP BY 
        product_id
)
SELECT 
    p.id as product_id,
    p.name,
    p.brand,
    p.material,
    p.color,
    p.weight_g,
    p.image_url,
    p.product_url,
    s.name as store_name,
    s.website_url as store_url,
    cp.price_per_kg as current_price_per_kg,
    cp.price as current_price,
    cp.currency,
    cp.in_stock,
    cp.checked_at as last_checked,
    ROUND(hs.avg_price_per_kg_30d, 2) as avg_price_30d,
    ROUND(hs.min_price_per_kg_30d, 2) as min_price_30d,
    -- É considerado "Hot Deal" se o preço atual por KG for pelo menos 15% menor que a média dos últimos 30 dias
    (cp.price_per_kg <= (hs.avg_price_per_kg_30d * 0.85) AND cp.in_stock = true) as is_hot_deal,
    -- Desconto percentual em relação à média
    CASE 
        WHEN hs.avg_price_per_kg_30d > 0 THEN 
            ROUND((1 - (cp.price_per_kg / hs.avg_price_per_kg_30d)) * 100, 1)
        ELSE 0 
    END as discount_percentage
FROM 
    public.filaments_products p
JOIN 
    public.filaments_stores s ON p.store_id = s.id
JOIN 
    public.filaments_current_prices cp ON p.id = cp.product_id
LEFT JOIN 
    historical_stats hs ON p.id = hs.product_id
WHERE 
    p.is_active = true;

-- Permissões de Leitura para as Views
GRANT SELECT ON public.filaments_current_prices TO authenticated, anon;
GRANT SELECT ON public.filaments_deals TO authenticated, anon;

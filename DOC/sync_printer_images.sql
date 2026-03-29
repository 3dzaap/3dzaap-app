-- =====================================================
-- SINCRONIZAR IMAGENS DA FROTA ATUAL
-- Execute este script no SQL Editor do Supabase
-- para forçar a sua frota a usar as novas fotos WebP
-- =====================================================

UPDATE public.printers p
SET image_url = pm.image_url
FROM public.printer_models pm
WHERE p.catalog_id = pm.id
  AND p.image_url IS DISTINCT FROM pm.image_url;

-- Nota: isto apaga qualquer erro 404 nas fotos que 
-- ficaram memorizadas das versões antigas.

-- =====================================================
-- CORRIGIR DUPLICADOS NA TABELA printer_models (E DEPENDÊNCIAS)
-- Execute este script NO SQL EDITOR do Supabase
-- =====================================================

-- 1) Atualizar as foreign keys na tabela printers
-- Descobrimos o "vencedor" para cada par (brand, name, type)
WITH ranked_models AS (
  SELECT id, brand, name, type, 
         ROW_NUMBER() OVER(PARTITION BY brand, name, type ORDER BY created_at ASC) as rn
  FROM public.printer_models
),
winners AS (
  SELECT id as canonical_id, brand, name, type FROM ranked_models WHERE rn = 1
)
UPDATE public.printers p
SET catalog_id = w.canonical_id
FROM public.printer_models pm
JOIN winners w ON pm.brand = w.brand AND pm.name = w.name AND pm.type = w.type
WHERE p.catalog_id = pm.id
  AND pm.id != w.canonical_id;

-- 2) Eliminar os duplicados em printer_models
WITH ranked_models AS (
  SELECT id, ROW_NUMBER() OVER(PARTITION BY brand, name, type ORDER BY created_at ASC) as rn
  FROM public.printer_models
)
DELETE FROM public.printer_models
WHERE id IN (
  SELECT id FROM ranked_models WHERE rn > 1
);

-- 3) Proteger contra futuros duplicados
ALTER TABLE public.printer_models
DROP CONSTRAINT IF EXISTS printer_models_brand_name_type_unique;

ALTER TABLE public.printer_models
ADD CONSTRAINT printer_models_brand_name_type_unique
UNIQUE (brand, name, type);

-- 4) Confirmar resultado
SELECT COUNT(*) as total_after_cleanup FROM public.printer_models;

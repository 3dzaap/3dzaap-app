-- Limpeza da arquitetura antiga (Cron)

DROP VIEW IF EXISTS public.filaments_deals;
DROP VIEW IF EXISTS public.filaments_current_prices;

DROP TABLE IF EXISTS public.filaments_alerts CASCADE;
DROP TABLE IF EXISTS public.filaments_price_history CASCADE;
DROP TABLE IF EXISTS public.filaments_products CASCADE;
DROP TABLE IF EXISTS public.filaments_stores CASCADE;

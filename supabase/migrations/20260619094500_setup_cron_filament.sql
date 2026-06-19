-- Configuração do agendamento (Cron Job) via pg_cron e pg_net no Supabase
-- IMPORTANTE: Certifique-se que as extensões pg_cron e pg_net estão ativas no seu projeto Supabase

-- 1. Ativar as extensões se não estiverem (deve ser executado como superuser no painel do Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Agendar a chamada à Edge Function
-- Substitua 'YOUR_PROJECT_REF' e 'YOUR_ANON_KEY' pelos valores reais do seu projeto
SELECT cron.schedule(
    'fetch_filament_prices_daily', -- Nome do cron job
    '0 3 * * *', -- Roda todos os dias às 03:00 da manhã
    $$
    SELECT net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-filament-prices',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
    $$
);

-- Para remover o job futuramente (se necessário):
-- SELECT cron.unschedule('fetch_filament_prices_daily');

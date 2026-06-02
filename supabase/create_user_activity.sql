-- Criar tabela user_activity para rastreio de módulos por utilizador
CREATE TABLE IF NOT EXISTS public.user_activity (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module           text NOT NULL,
  last_visited_at  timestamptz NOT NULL DEFAULT now(),
  visit_count      integer NOT NULL DEFAULT 1,
  CONSTRAINT user_activity_unique UNIQUE (user_id, company_id, module)
);

-- Índices para queries rápidas no admin
CREATE INDEX IF NOT EXISTS idx_user_activity_company ON public.user_activity(company_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_module  ON public.user_activity(module);

-- RLS: apenas o próprio utilizador pode inserir/atualizar; admin lê tudo via service_role
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_activity' AND policyname = 'user_activity_self_write'
  ) THEN
    CREATE POLICY "user_activity_self_write"
      ON public.user_activity
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

SELECT 'user_activity table ready' AS status;

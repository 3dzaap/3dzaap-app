-- ============================================================
-- Migration: Criar função RPC create_company_for_user
-- Resolve erro 404 no onboarding ao escolher qualquer plano
-- ============================================================

-- 1. Função principal de criação de empresa (SECURITY DEFINER para bypass de RLS)
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  p_user_id      UUID,
  p_name         TEXT,
  p_slug         TEXT,
  p_plan         TEXT DEFAULT 'trial',
  p_config       JSONB DEFAULT '{}',
  p_signature    TEXT DEFAULT NULL,
  p_logo_url     TEXT DEFAULT NULL
)
RETURNS SETOF public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company  public.companies;
  v_trial_ends_at TIMESTAMPTZ;
  v_final_slug TEXT;
  v_counter INT := 0;
BEGIN
  -- Calcular trial_ends_at (7 dias a partir de agora)
  v_trial_ends_at := NOW() + INTERVAL '7 days';

  -- Garantir slug único
  v_final_slug := p_slug;
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = v_final_slug) LOOP
    v_counter := v_counter + 1;
    v_final_slug := p_slug || '-' || v_counter;
  END LOOP;

  -- Criar a empresa
  INSERT INTO public.companies (
    owner_id,
    name,
    slug,
    plan,
    config,
    signature,
    logo_url,
    trial_ends_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_name,
    v_final_slug,
    p_plan,
    COALESCE(p_config, '{}'),
    p_signature,
    p_logo_url,
    v_trial_ends_at,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_company;

  -- Criar membership como owner
  INSERT INTO public.memberships (user_id, company_id, role, created_at)
  VALUES (p_user_id, v_company.id, 'owner', NOW())
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RETURN NEXT v_company;
  RETURN;
END;
$$;

-- 2. Permissões de execução para utilizadores autenticados
GRANT EXECUTE ON FUNCTION public.create_company_for_user(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT)
  TO authenticated;

-- 3. Função para atualizar o plano (usada no onboarding para starter e nos admin)
CREATE OR REPLACE FUNCTION public.update_company_plan(
  p_company_id UUID,
  p_plan       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.companies
  SET plan = p_plan, updated_at = NOW()
  WHERE id = p_company_id
    AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_company_plan(UUID, TEXT)
  TO authenticated;

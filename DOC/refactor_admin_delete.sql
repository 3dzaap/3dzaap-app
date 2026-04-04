-- ============================================================
-- 3DZAAP: REFACTOR ADMIN DELETE (RPC) - Correção NOT NULL
-- Objetivo: Garantir Exclusão Perfeita de Contas e Utilizadores
-- ============================================================

-- 1. LIMPEZA: Remover as velhas Triggers causadoras de problemas (deadlocks)
DROP TRIGGER IF EXISTS trigger_cleanup_company_users ON public.companies;
DROP FUNCTION IF EXISTS public.cleanup_company_users();

-- 2. CRIAÇÃO DA RPC SEGURA: delete_company_full
-- Esta função é chamada via Supabase JS com os privilégios máximos (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_company_full(target_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- A. Identificar todos os utilizadores exclusivos a esta empresa (que devem ser apagados da auth)
  CREATE TEMP TABLE temp_users_to_delete ON COMMIT DROP AS
  SELECT user_id 
  FROM public.memberships 
  WHERE company_id = target_company_id
  AND user_id NOT IN (
    SELECT user_id FROM public.memberships WHERE company_id != target_company_id
  );

  -- B. Apagar primeiro a própria empresa (Isto desencadeia todas as cascatas em orders, filas, etc)
  -- NOTA: O owner_id não será tocado porque a exclusão da linha resolve o vínculo.
  DELETE FROM public.companies WHERE id = target_company_id;

  -- C. Por fim, sem nenhum vínculo a impedir, limpar os utilizadores órfãos da tabela 'auth'
  FOR v_user IN SELECT user_id FROM temp_users_to_delete LOOP
    DELETE FROM auth.users WHERE id = v_user.user_id;
  END LOOP;

  -- O sistema limpa as temporary tables automaticamente no final da transação
END;
$$;

-- SUCESSO: A RPC delete_company_full está pronta e validada contra restrições NOT NULL.

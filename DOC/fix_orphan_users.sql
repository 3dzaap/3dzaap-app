-- ============================================================
-- 3DZAAP: AUTOMATIC User Cleanup on Company Deletion
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Função com SECURITY DEFINER para apagar utilizadores da tabela auth.users.
-- Postgres protege esta tabela, pelo que apenas funções com privilégios elevados podem modificá-la.
CREATE OR REPLACE FUNCTION public.cleanup_company_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Apagar da tabela de autenticação (auth.users) todos os utilizadores
  -- que pertencem à empresa que está a ser apagada (OLD.id)
  -- APENAS se esses utilizadores não pertencerem a mais nenhuma outra empresa.
  DELETE FROM auth.users
  WHERE id IN (
    -- Seleciona utilizadores ligados a esta empresa via memberships
    SELECT user_id FROM public.memberships WHERE company_id = OLD.id
  )
  AND id NOT IN (
    -- Mas exclui utilizadores que ainda tenham outras memberships noutras empresas
    SELECT user_id FROM public.memberships WHERE company_id != OLD.id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar a Trigger 'BEFORE DELETE' na tabela 'companies'.
-- Tem de ser 'BEFORE' para que a tabela memberships ainda tenha os dados.
DROP TRIGGER IF EXISTS trigger_cleanup_company_users ON public.companies;
CREATE TRIGGER trigger_cleanup_company_users
BEFORE DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.cleanup_company_users();

-- SUCCESS: The system now automatically removes users from authentication 
-- when their primary company is definitively deleted.

-- ============================================================
-- 3DZAAP: CRIAR RPC get_users_metadata
-- Permite ao painel Admin ler email e nome dos utilizadores
-- de auth.users (protegida por RLS) de forma segura.
-- 
-- Execute este SQL no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_users_metadata()
RETURNS TABLE (
  id   uuid,
  email text,
  raw_user_meta_data jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, raw_user_meta_data
  FROM auth.users
  ORDER BY created_at DESC;
$$;

-- Garante que apenas SuperAdmins autenticados podem chamar esta função
REVOKE ALL ON FUNCTION public.get_users_metadata() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_metadata() TO authenticated;

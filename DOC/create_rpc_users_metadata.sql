DROP FUNCTION IF EXISTS public.get_users_metadata();

CREATE OR REPLACE FUNCTION public.get_users_metadata()
RETURNS TABLE (
    id uuid,
    email varchar,
    raw_user_meta_data jsonb,
    last_sign_in_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Segurança: Garantir que apenas os super admins podem executar esta função
    IF NOT EXISTS (
        SELECT 1 FROM public.super_admins 
        WHERE user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem aceder aos utilizadores globais.';
    END IF;

    RETURN QUERY 
    SELECT 
        u.id, 
        u.email::varchar, 
        u.raw_user_meta_data,
        u.last_sign_in_at
    FROM auth.users u;
END;
$$;

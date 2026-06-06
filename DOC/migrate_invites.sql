-- 1. Add pin column to invites
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS pin text;

-- 2. Drop existing RPC if exists
DROP FUNCTION IF EXISTS public.accept_invite_by_pin(text, text);
DROP FUNCTION IF EXISTS public.check_invite_pin(text, text);

-- 3. Check PIN quickly
CREATE OR REPLACE FUNCTION public.check_invite_pin(p_email text, p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite RECORD;
BEGIN
    SELECT * INTO v_invite FROM public.invites 
    WHERE lower(email) = lower(p_email) AND pin = p_pin AND accepted_at IS NULL AND expires_at > now();

    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'message', 'Convite inválido, PIN incorreto ou expirado.');
    END IF;

    RETURN json_build_object('valid', true, 'company_id', v_invite.company_id, 'role', v_invite.role);
END;
$$;

-- 4. RPC to accept invite and insert membership during onboarding
CREATE OR REPLACE FUNCTION public.accept_invite_by_pin(p_email text, p_pin text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite RECORD;
BEGIN
    SELECT * INTO v_invite FROM public.invites 
    WHERE lower(email) = lower(p_email) AND pin = p_pin AND accepted_at IS NULL AND expires_at > now();

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Convite inválido, PIN incorreto ou expirado.');
    END IF;

    -- Adicionar utilizador à empresa
    INSERT INTO public.memberships (company_id, user_id, role)
    VALUES (v_invite.company_id, p_user_id, v_invite.role)
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Marcar como aceite
    UPDATE public.invites SET accepted_at = now() WHERE id = v_invite.id;

    RETURN json_build_object('success', true, 'company_id', v_invite.company_id, 'role', v_invite.role);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invite_by_email(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email text;
    v_invite RECORD;
BEGIN
    -- Get user email from auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

    IF v_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Utilizador não encontrado');
    END IF;

    -- Find a valid invite for this email (case insensitive)
    SELECT * INTO v_invite
    FROM public.invites
    WHERE lower(email) = lower(v_email)
      AND accepted_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_invite IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Não existem convites pendentes');
    END IF;

    -- Insert membership (do nothing if it already exists, although we assume it doesn't)
    INSERT INTO public.memberships (company_id, user_id, role)
    VALUES (v_invite.company_id, p_user_id, v_invite.role)
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Mark invite as accepted
    UPDATE public.invites
    SET accepted_at = now()
    WHERE id = v_invite.id;

    RETURN jsonb_build_object('success', true, 'company_id', v_invite.company_id);
END;
$$;

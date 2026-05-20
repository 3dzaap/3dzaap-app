-- 1. Trigger para Adicionar Dono à tabela memberships automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.memberships (company_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- 2. Função RPC para Aceitar Convites (O frontend precisa disto para o utilizador entrar na empresa)
DROP FUNCTION IF EXISTS public.accept_invite(uuid);

CREATE OR REPLACE FUNCTION public.accept_invite(p_token uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
BEGIN
    -- Procurar convite válido
    SELECT * INTO v_invite FROM public.invites 
    WHERE id = p_token AND accepted_at IS NULL AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado.';
    END IF;

    -- Adicionar utilizador à empresa
    INSERT INTO public.memberships (company_id, user_id, role)
    VALUES (v_invite.company_id, auth.uid(), v_invite.role)
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Marcar como aceite
    UPDATE public.invites SET accepted_at = now() WHERE id = p_token;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

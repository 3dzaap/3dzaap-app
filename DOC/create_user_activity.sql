-- Tabela de rastreamento de acessos a módulos
CREATE TABLE IF NOT EXISTS public.user_activity (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    module text NOT NULL,
    last_visited_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, company_id, module)
);

-- NOVO PADRÃO: Garantir acesso à API para o esquema public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_activity TO anon, authenticated, service_role;

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Política: Utilizadores podem criar/atualizar e ler a sua própria atividade
CREATE POLICY "Utilizadores podem gerir própria atividade" 
ON public.user_activity FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Política: Super admins podem ler todas as atividades
CREATE POLICY "Super admins podem ler tudo" 
ON public.user_activity FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.super_admins 
        WHERE user_id = auth.uid()
    )
);

-- ============================================================
-- 3DZAAP: LIMPEZA DE UTILIZADORES ÓRFÃOS (ORPHAN USERS CLEANUP)
-- Este script elimina definivamente todos os utilizadores da plataforma (auth.users)
-- que não têm nenhuma utilidade (ex: Criaram conta mas a empresa foi apagada).
-- ============================================================

DELETE FROM auth.users 
WHERE id NOT IN (
    -- 1. Preservar quem é Dono de uma Empresa Ativa
    SELECT owner_id FROM public.companies WHERE owner_id IS NOT NULL
)
AND id NOT IN (
    -- 2. Preservar quem é Convidado / Membro de uma equipa
    SELECT user_id FROM public.memberships WHERE user_id IS NOT NULL
)
AND id NOT IN (
    -- 3. CRÍTICO: Preservar os Super Admins (Como a sua conta Woody!)
    SELECT user_id FROM public.super_admins WHERE user_id IS NOT NULL
);

-- ============================================================
-- RESULTADO:
-- Após executar isto, qualquer utilizador resíduo desaparecerá, 
-- otimizando a segurança e o custo do seu painel Supabase.

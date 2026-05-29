# Regras e Guias do Supabase (3DZaap)

Este arquivo documenta regras importantes para a manutenção e evolução do banco de dados no Supabase.

## 1. Criação de Novas Tabelas (Acesso à Data API)
Devido a uma atualização do Supabase (maio de 2026), novas tabelas criadas no esquema `public` **não** são mais expostas à Data API (PostgREST, GraphQL, supabase-js) por padrão.

Para garantir que o aplicativo consiga interagir com as tabelas recém-criadas, é **obrigatório** adicionar permissões explícitas (`GRANT`) no script de criação.

**Exemplo de Criação Padrão:**
```sql
-- 1. Criação da tabela
CREATE TABLE public.nome_da_tabela (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Permissão de Acesso à API (OBRIGATÓRIO)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nome_da_tabela TO anon, authenticated, service_role;

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.nome_da_tabela ENABLE ROW LEVEL SECURITY;

-- 4. Criar as Políticas de Segurança (Policies) de acordo com a necessidade
-- Exemplo: CREATE POLICY "Visualização pública" ON public.nome_da_tabela FOR SELECT USING (true);
```

> **Atenção (IA Assistant):** Sempre que for solicitado para gerar ou alterar o schema de banco de dados para o 3DZaap, certifique-se de seguir essa regra de `GRANT` para o esquema `public`.

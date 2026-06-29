-- 1. WIKI ENTRIES (Base and Migration)
CREATE TABLE IF NOT EXISTS public.wiki_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas da V2 caso a tabela já existisse
ALTER TABLE public.wiki_entries ADD COLUMN IF NOT EXISTS slicer_name TEXT DEFAULT 'Geral';
ALTER TABLE public.wiki_entries ADD COLUMN IF NOT EXISTS printers_compat TEXT[] DEFAULT array[]::TEXT[];
ALTER TABLE public.wiki_entries ADD COLUMN IF NOT EXISTS content_json JSONB DEFAULT '{}'::JSONB;

-- RLS Configuration for Entries
ALTER TABLE public.wiki_entries ENABLE ROW LEVEL SECURITY;

-- Limpar politicas antigas para evitar o erro "already exists"
DROP POLICY IF EXISTS "Anyone authenticated can view wiki entries" ON public.wiki_entries;
DROP POLICY IF EXISTS "Users can view their own wiki entries" ON public.wiki_entries;
DROP POLICY IF EXISTS "Users can insert their own wiki entries" ON public.wiki_entries;
DROP POLICY IF EXISTS "Users can update their own wiki entries" ON public.wiki_entries;
DROP POLICY IF EXISTS "Users can delete their own wiki entries" ON public.wiki_entries;

CREATE POLICY "Anyone authenticated can view wiki entries"
ON public.wiki_entries FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own wiki entries"
ON public.wiki_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wiki entries"
ON public.wiki_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wiki entries"
ON public.wiki_entries FOR DELETE
USING (auth.uid() = user_id);

-----------------------------------------
-- 2. RATINGS TABLE
-----------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.wiki_entries(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entry_id, user_id)
);

ALTER TABLE public.wiki_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view ratings" ON public.wiki_ratings;
DROP POLICY IF EXISTS "Users can insert their own rating" ON public.wiki_ratings;
DROP POLICY IF EXISTS "Users can update their own rating" ON public.wiki_ratings;
DROP POLICY IF EXISTS "Users can delete their own rating" ON public.wiki_ratings;

CREATE POLICY "Anyone authenticated can view ratings"
ON public.wiki_ratings FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own rating"
ON public.wiki_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rating"
ON public.wiki_ratings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rating"
ON public.wiki_ratings FOR DELETE
USING (auth.uid() = user_id);

-----------------------------------------
-- 3. FAVORITES TABLE
-----------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.wiki_entries(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entry_id, user_id)
);

ALTER TABLE public.wiki_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.wiki_favorites;
DROP POLICY IF EXISTS "Users can insert their own favorite" ON public.wiki_favorites;
DROP POLICY IF EXISTS "Users can delete their own favorite" ON public.wiki_favorites;

CREATE POLICY "Users can view their own favorites"
ON public.wiki_favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite"
ON public.wiki_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite"
ON public.wiki_favorites FOR DELETE
USING (auth.uid() = user_id);

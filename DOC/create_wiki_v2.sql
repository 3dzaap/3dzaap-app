
-- DROP OLD WIKI IF NEEDED (be careful in prod, this is just for dev setup)
-- DROP TABLE IF EXISTS public.wiki_favorites CASCADE;
-- DROP TABLE IF EXISTS public.wiki_ratings CASCADE;
-- DROP TABLE IF EXISTS public.wiki_entries CASCADE;

CREATE TABLE IF NOT EXISTS public.wiki_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    slicer_name TEXT NOT NULL,
    printers_compat TEXT[] DEFAULT array[]::TEXT[],
    content_json JSONB DEFAULT '{}\::JSONB,
    content TEXT, -- General notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Configuration for Entries
ALTER TABLE public.wiki_entries ENABLE ROW LEVEL SECURITY;

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
-- RATINGS TABLE
-----------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.wiki_entries(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entry_id, user_id) -- A user can only rate an entry once
);

ALTER TABLE public.wiki_ratings ENABLE ROW LEVEL SECURITY;

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
-- FAVORITES TABLE
-----------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.wiki_entries(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entry_id, user_id)
);

ALTER TABLE public.wiki_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
ON public.wiki_favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite"
ON public.wiki_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite"
ON public.wiki_favorites FOR DELETE
USING (auth.uid() = user_id);



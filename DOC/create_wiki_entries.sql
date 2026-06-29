CREATE TABLE IF NOT EXISTS public.wiki_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Configuration
ALTER TABLE public.wiki_entries ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own entries
CREATE POLICY "Users can insert their own wiki entries"
ON public.wiki_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own wiki entries"
ON public.wiki_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wiki entries"
ON public.wiki_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wiki entries"
ON public.wiki_entries FOR DELETE
USING (auth.uid() = user_id);


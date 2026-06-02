-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX 400 ERRORS
-- ==============================================================================

-- 1. Create user_activity table
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  module text NOT NULL,
  visit_count integer DEFAULT 1,
  last_visited_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_activity_unique UNIQUE (user_id, company_id, module)
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "user_activity_self_write" ON public.user_activity
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create increment_module_visit RPC
CREATE OR REPLACE FUNCTION public.increment_module_visit(p_user_id uuid, p_company_id uuid, p_module text)
RETURNS void AS $$
BEGIN
  UPDATE public.user_activity
  SET visit_count = visit_count + 1,
      last_visited_at = now()
  WHERE user_id = p_user_id AND company_id = p_company_id AND module = p_module;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create memberships table
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON public.memberships(company_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Memberships are viewable by users in the same company" 
      ON public.memberships FOR SELECT 
      USING ( company_id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1) );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Memberships are viewable by owner" 
      ON public.memberships FOR SELECT 
      USING ( company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid() LIMIT 1) );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 4. Create trigger to automatically add the owner to memberships when a company is created
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

-- ==============================================================================
-- DONE!
-- ==============================================================================

-- 5. Backfill existing owners
INSERT INTO public.memberships (company_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.companies
WHERE owner_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

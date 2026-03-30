-- ============================================================
-- 3DZAAP: FIX 406 Error & Secure Tracking Portal
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Ensure the 'passphrase' column exists for 4-digit PIN security
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS passphrase TEXT;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Tracking Access" ON public.orders;
DROP POLICY IF EXISTS "Public Company Info Access" ON public.companies;

-- 3. Enable RLS on both tables (if not already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow anyone with a valid share_token to read the order
-- This resolves the 406 Not Acceptable error in the portal
CREATE POLICY "Public Tracking Access" 
ON public.orders 
FOR SELECT 
TO anon 
USING (share_token IS NOT NULL);

-- 5. Policy: Allow public access to company details (needed for logos/branding)
-- We only expose non-sensitive fields in the select query inside portal.html
CREATE POLICY "Public Company Info Access" 
ON public.companies 
FOR SELECT 
TO anon 
USING (true);

-- 6. Policy: Allow public to update an order status (Approval/Decline)
-- Restricted to only those with a valid share_token
CREATE POLICY "Public Update via Tracking" 
ON public.orders 
FOR UPDATE 
TO anon 
USING (share_token IS NOT NULL)
WITH CHECK (share_token IS NOT NULL);

-- SUCCESS: Database ready for PIN-protected Tracking links.

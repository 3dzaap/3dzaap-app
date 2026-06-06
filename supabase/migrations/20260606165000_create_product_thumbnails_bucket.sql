-- Migration: create_product_thumbnails_bucket.sql
-- Creates the Storage bucket for 3D generated GIFs and configures RLS.

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_thumbnails', 'product_thumbnails', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS
-- Note: the storage.objects table might already have RLS enabled by default.

-- 3. Policy: Allow users to view thumbnails if they belong to the same company
-- Path format: company_id/filename.gif
CREATE POLICY "Users can view their company thumbnails" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'product_thumbnails' AND 
  (
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
);

-- 4. Policy: Allow users to upload thumbnails to their company folder
CREATE POLICY "Users can upload their company thumbnails" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'product_thumbnails' AND 
  (
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
);

-- 5. Policy: Allow users to update their company thumbnails
CREATE POLICY "Users can update their company thumbnails" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'product_thumbnails' AND 
  (
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
);

-- 6. Policy: Allow users to delete their company thumbnails
CREATE POLICY "Users can delete their company thumbnails" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'product_thumbnails' AND 
  (
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT company_id FROM public.memberships WHERE user_id = auth.uid()
    )
  )
);

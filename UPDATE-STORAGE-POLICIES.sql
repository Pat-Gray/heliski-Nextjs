-- Updated Supabase Storage Policies for Anonymous Access
-- Run these in your Supabase SQL Editor

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for heli-ski-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to heli-ski-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update heli-ski-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from heli-ski-files" ON storage.objects;

-- Create new policies that allow anonymous access
-- Policy 1: Allow anyone to read files (public access)
CREATE POLICY "Public read access for heli-ski-files" ON storage.objects
FOR SELECT USING (bucket_id = 'heli-ski-files');

-- Policy 2: Allow anyone to upload files (for your app)
CREATE POLICY "Public upload access for heli-ski-files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'heli-ski-files');

-- Policy 3: Allow anyone to update files
CREATE POLICY "Public update access for heli-ski-files" ON storage.objects
FOR UPDATE USING (bucket_id = 'heli-ski-files');

-- Policy 4: Allow anyone to delete files
CREATE POLICY "Public delete access for heli-ski-files" ON storage.objects
FOR DELETE USING (bucket_id = 'heli-ski-files');

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%heli-ski-files%';

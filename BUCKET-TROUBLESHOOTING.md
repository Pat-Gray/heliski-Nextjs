# Supabase Bucket Troubleshooting Guide

This guide helps you diagnose and fix issues with Supabase bucket detection and file storage.

## 🚨 **Common Issues & Solutions**

### **Issue 0: Authentication Errors (Most Common)**

**Symptoms:**
- "Auth session missing!" errors
- 401 Unauthorized when uploading files
- Bucket exists but file operations fail

**Solution: Update Storage Policies for Anonymous Access**

Since your app doesn't require user authentication, update the storage policies to allow anonymous access:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this SQL script:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Public read access for heli-ski-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to heli-ski-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update heli-ski-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from heli-ski-files" ON storage.objects;

-- Create new policies for anonymous access
CREATE POLICY "Public read access for heli-ski-files" ON storage.objects
FOR SELECT USING (bucket_id = 'heli-ski-files');

CREATE POLICY "Public upload access for heli-ski-files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'heli-ski-files');

CREATE POLICY "Public update access for heli-ski-files" ON storage.objects
FOR UPDATE USING (bucket_id = 'heli-ski-files');

CREATE POLICY "Public delete access for heli-ski-files" ON storage.objects
FOR DELETE USING (bucket_id = 'heli-ski-files');
```

3. Test with the simple script:
```bash
cd my-app
node test-upload-simple.js
```

### **Issue 1: "Available Buckets = 0"**

**Possible Causes:**
1. Bucket doesn't exist yet
2. Wrong Supabase project
3. Incorrect environment variables
4. Authentication issues
5. RLS policies blocking access

**Solutions:**

#### **Step 1: Check Environment Variables**
```bash
# Check your .env.local file
cat .env.local | grep SUPABASE
```

Should show:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### **Step 2: Run Connection Test**
1. Go to `http://localhost:3000/test-files`
2. Click **"Connection Test"** (blue button)
3. Check the results for:
   - Environment variables are set
   - Supabase URL is correct
   - Anon key is present and has correct length
   - Storage API calls succeed

#### **Step 3: Verify Supabase Project**
1. Go to your Supabase dashboard
2. Check the URL matches your environment variable
3. Go to **Settings** → **API** to verify your anon key

### **Issue 2: Bucket Exists But Not Detected**

**Possible Causes:**
1. Case sensitivity issues
2. Bucket name typos
3. Different project/database
4. RLS policies

**Solutions:**

#### **Step 1: Check Bucket Name Exactly**
- Bucket name must be exactly: `heli-ski-files`
- No extra spaces, different casing, or typos
- Check in Supabase dashboard: **Storage** → **Buckets**

#### **Step 2: Check Project**
- Ensure you're looking at the correct Supabase project
- Verify the project URL in your environment variables

#### **Step 3: Check RLS Policies**
Go to **Storage** → **Policies** and ensure these policies exist:

```sql
-- Allow public read access
CREATE POLICY "Public read access for heli-ski-files" ON storage.objects
FOR SELECT USING (bucket_id = 'heli-ski-files');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload to heli-ski-files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'heli-ski-files' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update heli-ski-files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'heli-ski-files' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete from heli-ski-files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'heli-ski-files' 
  AND auth.role() = 'authenticated'
);
```

### **Issue 3: Authentication Errors**

**Symptoms:**
- 401 Unauthorized errors
- "Invalid JWT" errors
- Bucket listing fails

**Solutions:**

#### **Step 1: Check Anon Key**
- Ensure the anon key is correct and not expired
- Get a fresh anon key from Supabase dashboard

#### **Step 2: Check RLS Policies**
- Ensure policies allow anonymous access for reading
- Check if policies require authentication

#### **Step 3: Test with Service Role Key (Development Only)**
For testing purposes, you can temporarily use the service role key:

```env
# In .env.local (REMOVE AFTER TESTING!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**⚠️ NEVER commit service role key to version control!**

## 🔧 **Manual Bucket Creation**

### **Step 1: Create Bucket in Supabase Dashboard**
1. Go to **Storage** → **Buckets**
2. Click **"New Bucket"**
3. Fill in:
   - **Name**: `heli-ski-files`
   - **Public bucket**: ✅ **Check this**
   - **File size limit**: `10485760` (10MB)
   - **Allowed MIME types**: `image/*,application/gpx+xml,application/xml,text/xml`

### **Step 2: Set Up Policies**
Go to **Storage** → **Policies** and create the policies listed above.

### **Step 3: Test Bucket**
1. Go to `http://localhost:3000/test-files`
2. Click **"Get Bucket Info"**
3. Should show "Available Buckets = 1" and "Bucket Exists: Yes"

## 🧪 **Testing Steps**

### **Step 1: Connection Test**
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{"testType": "connection-test"}'
```

### **Step 2: Bucket Info Test**
```bash
curl http://localhost:3000/api/test-files
```

### **Step 3: Create Bucket Test**
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{"testType": "create-bucket"}'
```

## 📋 **Debug Checklist**

- [ ] Environment variables are set correctly
- [ ] Supabase URL matches dashboard
- [ ] Anon key is valid and not expired
- [ ] Bucket exists with exact name `heli-ski-files`
- [ ] Bucket is set to public
- [ ] RLS policies are configured correctly
- [ ] No typos in bucket name or environment variables
- [ ] Using the correct Supabase project
- [ ] Network connectivity to Supabase

## 🆘 **Still Having Issues?**

1. **Check Console Logs**: Look at browser console and server logs for detailed error messages
2. **Test with cURL**: Use the curl commands above to test API directly
3. **Verify in Supabase Dashboard**: Manually check bucket exists and is configured correctly
4. **Check Network Tab**: Look for failed requests in browser dev tools
5. **Try Different Browser**: Rule out browser-specific issues

## 📞 **Getting Help**

If you're still stuck, provide:
1. Output from "Connection Test"
2. Output from "Get Bucket Info"
3. Browser console errors
4. Server logs
5. Your Supabase project URL (without the key)

This will help identify the exact issue! 🎯

// Simple test script to verify file upload works without authentication
// Run with: node test-upload-simple.js

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFileUpload() {
  console.log('🧪 Testing file upload without authentication...');
  
  try {
    // Test 1: List buckets
    console.log('📦 Listing buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }
    
    console.log('✅ Buckets found:', buckets.length);
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (public: ${bucket.public})`);
    });
    
    // Test 2: Check if heli-ski-files exists
    const targetBucket = 'heli-ski-files';
    const bucketExists = buckets.some(b => b.name === targetBucket);
    
    if (!bucketExists) {
      console.error(`❌ Bucket '${targetBucket}' not found`);
      console.log('Available buckets:', buckets.map(b => b.name));
      return;
    }
    
    console.log(`✅ Bucket '${targetBucket}' exists`);
    
    // Test 3: Try to upload a test file
    console.log('📁 Testing file upload...');
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
    
    const filePath = `test-uploads/test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, testFile);
    
    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      return;
    }
    
    console.log('✅ Upload successful:', uploadData);
    
    // Test 4: Try to download the file
    console.log('📥 Testing file download...');
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(targetBucket)
      .download(filePath);
    
    if (downloadError) {
      console.error('❌ Download failed:', downloadError);
      return;
    }
    
    const text = await downloadData.text();
    console.log('✅ Download successful:', text);
    
    // Test 5: Clean up
    console.log('🗑️ Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from(targetBucket)
      .remove([filePath]);
    
    if (deleteError) {
      console.error('⚠️ Cleanup failed:', deleteError);
    } else {
      console.log('✅ Cleanup successful');
    }
    
    console.log('🎉 All tests passed! File storage is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFileUpload();

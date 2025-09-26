// Test API for file upload and retrieval operations
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateSupabaseFilePath, uploadFile, deleteFile } from '@/lib/file-upload';

export async function GET() {
  try {
    console.log('🧪 Testing file operations...');
    
    // Test 1: Get bucket info first with detailed debugging
    console.log('🔍 Checking Supabase connection...');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    console.log('📦 Raw buckets response:', { data: buckets, error: bucketsError });
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to list buckets',
        details: bucketsError.message,
        debug: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          errorCode: bucketsError.statusCode,
          errorMessage: bucketsError.message
        }
      }, { status: 500 });
    }

    console.log('✅ Buckets listed successfully:', buckets?.length || 0);
    console.log('📋 All buckets:', buckets?.map(b => ({ name: b.name, id: b.id, public: b.public, created_at: b.created_at })));

    // Check if our target bucket exists
    const targetBucket = 'heli-ski-files';
    const bucketExists = buckets?.some(b => b.name === targetBucket) || false;
    
    console.log(`📦 Target bucket '${targetBucket}' exists:`, bucketExists);
    
    // Detailed bucket analysis
    const targetBucketData = buckets?.find(b => b.name === targetBucket);
    console.log(`🔍 Target bucket details:`, targetBucketData);
    
    // Check for similar bucket names (case sensitivity, typos, etc.)
    const similarBuckets = buckets?.filter(b => 
      b.name.toLowerCase().includes('heli') || 
      b.name.toLowerCase().includes('ski') || 
      b.name.toLowerCase().includes('files')
    ) || [];
    console.log(`🔍 Similar buckets found:`, similarBuckets);

    // Test 2: List files in the bucket (only if it exists)
    let files = null;
    let listError = null;
    
    if (bucketExists) {
      const { data: filesData, error: filesError } = await supabase.storage
        .from(targetBucket)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      files = filesData;
      listError = filesError;

      if (listError) {
        console.error('❌ Error listing files:', listError);
      } else {
        console.log('✅ Files listed successfully:', files?.length || 0);
      }
    } else {
      console.log('⚠️ Target bucket does not exist, skipping file listing');
    }

    // Test 3: Check specific file structure (only if bucket exists)
    let fileChecks = [];
    if (bucketExists) {
      const testRunId = 'test-run-123';
      const testPaths = [
        `runs/${testRunId}/gpx/test.gpx`,
        `runs/${testRunId}/images/run_photos/test.jpg`,
        `runs/${testRunId}/images/avalanche_photos/test.jpg`,
        `runs/${testRunId}/images/additional_photos/test.jpg`
      ];

      fileChecks = await Promise.all(
        testPaths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from(targetBucket)
            .list(path.split('/').slice(0, -1).join('/'));
          
          return {
            path,
            exists: !error && data !== null,
            error: error?.message || null
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      message: bucketExists ? 'File operations test completed' : 'Bucket does not exist - needs to be created',
      results: {
        bucketInfo: {
          buckets: buckets?.map(b => ({ name: b.name, public: b.public, id: b.id, created_at: b.created_at })) || [],
          targetBucket: targetBucket,
          bucketExists: bucketExists,
          needsCreation: !bucketExists,
          targetBucketData: targetBucketData,
          similarBuckets: similarBuckets,
          debug: {
            totalBuckets: buckets?.length || 0,
            bucketNames: buckets?.map(b => b.name) || [],
            caseSensitiveCheck: buckets?.some(b => b.name === 'heli-ski-files') || false,
            caseInsensitiveCheck: buckets?.some(b => b.name.toLowerCase() === 'heli-ski-files') || false
          }
        },
        fileListing: bucketExists ? {
          totalFiles: files?.length || 0,
          files: files?.slice(0, 10).map(f => ({
            name: f.name,
            size: f.metadata?.size || 'unknown',
            lastModified: f.updated_at,
            path: f.name
          })) || [],
          error: listError?.message || null
        } : {
          totalFiles: 0,
          files: [],
          error: 'Bucket does not exist'
        },
        structureTest: {
          testPaths: fileChecks,
          expectedStructure: {
            gpx: 'runs/{runId}/gpx/{timestamp}.gpx',
            runPhotos: 'runs/{runId}/images/run_photos/{timestamp}.{ext}',
            avalanchePhotos: 'runs/{runId}/images/avalanche_photos/{timestamp}.{ext}',
            additionalPhotos: 'runs/{runId}/images/additional_photos/{timestamp}.{ext}'
          }
        }
      }
    });

  } catch (error: unknown) {
    console.error('❌ Test API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing file upload...');
    
    const body = await request.json();
    const { testType = 'upload', runId = 'test-run-' + Date.now() } = body;

    if (testType === 'upload') {
      // Test file upload with a simple text file
      const testContent = `Test file created at ${new Date().toISOString()}`;
      const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
      
      const filePath = generateSupabaseFilePath(runId, 'gpx', 'test.txt', 'gpxPath');
      console.log('📁 Generated file path:', filePath);

      const result = await uploadFile('heli-ski-files', filePath, testFile, 'gpx');
      
      if (result.status === 'success') {
        console.log('✅ Test file uploaded successfully:', result.url);
        
        // Test file retrieval
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('heli-ski-files')
          .download(filePath);

        if (downloadError) {
          console.error('❌ Error downloading test file:', downloadError);
        } else {
          const text = await fileData.text();
          console.log('✅ Test file downloaded successfully:', text);
        }

        return NextResponse.json({
          success: true,
          message: 'File upload test completed',
          results: {
            upload: result,
            download: {
              success: !downloadError,
              content: downloadError ? null : await fileData.text(),
              error: downloadError?.message || null
            }
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Upload failed',
          details: result.error
        }, { status: 500 });
      }
    }

    if (testType === 'cleanup') {
      // Test file cleanup
      const { filePath } = body;
      
      if (!filePath) {
        return NextResponse.json({
          success: false,
          error: 'filePath is required for cleanup test'
        }, { status: 400 });
      }

      const result = await deleteFile('heli-ski-files', filePath);
      
      return NextResponse.json({
        success: true,
        message: 'File cleanup test completed',
        results: result
      });
    }

    if (testType === 'structure') {
      // Test file structure generation
      const testCases = [
        { runId: 'test-1', fileType: 'gpx' as const, filename: 'track.gpx', fieldName: 'gpxPath' },
        { runId: 'test-2', fileType: 'image' as const, filename: 'photo.jpg', fieldName: 'runPhoto' },
        { runId: 'test-3', fileType: 'image' as const, filename: 'avalanche.png', fieldName: 'avalanchePhoto' },
        { runId: 'test-4', fileType: 'image' as const, filename: 'extra.gif', fieldName: 'additionalPhotos' }
      ];

      const generatedPaths = testCases.map(test => ({
        ...test,
        generatedPath: generateSupabaseFilePath(test.runId, test.fileType, test.filename, test.fieldName)
      }));

      return NextResponse.json({
        success: true,
        message: 'File structure test completed',
        results: {
          testCases: generatedPaths,
          expectedPatterns: {
            gpx: 'runs/{runId}/gpx/{timestamp}.gpx',
            runPhoto: 'runs/{runId}/images/run_photos/{timestamp}.{ext}',
            avalanchePhoto: 'runs/{runId}/images/avalanche_photos/{timestamp}.{ext}',
            additionalPhotos: 'runs/{runId}/images/additional_photos/{timestamp}.{ext}'
          }
        }
      });
    }

    if (testType === 'connection-test') {
      // Comprehensive connection and authentication test
      console.log('🔍 Running comprehensive connection test...');
      
      const results = {
        environment: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
        },
        storage: {
          listBuckets: null as any,
          listFiles: null as any
        },
        auth: {
          getSession: null as any,
          getUser: null as any
        }
      };

      // Test 1: List buckets
      console.log('📦 Testing bucket listing...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      results.storage.listBuckets = { data: buckets, error: bucketsError };
      console.log('Buckets result:', { data: buckets, error: bucketsError });

      // Test 2: Try to list files from a known bucket (if any exist)
      if (buckets && buckets.length > 0) {
        console.log('📁 Testing file listing from first bucket...');
        const firstBucket = buckets[0];
        const { data: files, error: filesError } = await supabase.storage
          .from(firstBucket.name)
          .list('', { limit: 5 });
        results.storage.listFiles = { 
          bucket: firstBucket.name, 
          data: files, 
          error: filesError 
        };
        console.log('Files result:', { bucket: firstBucket.name, data: files, error: filesError });
      }

      // Test 3: Check authentication (optional for file storage)
      console.log('🔐 Testing authentication...');
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      results.auth.getSession = { data: session, error: sessionError };
      console.log('Session result:', { data: session, error: sessionError });

      const { data: user, error: userError } = await supabase.auth.getUser();
      results.auth.getUser = { data: user, error: userError };
      console.log('User result:', { data: user, error: userError });

      // Note: Authentication errors are expected if using anonymous access
      if (userError && userError.message.includes('Auth session missing')) {
        console.log('ℹ️ Authentication not required - using anonymous access');
        results.auth.note = 'Authentication not required - using anonymous access';
      }

      return NextResponse.json({
        success: true,
        message: 'Connection test completed',
        results
      });
    }

    if (testType === 'create-bucket') {
      // Test bucket creation
      const bucketName = 'heli-ski-files';
      
      console.log('🔍 Checking if bucket already exists...');
      // First check if bucket already exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      console.log('📦 Buckets check result:', { data: buckets, error: listError });
      
      if (listError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to list buckets',
          details: listError.message,
          debug: {
            errorCode: listError.statusCode,
            errorMessage: listError.message
          }
        }, { status: 500 });
      }

      const bucketExists = buckets?.some(b => b.name === bucketName) || false;
      console.log(`📦 Bucket '${bucketName}' exists:`, bucketExists);
      
      if (bucketExists) {
        return NextResponse.json({
          success: true,
          message: 'Bucket already exists',
          results: {
            bucketName,
            exists: true,
            action: 'none'
          }
        });
      }

      // Try to create the bucket
      const { data: createData, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/*', 'application/gpx+xml', 'application/xml', 'text/xml'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (createError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create bucket',
          details: createError.message,
          results: {
            bucketName,
            exists: false,
            action: 'failed'
          }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Bucket created successfully',
        results: {
          bucketName,
          exists: true,
          action: 'created',
          data: createData
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid test type. Use: upload, cleanup, structure, or create-bucket'
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('❌ Test API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

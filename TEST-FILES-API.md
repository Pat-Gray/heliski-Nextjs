# File Storage Test API

This document describes how to test the Supabase file storage operations to ensure files are being stored and retrieved properly.

## Test Page

Visit: `http://localhost:3000/test-files`

This page provides a user-friendly interface to test all file operations.

**⚠️ IMPORTANT:** If you see "Available Buckets = 0", it means the `heli-ski-files` bucket doesn't exist yet. Click the **"Create Bucket"** button to create it first!

## API Endpoints

### GET `/api/test-files`
Get bucket information and list existing files.

**Response:**
```json
{
  "success": true,
  "message": "File operations test completed",
  "results": {
    "bucketInfo": {
      "buckets": [{"name": "heli-ski-files", "public": true}],
      "targetBucket": "heli-ski-files"
    },
    "fileListing": {
      "totalFiles": 5,
      "files": [...]
    },
    "structureTest": {
      "testPaths": [...],
      "expectedStructure": {...}
    }
  }
}
```

### POST `/api/test-files`
Test file operations.

**Test Types:**

#### 1. Upload Test
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{"testType": "upload"}'
```

#### 2. Structure Test
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{"testType": "structure"}'
```

#### 3. Cleanup Test
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{"testType": "cleanup", "filePath": "runs/test-run-123/gpx/test.txt"}'
```

#### 4. Create Bucket Test
```bash
curl -X POST http://localhost:3000/api/test-files \
  -H "Content-Type: application/json" \
  -d '{"testType": "create-bucket"}'
```

## What Each Test Does

### 1. **Get Bucket Info** (GET)
- Lists all available buckets
- Shows bucket configuration (public/private)
- Lists files in the target bucket
- Tests file structure validation

### 2. **Upload Test** (POST with testType: "upload")
- Creates a test text file
- Uploads it to the bucket using the file upload utility
- Tests file path generation
- Downloads the file back to verify it was stored correctly
- Returns upload and download results

### 3. **Structure Test** (POST with testType: "structure")
- Tests the `generateSupabaseFilePath` function
- Generates file paths for all file types (GPX, run photos, avalanche photos, additional photos)
- Verifies the path structure matches expected patterns

### 4. **Cleanup Test** (POST with testType: "cleanup")
- Tests file deletion functionality
- Requires a file path from a previous upload test
- Verifies files can be removed from the bucket

### 5. **Create Bucket Test** (POST with testType: "create-bucket")
- Creates the `heli-ski-files` bucket if it doesn't exist
- Sets bucket as public with appropriate file type restrictions
- Configures 10MB file size limit
- Returns bucket creation status and details

## Expected File Structure

```
heli-ski-files/
└── runs/
    └── {runId}/
        ├── gpx/
        │   └── {timestamp}.gpx
        └── images/
            ├── run_photos/
            │   └── {timestamp}.{ext}
            ├── avalanche_photos/
            │   └── {timestamp}.{ext}
            └── additional_photos/
                └── {timestamp}.{ext}
```

## Troubleshooting

### Common Issues:

1. **Bucket Not Found**
   - Ensure the `heli-ski-files` bucket exists in Supabase
   - Check bucket permissions

2. **Upload Fails**
   - Verify Supabase environment variables are set
   - Check file size limits (10MB max)
   - Ensure bucket allows public uploads

3. **Download Fails**
   - Check if file was actually uploaded
   - Verify file path is correct
   - Ensure bucket allows public downloads

4. **Permission Errors**
   - Check Supabase RLS policies
   - Verify bucket is set to public
   - Check API key permissions

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Manual Testing Steps

1. **Start the development server**: `npm run dev`
2. **Visit the test page**: `http://localhost:3000/test-files`
3. **Click "Get Bucket Info"** to verify bucket access
4. **If bucket doesn't exist**: Click **"Create Bucket"** to create the `heli-ski-files` bucket
5. **Click "Test Upload"** to test file upload/download
6. **Click "Test Structure"** to verify path generation
7. **Click "Cleanup Test"** to test file deletion (after upload)

This comprehensive test suite ensures your file storage system is working correctly! 🎉

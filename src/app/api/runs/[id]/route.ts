// Next.js API route for individual run operations
import { NextRequest, NextResponse } from 'next/server';
import { supabase, updateRun, deleteRun, deleteFile } from '@/lib/supabase-db';
import { updateRunSchema } from '@/lib/schemas/schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Fetching run:', id);
    const { data: result, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !result) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    console.log('✅ Run fetched successfully:', result.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Updating run:', id);
    const body = await request.json();
    console.log('📝 Request body:', body);
    
    const validatedData = updateRunSchema.parse(body);
    console.log('✅ Validated data:', validatedData);
    
    const result = await updateRun(id, validatedData);
    console.log('✅ Run updated successfully:', result.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Patching run:', id);
    const body = await request.json();
    console.log('📝 Request body:', body);
    
    // For PATCH, we can update any fields (keep camelCase for updateRun function)
    const updateData: {
      status?: string;
      statusComment?: string | null;
      gpxPath?: string;
      runPhoto?: string;
      avalanchePhoto?: string;
      additionalPhotos?: string[];
    } = {};
    
    if (body.status !== undefined) updateData.status = body.status;
    if (body.statusComment !== undefined) updateData.statusComment = body.statusComment;
    if (body.gpxPath !== undefined) updateData.gpxPath = body.gpxPath;
    if (body.runPhoto !== undefined) updateData.runPhoto = body.runPhoto;
    if (body.avalanchePhoto !== undefined) updateData.avalanchePhoto = body.avalanchePhoto;
    if (body.additionalPhotos !== undefined) updateData.additionalPhotos = body.additionalPhotos;
    
    console.log('✅ Update data:', updateData);
    
    const result = await updateRun(id, updateData);
    console.log('✅ Run updated successfully:', result.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Deleting run:', id);
    
    // Get the run first to delete associated files
    const { data: existingRun, error: fetchError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    
    // Delete associated files from Supabase Storage
    const filesToDelete = [
      existingRun.gpx_path,
      existingRun.run_photo,
      existingRun.avalanche_photo,
      ...(existingRun.additional_photos || [])
    ].filter(Boolean);
    
    for (const fileUrl of filesToDelete) {
      if (fileUrl) {
        try {
          // Extract path from Supabase URL
          const url = new URL(fileUrl);
          const pathParts = url.pathname.split('/');
          
          // Expected format: /storage/v1/object/public/bucket/path/to/file
          // We want to extract everything after the bucket name
          if (pathParts.length > 4 && pathParts[1] === 'storage' && pathParts[2] === 'v1' && pathParts[3] === 'object' && pathParts[4] === 'public') {
            const bucketIndex = 5;
            const path = pathParts.slice(bucketIndex + 1).join('/');
            await deleteFile('heli-ski-files', path);
            console.log('✅ Deleted file:', path);
          } else {
            console.warn('Unexpected URL format:', fileUrl);
          }
        } catch (error) {
          console.warn('Failed to delete file from Supabase:', fileUrl, error);
        }
      }
    }
    
    // Delete the run from database
    await deleteRun(id);
    console.log('✅ Run deleted successfully:', id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
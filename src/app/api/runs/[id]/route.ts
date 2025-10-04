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
    const { data: result, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !result) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
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
    const body = await request.json();
    const validatedData = updateRunSchema.parse(body);
    const result = await updateRun(id, validatedData);
    return NextResponse.json(result);
  } catch (error: unknown) {
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
    const body = await request.json();
    
    // For PATCH, we can update any fields (keep camelCase for updateRun function)
    const updateData: {
      status?: string;
      statusComment?: string | null;
      runDescription?: string;
      runNotes?: string;
      gpxPath?: string;
      runPhoto?: string;
      avalanchePhoto?: string;
      additionalPhotos?: string[];
    } = {};
    
    if (body.status !== undefined) updateData.status = body.status;
    if (body.statusComment !== undefined) updateData.statusComment = body.statusComment;
    if (body.runDescription !== undefined) updateData.runDescription = body.runDescription;
    if (body.runNotes !== undefined) updateData.runNotes = body.runNotes;
    if (body.gpxPath !== undefined) updateData.gpxPath = body.gpxPath;
    if (body.runPhoto !== undefined) updateData.runPhoto = body.runPhoto;
    if (body.avalanchePhoto !== undefined) updateData.avalanchePhoto = body.avalanchePhoto;
    if (body.additionalPhotos !== undefined) updateData.additionalPhotos = body.additionalPhotos;
    
    const result = await updateRun(id, updateData);
    return NextResponse.json(result);
  } catch (error: unknown) {
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
          }
        } catch {
          // Silently continue if file deletion fails
        }
      }
    }
    
    // Delete the run from database
    await deleteRun(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
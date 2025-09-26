import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-db';
import { generateSupabaseFilePath } from '@/lib/file-upload';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const runId = formData.get('runId') as string;
    const fieldName = formData.get('fieldName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!runId) {
      return NextResponse.json({ error: 'No runId provided' }, { status: 400 });
    }

    if (!fieldName) {
      return NextResponse.json({ error: 'No fieldName provided' }, { status: 400 });
    }

    // Determine file type based on field name
    const fileType = fieldName === 'gpxPath' ? 'gpx' : 'image';

    // Generate file path
    const filePath = generateSupabaseFilePath(runId, fileType, file.name, fieldName as 'gpxPath' | 'runPhoto' | 'avalanchePhoto' | 'additionalPhotos');

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('heli-ski-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('heli-ski-files')
      .getPublicUrl(filePath);

    console.log('✅ File uploaded successfully:', filePath);
    return NextResponse.json({ 
      success: true, 
      url: urlData.publicUrl,
      path: filePath 
    });

  } catch (error: unknown) {
    console.error('❌ Upload API Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
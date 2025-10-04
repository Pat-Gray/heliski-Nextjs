import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function POST(_request: NextRequest) {
  try {
    console.log('🪣 Creating CalTopo storage bucket...');

    // Create the caltopo bucket
    const { data, error } = await supabaseAdmin.storage.createBucket('caltopo', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
    });

    if (error) {
      console.error('❌ Failed to create bucket:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 });
    }

    console.log('✅ CalTopo bucket created successfully');

    return NextResponse.json({
      success: true,
      message: 'CalTopo bucket created successfully',
      bucket: data
    });

  } catch (error: unknown) {
    console.error('❌ Bucket creation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}

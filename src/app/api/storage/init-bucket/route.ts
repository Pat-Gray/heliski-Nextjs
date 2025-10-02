import { NextResponse } from 'next/server';
import { initializeStorageBucket } from '../../../../lib/supabase-storage';

export async function POST() {
  try {
    console.log('🔄 Initializing storage bucket...');
    
    await initializeStorageBucket();
    
    console.log('✅ Storage bucket initialized successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Storage bucket initialized successfully'
    });
  } catch (error: unknown) {
    console.error('❌ Failed to initialize storage bucket:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        success: false 
      },
      { status: 500 }
    );
  }
}

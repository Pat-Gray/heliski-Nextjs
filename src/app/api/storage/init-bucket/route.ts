import { NextRequest, NextResponse } from 'next/server';
import { initializeStorageBucket } from '../../../../lib/supabase-storage';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Initializing storage bucket...');
    
    await initializeStorageBucket();
    
    console.log('✅ Storage bucket initialized successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Storage bucket initialized successfully'
    });
  } catch (error: any) {
    console.error('❌ Failed to initialize storage bucket:', error);
    
    return NextResponse.json(
      { 
        error: error.message,
        success: false 
      },
      { status: 500 }
    );
  }
}

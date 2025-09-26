// Next.js API route for runs
import { NextRequest, NextResponse } from 'next/server';
import { getRuns, createRun } from '@/lib/supabase-db';
import { insertRunSchema } from '@/lib/schemas/schema';

export async function GET() {
  try {
    console.log('🔄 Fetching runs...');
    console.log('Environment check:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
    });
    
    const result = await getRuns();
    console.log('✅ Runs fetched successfully:', result.length);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Creating run...');
    const body = await request.json();
    console.log('📝 Request body:', body);
    
    const validatedData = insertRunSchema.parse(body);
    console.log('✅ Validated data:', validatedData);
    
    const result = await createRun(validatedData);
    console.log('✅ Run created successfully:', result.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    console.error('❌ API Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
// Next.js API route for sub-areas
import { NextRequest, NextResponse } from 'next/server';
import { getSubAreas, createSubArea } from '@/lib/supabase-db';
import { insertSubAreaSchema } from '@/lib/schemas/schema';

export async function GET() {
  try {
    console.log('🔄 Fetching sub-areas...');
    const result = await getSubAreas();
    console.log('✅ Sub-areas fetched successfully:', result.length);
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

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Creating sub-area...');
    const body = await request.json();
    const validatedData = insertSubAreaSchema.parse(body);
    const result = await createSubArea(validatedData);
    console.log('✅ Sub-area created successfully:', result.id);
    return NextResponse.json(result, { status: 201 });
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
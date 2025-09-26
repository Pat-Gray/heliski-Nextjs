// Next.js API route for areas
import { NextRequest, NextResponse } from 'next/server';
import { getAreas, createArea } from '@/lib/supabase-db';
import { insertAreaSchema } from '@/lib/schemas/schema';

export async function GET() {
  try {
    console.log('🔄 Fetching areas...');
    const result = await getAreas();
    console.log('✅ Areas fetched successfully:', result.length);
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
    console.log('🔄 Creating area...');
    const body = await request.json();
    const validatedData = insertAreaSchema.parse(body);
    const result = await createArea(validatedData);
    console.log('✅ Area created successfully:', result.id);
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
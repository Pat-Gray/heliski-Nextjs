// Next.js API route for daily plans
import { NextRequest, NextResponse } from 'next/server';
import { getDailyPlans, createDailyPlan } from '@/lib/supabase-db';
import { insertDailyPlanSchema } from '@/lib/schemas/schema';

export async function GET() {
  try {
    console.log('🔄 Fetching daily plans...');
    const result = await getDailyPlans();
    console.log('✅ Daily plans fetched successfully:', result.length);
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
    console.log('🔄 Creating daily plan...');
    const body = await request.json();
    const validatedData = insertDailyPlanSchema.parse(body);
    const result = await createDailyPlan(validatedData);
    console.log('✅ Daily plan created successfully:', result.id);
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
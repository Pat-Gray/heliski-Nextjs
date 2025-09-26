// Next.js API route for daily plans by date
import { NextRequest, NextResponse } from 'next/server';
import { getDailyPlanByDate } from '@/lib/supabase-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    console.log('🔄 Fetching daily plan for date:', date);
    
    const result = await getDailyPlanByDate(date);
    console.log('✅ Daily plan fetched successfully:', result.id);
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
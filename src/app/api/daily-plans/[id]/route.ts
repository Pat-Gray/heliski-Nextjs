// Next.js API route for individual daily plan operations
import { NextRequest, NextResponse } from 'next/server';
import { getDailyPlanById, updateDailyPlan, deleteDailyPlan } from '@/lib/supabase-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Fetching daily plan:', id);
    const result = await getDailyPlanById(id);
    
    if (!result) {
      console.log('ℹ️ No daily plan found for id:', id);
      return NextResponse.json({ message: 'Daily plan not found' }, { status: 404 });
    }
    
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Updating daily plan:', id);
    const body = await request.json();
    const result = await updateDailyPlan(id, body);
    console.log('✅ Daily plan updated successfully:', result.id);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Deleting daily plan:', id);
    await deleteDailyPlan(id);
    console.log('✅ Daily plan deleted successfully:', id);
    return NextResponse.json({ success: true });
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

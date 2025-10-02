import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('⏰ Cron job triggered - GPX refresh:', {
    url: request.url,
    timestamp: new Date().toISOString()
  });

  try {
    // Verify this is a legitimate cron request (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the refresh cache API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const refreshResponse = await fetch(`${baseUrl}/api/caltopo/refresh-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!refreshResponse.ok) {
      throw new Error(`Refresh cache failed: ${refreshResponse.statusText}`);
    }

    const result = await refreshResponse.json();
    
    console.log('✅ Cron job completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'GPX cache refresh completed',
      result
    });

  } catch (error: unknown) {
    console.error('❌ Cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

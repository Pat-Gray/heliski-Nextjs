import { NextRequest, NextResponse } from 'next/server';
import { getSignedGPXUrl, gpxExists } from '../../../../lib/supabase-storage';
import { supabase } from '../../../../lib/supabase-db';

interface GPXUrlRequest {
  runId: string;
}

interface GPXUrlResponse {
  success: boolean;
  gpxUrl?: string;
  cached: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  console.log('🔗 GPX URL API - Request Started:', {
    url: request.url,
    timestamp: new Date().toISOString()
  });

  try {
    const body: GPXUrlRequest = await request.json();
    const { runId } = body;

    console.log('📝 GPX URL Request:', {
      runId: runId ? `${runId.substring(0, 8)}...` : 'none'
    });

    if (!runId) {
      return NextResponse.json(
        { error: 'Missing required field: runId' },
        { status: 400 }
      );
    }

    // Get run data
    const { data: runData, error: runError } = await supabase
      .from('runs')
      .select('id, name, caltopo_map_id, caltopo_feature_id, gpx_path')
      .eq('id', runId)
      .single();

    if (runError || !runData) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const run = runData;

    console.log('📊 Run data:', {
      runId: run.id,
      name: run.name,
      hasCalTopoLink: !!(run.caltopo_map_id && run.caltopo_feature_id),
      hasGpxPath: !!run.gpx_path
    });

    // Check if run is linked to CalTopo
    if (!run.caltopo_map_id || !run.caltopo_feature_id) {
      return NextResponse.json({
        success: false,
        cached: false,
        error: 'Run is not linked to CalTopo'
      });
    }

    // Check if we already have a URL stored (public or signed)
    if (run.gpx_path) {
      console.log('✅ Using stored URL:', {
        runId: run.id,
        urlLength: run.gpx_path.length,
        urlPreview: run.gpx_path.substring(0, 100) + '...',
        isPublicUrl: run.gpx_path.includes('/public/')
      });

      const response: GPXUrlResponse = {
        success: true,
        gpxUrl: run.gpx_path,
        cached: true
      };

      return NextResponse.json(response);
    }

    // Check if GPX exists in storage
    const exists = await gpxExists(run.caltopo_map_id, run.caltopo_feature_id);
    
    if (!exists) {
      console.log('⚠️ GPX not cached, triggering cache...');
      
      // Trigger cache-gpx API
      try {
        const cacheResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/caltopo/cache-gpx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mapId: run.caltopo_map_id,
            featureId: run.caltopo_feature_id,
            runId: run.id
          })
        });

        if (!cacheResponse.ok) {
          throw new Error(`Cache failed: ${cacheResponse.statusText}`);
        }

        const cacheResult = await cacheResponse.json();
        console.log('✅ GPX cached successfully:', cacheResult);
        
        // Return the public URL from cache result
        const response: GPXUrlResponse = {
          success: true,
          gpxUrl: cacheResult.path, // This is now the public URL
          cached: true
        };

        return NextResponse.json(response);
      } catch (cacheError: any) {
        console.error('❌ Failed to cache GPX:', cacheError);
        return NextResponse.json({
          success: false,
          cached: false,
          error: `Failed to cache GPX: ${cacheError.message}`
        });
      }
    }

    // Generate public URL (fallback case)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const gpxUrl = `${supabaseUrl}/storage/v1/object/public/gpx/gpx/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`;
      
      console.log('✅ Public URL generated (fallback):', {
        runId: run.id,
        mapId: run.caltopo_map_id.substring(0, 8) + '...',
        featureId: run.caltopo_feature_id.substring(0, 8) + '...',
        urlLength: gpxUrl.length
      });

      const response: GPXUrlResponse = {
        success: true,
        gpxUrl,
        cached: exists
      };

      return NextResponse.json(response);

    } catch (urlError: any) {
      console.error('❌ Failed to generate public URL:', urlError);
      return NextResponse.json({
        success: false,
        cached: exists,
        error: `Failed to generate GPX URL: ${urlError.message}`
      });
    }

  } catch (error: any) {
    console.error('❌ GPX URL API Error:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    });

    return NextResponse.json({
      success: false,
      cached: false,
      error: error.message
    }, { status: 500 });
  }
}

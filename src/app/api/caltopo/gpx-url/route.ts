import { NextRequest, NextResponse } from 'next/server';
import { gpxExists } from '../../../../lib/supabase-storage';
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
  // GPX URL API request started

  try {
    const body: GPXUrlRequest = await request.json();
    const { runId } = body;

    // Processing GPX URL request

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

    // Run data retrieved

    // Check if run is linked to CalTopo
    if (!run.caltopo_map_id || !run.caltopo_feature_id) {
      return NextResponse.json({
        success: false,
        cached: false,
        error: 'Run is not linked to CalTopo'
      });
    }

    // Always generate a fresh public URL to avoid JWT expiry issues
    // Check if GPX exists in storage first
    const exists = await gpxExists(run.caltopo_map_id, run.caltopo_feature_id);
    
    if (exists) {
      // Generate fresh public URL for existing GPX
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/heli-ski-files/runs/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`;
      
      const response: GPXUrlResponse = {
        success: true,
        gpxUrl: publicUrl,
        cached: true
      };

      return NextResponse.json(response);
    }
    
    if (!exists) {
      // GPX not cached, triggering cache
      
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
        // GPX cached successfully
        
        // Return the public URL from cache result
        const response: GPXUrlResponse = {
          success: true,
          gpxUrl: cacheResult.path, // This is now the public URL
          cached: true
        };

        return NextResponse.json(response);
      } catch (cacheError: unknown) {
        // Failed to cache GPX
        return NextResponse.json({
          success: false,
          cached: false,
          error: `Failed to cache GPX: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`
        });
      }
    }

    // Generate public URL (fallback case)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const gpxUrl = `${supabaseUrl}/storage/v1/object/public/heli-ski-files/runs/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`;
      
      // Public URL generated (fallback)

      const response: GPXUrlResponse = {
        success: true,
        gpxUrl,
        cached: exists
      };

      return NextResponse.json(response);

    } catch (urlError: unknown) {
      // Failed to generate public URL
      return NextResponse.json({
        success: false,
        cached: exists,
        error: `Failed to generate GPX URL: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`
      });
    }

  } catch (error: unknown) {
    // GPX URL API Error

    return NextResponse.json({
      success: false,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

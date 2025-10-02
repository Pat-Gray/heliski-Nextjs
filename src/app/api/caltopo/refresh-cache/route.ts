import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';
import { supabase } from '../../../../lib/supabase-db';
import { uploadGPX, getGPX } from '../../../../lib/supabase-storage';
import { geojsonToGPX } from '../../../../lib/geojson-to-gpx';

interface RefreshCacheResponse {
  success: boolean;
  refreshed: number;
  skipped: number;
  failed: number;
  errors: Array<{ runId: string; error: string }>;
  message: string;
}

interface CalTopoFeature {
  id: string;
  geometry?: {
    type: string;
    coordinates: number[] | number[][];
  };
  properties?: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  console.log('🔄 Refresh Cache API - Request Started:', {
    url: request.url,
    timestamp: new Date().toISOString()
  });

  try {
    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      console.error('❌ Missing CalTopo credentials');
      return NextResponse.json(
        { error: 'Server configuration error: Missing CalTopo credentials' },
        { status: 500 }
      );
    }

    // Get all runs that are linked to CalTopo
    const { data: linkedRuns, error: runsError } = await supabase
      .from('runs')
      .select('id, name, caltopo_map_id, caltopo_feature_id, gpx_updated_at')
      .not('caltopo_map_id', 'is', null)
      .not('caltopo_feature_id', 'is', null);

    if (runsError) {
      throw new Error(`Failed to fetch linked runs: ${runsError.message}`);
    }

    console.log('📊 Found linked runs:', {
      total: linkedRuns?.length || 0,
      runs: linkedRuns?.map(r => ({
        id: r.id.substring(0, 8) + '...',
        mapId: r.caltopo_map_id?.substring(0, 8) + '...',
        featureId: r.caltopo_feature_id?.substring(0, 8) + '...'
      })) || []
    });

    let refreshed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ runId: string; error: string }> = [];

    // Group runs by map for efficient API calls
    const runsByMap = new Map<string, typeof linkedRuns>();
    for (const run of linkedRuns || []) {
      if (!run.caltopo_map_id) continue;
      
      if (!runsByMap.has(run.caltopo_map_id)) {
        runsByMap.set(run.caltopo_map_id, []);
      }
      runsByMap.get(run.caltopo_map_id)!.push(run);
    }

    console.log('🗺️ Grouped runs by map:', {
      mapCount: runsByMap.size,
      maps: Array.from(runsByMap.keys()).map(mapId => ({
        mapId: mapId.substring(0, 8) + '...',
        runCount: runsByMap.get(mapId)!.length
      }))
    });

    // Process each map
    for (const [mapId, mapRuns] of runsByMap) {
      try {
        console.log(`🔄 Processing map ${mapId.substring(0, 8)}... with ${mapRuns.length} runs`);

        // Get current map data with since parameter
        const sinceTimestamp = Math.max(
          ...mapRuns
            .filter(r => r.gpx_updated_at)
            .map(r => new Date(r.gpx_updated_at!).getTime())
        ) || 0;

        console.log('📅 Checking for changes since:', {
          timestamp: sinceTimestamp,
          date: new Date(sinceTimestamp).toISOString()
        });

        // Check if map has changed since last update
        const mapData = await caltopoRequest(
          'GET',
          `/api/v1/map/${mapId}/since/${sinceTimestamp}`,
          credentialId,
          credentialSecret
        );

        console.log('📊 Map changes check:', {
          hasChanges: !!mapData.features && mapData.features.length > 0,
          featuresCount: mapData.features?.length || 0
        });

        // If no changes, skip this map
        if (!mapData.features || mapData.features.length === 0) {
          console.log('✅ No changes detected for map, skipping');
          skipped += mapRuns.length;
          continue;
        }

        // Get full map data for feature details
        const fullMapData = await caltopoRequest(
          'GET',
          `/api/v1/map/${mapId}/since/0`,
          credentialId,
          credentialSecret
        );

        console.log('📊 Full map data received:', {
          hasFeatures: !!fullMapData.features,
          featuresCount: fullMapData.features?.length || 0
        });

        if (!fullMapData.features) {
          console.error('❌ No features found in full map data');
          failed += mapRuns.length;
          errors.push(...mapRuns.map(r => ({ 
            runId: r.id, 
            error: 'No features found in map' 
          })));
          continue;
        }

        // Process each run in this map
        for (const run of mapRuns) {
          try {
            if (!run.caltopo_map_id || !run.caltopo_feature_id) {
              skipped++;
              continue;
            }

            console.log(`🔄 Refreshing GPX for run ${run.id.substring(0, 8)}...`);

            // Find the feature
            const feature = fullMapData.features.find((f: CalTopoFeature) => f.id === run.caltopo_feature_id);
            
            if (!feature) {
              console.warn(`⚠️ Feature ${run.caltopo_feature_id} not found in map`);
              failed++;
              errors.push({ 
                runId: run.id, 
                error: `Feature ${run.caltopo_feature_id} not found in map` 
              });
              continue;
            }

            // Check if GPX was recently updated (within last hour)
            const lastUpdated = run.gpx_updated_at ? new Date(run.gpx_updated_at) : null;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            if (lastUpdated && lastUpdated > oneHourAgo) {
              console.log(`✅ GPX recently updated for run ${run.id.substring(0, 8)}, skipping`);
              skipped++;
              continue;
            }

            // Convert feature to GPX
            if (!feature.geometry || (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString')) {
              console.warn(`⚠️ Feature ${run.caltopo_feature_id} has unsupported geometry type: ${feature.geometry?.type}`);
              failed++;
              errors.push({ 
                runId: run.id, 
                error: `Unsupported geometry type: ${feature.geometry?.type}` 
              });
              continue;
            }

            const gpxContent = geojsonToGPX(feature, {
              name: feature.properties?.name || `Feature ${run.caltopo_feature_id}`,
              description: feature.properties?.description || '',
              author: 'CalTopo Integration',
              link: `https://caltopo.com/m/${run.caltopo_map_id}`,
              time: new Date()
            });

            // Upload new GPX
            const { path, checksum } = await uploadGPX(run.caltopo_map_id, run.caltopo_feature_id, gpxContent);
            const updatedAt = new Date();

            // Update run record
            const { error: updateError } = await supabase
              .from('runs')
              .update({
                gpx_path: publicUrl,
                gpx_updated_at: updatedAt.toISOString()
              })
              .eq('id', run.id);

            if (updateError) {
              throw new Error(`Failed to update run: ${updateError.message}`);
            }

            console.log(`✅ GPX refreshed for run ${run.id.substring(0, 8)}:`, {
              path,
              checksum: checksum.substring(0, 16) + '...',
              updatedAt: updatedAt.toISOString()
            });

            refreshed++;

          } catch (runError: unknown) {
            const errorMessage = runError instanceof Error ? runError.message : 'Unknown error';
            console.error(`❌ Failed to refresh run ${run.id.substring(0, 8)}:`, errorMessage);
            failed++;
            errors.push({ 
              runId: run.id, 
              error: errorMessage 
            });
          }
        }

      } catch (mapError: unknown) {
        const errorMessage = mapError instanceof Error ? mapError.message : 'Unknown error';
        console.error(`❌ Failed to process map ${mapId.substring(0, 8)}:`, errorMessage);
        failed += mapRuns.length;
        errors.push(...mapRuns.map(r => ({ 
          runId: r.id, 
          error: `Map processing failed: ${errorMessage}` 
        })));
      }
    }

    const response: RefreshCacheResponse = {
      success: true,
      refreshed,
      skipped,
      failed,
      errors,
      message: `Cache refresh completed: ${refreshed} refreshed, ${skipped} skipped, ${failed} failed`
    };

    console.log('✅ Refresh Cache API Success:', response);
    return NextResponse.json(response);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('❌ Refresh Cache API Error:', {
      errorMessage,
      errorStack,
      errorName
    });

    return NextResponse.json({
      success: false,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      errors: [{ runId: 'unknown', error: errorMessage }],
      message: `Cache refresh failed: ${errorMessage}`
    }, { status: 500 });
  }
}

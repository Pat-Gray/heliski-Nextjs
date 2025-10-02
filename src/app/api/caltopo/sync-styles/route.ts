import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';
import { supabase } from '../../../../lib/supabase-db';

interface CalTopoFeature {
  id: string;
  properties: {
    stroke: string;
    fill: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CalTopoMapState {
  features: CalTopoFeature[];
  [key: string]: unknown;
}

interface CalTopoMapResponse {
  state: CalTopoMapState;
  [key: string]: unknown;
}

interface SyncStylesRequest {
  dailyPlanId?: string;
  runIds?: string[];
}

interface SyncStylesResponse {
  success: boolean;
  updated: number;
  skippedUnlinked: string[];
  failed: Array<{ runId: string; reason: string }>;
  mapsUpdated: string[];
  error?: string;
}

// Color mapping
const STATUS_COLORS = {
  open: '#22c55e',
  conditional: '#f97316',
  closed: '#ef4444'
} as const;

export async function POST(request: NextRequest) {
  console.log('🎨 Sync Styles API - Request Started:', {
    url: request.url,
    timestamp: new Date().toISOString()
  });

  try {
    const body: SyncStylesRequest = await request.json();
    const { dailyPlanId, runIds } = body;

    console.log('📝 Sync Styles Request:', {
      dailyPlanId,
      runIds: runIds ? runIds.map(id => id.substring(0, 8) + '...') : 'none',
      hasDailyPlanId: !!dailyPlanId,
      hasRunIds: !!runIds
    });

    if (!dailyPlanId && !runIds) {
      return NextResponse.json(
        { error: 'Missing required fields: dailyPlanId or runIds' },
        { status: 400 }
      );
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      console.error('❌ Missing CalTopo credentials');
      return NextResponse.json(
        { error: 'Server configuration error: Missing CalTopo credentials' },
        { status: 500 }
      );
    }

    // Get runs to sync
    let runsToSync: Array<{ id: string; status: string; caltopoMapId: string | null; caltopoFeatureId: string | null }> = [];

    if (dailyPlanId) {
      // Get runs from daily plan
      const { data: dailyPlan, error: planError } = await supabase
        .from('daily_plans')
        .select('run_ids')
        .eq('id', dailyPlanId)
        .single();
      
      if (planError || !dailyPlan) {
        return NextResponse.json(
          { error: 'Daily plan not found' },
          { status: 404 }
        );
      }

      const planRunIds = dailyPlan.run_ids;
      const { data: runsData, error: runsError } = await supabase
        .from('runs')
        .select('id, status, caltopo_map_id, caltopo_feature_id')
        .in('id', planRunIds);

      if (runsError) {
        throw new Error(`Failed to fetch runs: ${runsError.message}`);
      }

      runsToSync = runsData?.map(run => ({
        id: run.id,
        status: run.status,
        caltopoMapId: run.caltopo_map_id,
        caltopoFeatureId: run.caltopo_feature_id
      })) || [];
    } else if (runIds) {
      // Get specific runs
      const { data: runsData, error: runsError } = await supabase
        .from('runs')
        .select('id, status, caltopo_map_id, caltopo_feature_id')
        .in('id', runIds);

      if (runsError) {
        throw new Error(`Failed to fetch runs: ${runsError.message}`);
      }

      runsToSync = runsData?.map(run => ({
        id: run.id,
        status: run.status,
        caltopoMapId: run.caltopo_map_id,
        caltopoFeatureId: run.caltopo_feature_id
      })) || [];
    }

    console.log('📊 Runs to sync:', {
      totalRuns: runsToSync.length,
      linkedRuns: runsToSync.filter(r => r.caltopoMapId && r.caltopoFeatureId).length,
      unlinkedRuns: runsToSync.filter(r => !r.caltopoMapId || !r.caltopoFeatureId).length
    });

    // Group runs by map
    const runsByMap = new Map<string, Array<{ runId: string; featureId: string; status: string }>>();
    const skippedUnlinked: string[] = [];
    const failed: Array<{ runId: string; reason: string }> = [];

    for (const run of runsToSync) {
      if (!run.caltopoMapId || !run.caltopoFeatureId) {
        skippedUnlinked.push(run.id);
        continue;
      }

      if (!runsByMap.has(run.caltopoMapId)) {
        runsByMap.set(run.caltopoMapId, []);
      }

      runsByMap.get(run.caltopoMapId)!.push({
        runId: run.id,
        featureId: run.caltopoFeatureId,
        status: run.status
      });
    }

    console.log('🗺️ Runs grouped by map:', {
      mapCount: runsByMap.size,
      maps: Array.from(runsByMap.keys()).map(mapId => ({
        mapId: mapId.substring(0, 8) + '...',
        runCount: runsByMap.get(mapId)!.length
      }))
    });

    const mapsUpdated: string[] = [];
    let totalUpdated = 0;

    // Process each map
    for (const [mapId, mapRuns] of runsByMap) {
      try {
        console.log(`🔄 Processing map ${mapId.substring(0, 8)}... with ${mapRuns.length} runs`);

        // Get current map data
        const mapData = await caltopoRequest(
          'GET',
          `/api/v1/map/${mapId}/since/0`,
          credentialId,
          credentialSecret
        ) as CalTopoMapResponse;

        console.log('📊 Map data received:', {
          hasState: !!mapData.state,
          hasFeatures: !!mapData.state?.features,
          featuresCount: mapData.state?.features?.length || 0,
          fullResponseKeys: Object.keys(mapData),
          stateKeys: mapData.state ? Object.keys(mapData.state) : 'no state'
        });

        if (!mapData.state?.features) {
          console.error('❌ No features found in map data');
          failed.push(...mapRuns.map(r => ({ runId: r.runId, reason: 'No features found in map' })));
          continue;
        }

        // Update feature styles
        let mapUpdated = false;
        const updatedFeatures = mapData.state.features.map((feature: CalTopoFeature) => {
          const runForFeature = mapRuns.find(r => r.featureId === feature.id);
          
          if (!runForFeature) {
            return feature; // No changes needed
          }

          const newColor = STATUS_COLORS[runForFeature.status as keyof typeof STATUS_COLORS];
          
          if (!newColor) {
            console.warn(`⚠️ Unknown status: ${runForFeature.status} for run ${runForFeature.runId}`);
            return feature;
          }

          // Update feature properties (CalTopo uses properties, not style)
          const updatedFeature = {
            ...feature,
            properties: {
              ...feature.properties,
              stroke: newColor,
              fill: newColor // For polygons
            }
          };

          console.log('🎨 Updated feature style:', {
            featureId: feature.id,
            runId: runForFeature.runId,
            status: runForFeature.status,
            color: newColor
          });

          mapUpdated = true;
          return updatedFeature;
        });

        if (mapUpdated) {
          // Update each feature individually using CalTopo API
          console.log('💾 Updating features individually in CalTopo...');
          
          let featuresUpdated = 0;
          for (const feature of updatedFeatures) {
            const runForFeature = mapRuns.find(r => r.featureId === feature.id);
            if (!runForFeature) continue;

            try {
              // Update individual feature using CalTopo API
              await caltopoRequest(
                'POST',
                `/api/v1/map/${mapId}/Shape/${feature.id}`,
                credentialId,
                credentialSecret,
                feature
              );
              
              featuresUpdated++;
              console.log(`✅ Updated feature ${feature.id} for run ${runForFeature.runId}`);
            } catch (featureError: unknown) {
              const errorMessage = featureError instanceof Error ? featureError.message : 'Unknown error';
              console.error(`❌ Failed to update feature ${feature.id}:`, errorMessage);
              failed.push({ 
                runId: runForFeature.runId, 
                reason: `Feature update failed: ${errorMessage}` 
              });
            }
          }

          if (featuresUpdated > 0) {
            mapsUpdated.push(mapId);
            totalUpdated += featuresUpdated;
            console.log('✅ Map updated successfully:', {
              mapId: mapId.substring(0, 8) + '...',
              featuresUpdated,
              totalRuns: mapRuns.length
            });
          }
        } else {
          console.log('ℹ️ No features needed updating for map:', mapId.substring(0, 8) + '...');
        }

      } catch (mapError: unknown) {
        const errorMessage = mapError instanceof Error ? mapError.message : 'Unknown error';
        console.error(`❌ Failed to update map ${mapId.substring(0, 8)}...:`, errorMessage);
        failed.push(...mapRuns.map(r => ({ 
          runId: r.runId, 
          reason: `Map update failed: ${errorMessage}` 
        })));
      }
    }

    const response: SyncStylesResponse = {
      success: true,
      updated: totalUpdated,
      skippedUnlinked,
      failed,
      mapsUpdated
    };

    console.log('✅ Sync Styles API Success:', {
      updated: response.updated,
      skipped: response.skippedUnlinked.length,
      failed: response.failed.length,
      mapsUpdated: response.mapsUpdated.length
    });

    return NextResponse.json(response);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('❌ Sync Styles API Error:', {
      errorMessage,
      errorStack,
      errorName
    });

    return NextResponse.json({
      success: false,
      error: errorMessage,
      updated: 0,
      skippedUnlinked: [],
      failed: [],
      mapsUpdated: []
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';
import { supabase } from '../../../../lib/supabase-db';

interface SyncStylesRequest {
  runIds: string[];
}

interface Run {
  id: string;
  name: string;
  status: 'open' | 'conditional' | 'closed';
  caltopo_map_id: string | null;
  caltopo_feature_id: string | null;
}

// Status to CalTopo color mapping
const STATUS_COLORS = {
  open: '#00FF00',      // Green
  conditional: '#FFA500', // Orange
  closed: '#FF0000'     // Red
};

// Status to CalTopo stroke color mapping
const STATUS_STROKE_COLORS = {
  open: '#00CC00',      // Darker green
  conditional: '#E69400', // Darker orange
  closed: '#CC0000'     // Darker red
};

export async function POST(request: NextRequest) {
  try {
    const { runIds }: SyncStylesRequest = await request.json();

    if (!runIds || !Array.isArray(runIds) || runIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid runIds array' },
        { status: 400 }
      );
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      return NextResponse.json(
        { error: 'Missing CalTopo credentials' },
        { status: 500 }
      );
    }

    console.log(`🎨 Syncing styles for ${runIds.length} runs...`);

    // Get run data from database
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id, name, status, caltopo_map_id, caltopo_feature_id')
      .in('id', runIds);

    if (runsError) {
      return NextResponse.json(
        { error: 'Failed to fetch run data' },
        { status: 500 }
      );
    }

    if (!runs || runs.length === 0) {
      return NextResponse.json(
        { error: 'No runs found' },
        { status: 404 }
      );
    }

    // Filter runs that are linked to CalTopo
    const caltopoLinkedRuns = runs.filter((run: Run) => 
      run.caltopo_map_id && run.caltopo_feature_id
    );

    if (caltopoLinkedRuns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No runs are linked to CalTopo',
        updated: 0,
        skippedUnlinked: runs.length,
        failed: 0,
        mapsUpdated: []
      });
    }

    console.log(`🎨 Found ${caltopoLinkedRuns.length} runs linked to CalTopo`);

    const results = {
      updated: 0,
      skippedUnlinked: runs.length - caltopoLinkedRuns.length,
      failed: 0,
      mapsUpdated: new Set<string>(),
      errors: [] as string[]
    };

    // Group runs by map to minimize API calls
    const runsByMap = new Map<string, Run[]>();
    caltopoLinkedRuns.forEach((run: Run) => {
      if (run.caltopo_map_id) {
        if (!runsByMap.has(run.caltopo_map_id)) {
          runsByMap.set(run.caltopo_map_id, []);
        }
        runsByMap.get(run.caltopo_map_id)!.push(run);
      }
    });

    // Process each map
    for (const [mapId, mapRuns] of runsByMap) {
      try {
        console.log(`🎨 Processing map ${mapId} with ${mapRuns.length} runs`);

        // Get current map data
        const mapData = await caltopoRequest(
          'GET',
          `/api/v1/map/${mapId}/since/0`,
          credentialId,
          credentialSecret
        );

        if (!mapData || !(mapData as { state?: { features?: unknown[] } }).state?.features) {
          throw new Error(`Failed to fetch map data for ${mapId}`);
        }

        let mapUpdated = false;

        // Update each run's feature in the map
        for (const run of mapRuns) {
          try {
            const feature = (mapData as { state: { features: Array<{ id: string; properties?: Record<string, unknown> }> } }).state.features.find(
              (f: { id: string }) => f.id === run.caltopo_feature_id
            );

            if (!feature) {
              console.warn(`⚠️ Feature ${run.caltopo_feature_id} not found in map ${mapId}`);
              results.failed++;
              results.errors.push(`Feature ${run.caltopo_feature_id} not found for run ${run.name}`);
              continue;
            }

            // Update feature colors based on run status
            const updatedFeature = {
              ...feature,
              properties: {
                ...feature.properties,
                fill: STATUS_COLORS[run.status],
                stroke: STATUS_STROKE_COLORS[run.status],
                'fill-opacity': 0.3,
                'stroke-opacity': 1.0,
                'stroke-width': 2,
                // Add status information
                heliRunStatus: run.status,
                heliRunName: run.name,
                lastStatusUpdate: new Date().toISOString()
              }
            };

            // Update the feature in CalTopo
            await caltopoRequest(
              'POST',
              `/api/v1/map/${mapId}/Shape/${run.caltopo_feature_id}`,
              credentialId,
              credentialSecret,
              updatedFeature
            );

            // Verify the update was actually applied
            try {
              const verifyResponse = await caltopoRequest(
                'GET',
                `/api/v1/map/${mapId}/Shape/${run.caltopo_feature_id}`,
                credentialId,
                credentialSecret
              ) as { properties?: Record<string, unknown> };
              
              const actualFill = verifyResponse.properties?.fill;
              const actualStroke = verifyResponse.properties?.stroke;
              const expectedFill = STATUS_COLORS[run.status];
              const expectedStroke = STATUS_STROKE_COLORS[run.status];
              
              console.log(`🔍 Style verification for ${run.name}:`, {
                expectedFill,
                actualFill,
                expectedStroke,
                actualStroke,
                fillMatches: actualFill === expectedFill,
                strokeMatches: actualStroke === expectedStroke
              });
              
              if (actualFill !== expectedFill || actualStroke !== expectedStroke) {
                console.warn(`⚠️ Style update may not have been applied correctly for ${run.name}`);
              }
            } catch (verifyError) {
              console.error(`❌ Failed to verify style update for ${run.name}:`, verifyError);
            }

            console.log(`✅ Updated style for run ${run.name} (${run.status})`);
            results.updated++;
            mapUpdated = true;

          } catch (error) {
            console.error(`❌ Failed to update run ${run.name}:`, error);
            results.failed++;
            results.errors.push(`Failed to update run ${run.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        if (mapUpdated) {
          results.mapsUpdated.add(mapId);
        }

      } catch (error) {
        console.error(`❌ Failed to process map ${mapId}:`, error);
        results.failed += mapRuns.length;
        results.errors.push(`Failed to process map ${mapId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🎨 Style sync completed: ${results.updated} updated, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      message: 'Style sync completed',
      updated: results.updated,
      skippedUnlinked: results.skippedUnlinked,
      failed: results.failed,
      mapsUpdated: Array.from(results.mapsUpdated),
      errors: results.errors
    });

  } catch (error) {
    console.error('Error syncing styles:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync styles', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

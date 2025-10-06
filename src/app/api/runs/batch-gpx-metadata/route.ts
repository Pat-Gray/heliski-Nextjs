import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-db';
import { parseGPX } from '@/utils/gpx-parser';

interface BatchGPXMetadataRequest {
  runIds: string[];
  batchSize?: number;
}

interface GPXMetadata {
  pointCount: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  trackCount: number;
  totalDistance: number;
  elevationGain: number;
  elevationLoss: number;
  maxElevation: number;
  minElevation: number;
}

interface ProcessedRun {
  runId: string;
  metadata?: GPXMetadata;
  success: boolean;
  error?: string;
}

/**
 * Batch API for processing GPX metadata
 * Pre-computes bounds, point counts, and other metadata for efficient filtering
 * Processes runs in batches to avoid overwhelming the server
 */
export async function POST(request: NextRequest) {
  try {
    const body: BatchGPXMetadataRequest = await request.json();
    const { runIds, batchSize = 10 } = body;

    if (!runIds || !Array.isArray(runIds) || runIds.length === 0) {
      return NextResponse.json(
        { error: 'runIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    console.log(`🔄 Processing GPX metadata for ${runIds.length} runs in batches of ${batchSize}`);

    // Get runs data from database
    const { data: runs, error: fetchError } = await supabase
      .from('runs')
      .select('id, name, gpx_path, run_number, sub_area_id')
      .in('id', runIds);

    if (fetchError) {
      console.error('❌ Error fetching runs:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch runs from database' },
        { status: 500 }
      );
    }

    if (!runs || runs.length === 0) {
      return NextResponse.json(
        { error: 'No runs found for the provided IDs' },
        { status: 404 }
      );
    }

    const results: ProcessedRun[] = [];
    const errors: string[] = [];

    // Process runs in batches
    for (let i = 0; i < runs.length; i += batchSize) {
      const batch = runs.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(runs.length / batchSize)} (${batch.length} runs)`);

      const batchPromises = batch.map(async (run) => {
        try {
          if (!run.gpx_path) {
            return {
              runId: run.id,
              success: false,
              error: 'No GPX path available'
            };
          }

          // Fetch GPX content
          const response = await fetch(run.gpx_path);
          if (!response.ok) {
            throw new Error(`Failed to fetch GPX: ${response.status} ${response.statusText}`);
          }

          const gpxContent = await response.text();
          
          // Parse GPX to extract metadata
          const parsedGPX = parseGPX(gpxContent);
          
          // Calculate metadata
          const metadata: GPXMetadata = {
            pointCount: parsedGPX.tracks.reduce((sum, track) => sum + track.points.length, 0),
            bounds: parsedGPX.bounds,
            trackCount: parsedGPX.tracks.length,
            totalDistance: parsedGPX.tracks.reduce((sum, track) => {
              let distance = 0;
              for (let i = 1; i < track.points.length; i++) {
                distance += calculateDistance(track.points[i-1], track.points[i]);
              }
              return sum + distance;
            }, 0),
            elevationGain: parsedGPX.tracks.reduce((sum, track) => {
              let gain = 0;
              for (let i = 1; i < track.points.length; i++) {
                const prev = track.points[i-1];
                const curr = track.points[i];
                if (prev.ele !== undefined && curr.ele !== undefined) {
                  const change = curr.ele - prev.ele;
                  if (change > 0) gain += change;
                }
              }
              return sum + gain;
            }, 0),
            elevationLoss: parsedGPX.tracks.reduce((sum, track) => {
              let loss = 0;
              for (let i = 1; i < track.points.length; i++) {
                const prev = track.points[i-1];
                const curr = track.points[i];
                if (prev.ele !== undefined && curr.ele !== undefined) {
                  const change = curr.ele - prev.ele;
                  if (change < 0) loss += Math.abs(change);
                }
              }
              return sum + loss;
            }, 0),
            maxElevation: Math.max(...parsedGPX.tracks.flatMap(track => 
              track.points.map(p => p.ele || 0)
            )),
            minElevation: Math.min(...parsedGPX.tracks.flatMap(track => 
              track.points.map(p => p.ele || 0)
            ))
          };

          // Update database with metadata
          const { error: updateError } = await supabase
            .from('runs')
            .update({
              gpx_metadata: metadata,
              gpx_bounds: metadata.bounds,
              gpx_point_count: metadata.pointCount,
              gpx_updated_at: new Date().toISOString()
            })
            .eq('id', run.id);

          if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
          }

          console.log(`✅ Processed run ${run.id}: ${metadata.pointCount} points, ${metadata.trackCount} tracks`);
          
          return {
            runId: run.id,
            metadata,
            success: true
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to process run ${run.id}:`, errorMessage);
          
          return {
            runId: run.id,
            success: false,
            error: errorMessage
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (!result.value.success && result.value.error) {
            errors.push(`${batch[index].id}: ${result.value.error}`);
          }
        } else {
          results.push({
            runId: batch[index].id,
            success: false,
            error: result.reason?.message || 'Promise rejected'
          });
          errors.push(`${batch[index].id}: ${result.reason?.message || 'Promise rejected'}`);
        }
      });

      // Small delay between batches to avoid overwhelming the server
      if (i + batchSize < runs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`✅ Batch processing complete: ${successCount} successful, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      processed: successCount,
      failed: failureCount,
      total: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Batch GPX metadata processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(point1: { lat: number; lon: number }, point2: { lat: number; lon: number }): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lon - point1.lon) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';
import { uploadGPX, getGPX, initializeStorageBucket} from '../../../../lib/supabase-storage';
import { geojsonToGPX } from '../../../../lib/geojson-to-gpx';
import { supabase } from '../../../../lib/supabase-db';

interface CacheGPXRequest {
  mapId: string;
  featureId: string;
  runId?: string; // Optional: if provided, update the run record
}

interface CacheGPXResponse {
  success: boolean;
  path: string;
  checksum: string;
  updatedAt: string;
  method: 'geojson' | 'gpx-extract' | 'map-data-convert' | 'cached' | 'failed';
  error?: string;
}

interface CalTopoFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][];
  };
  properties?: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
}

interface CalTopoMapState {
  features?: CalTopoFeature[];
  [key: string]: unknown;
}

interface CalTopoMapData {
  state?: CalTopoMapState;
  [key: string]: unknown;
}

// Type guard to check if the response is a valid CalTopo map data
function isCalTopoMapData(data: unknown): data is CalTopoMapData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'state' in data &&
    (data.state === undefined || 
     (typeof data.state === 'object' && 
      data.state !== null && 
      ('features' in data.state ? 
        Array.isArray(data.state.features) : true)))
  );
}

export async function POST(request: NextRequest) {
  // Cache GPX API request started

  try {
    const body: CacheGPXRequest = await request.json();
    const { mapId, featureId, runId } = body;

    // Processing cache GPX request

    if (!mapId || !featureId) {
      return NextResponse.json(
        { error: 'Missing required fields: mapId and featureId' },
        { status: 400 }
      );
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      // Missing CalTopo credentials
      return NextResponse.json(
        { error: 'Server configuration error: Missing CalTopo credentials' },
        { status: 500 }
      );
    }

    // Check if GPX already exists and is recent
    const existingGPX = await getGPX(mapId, featureId);
    if (existingGPX) {
      // GPX already cached

      // Generate public URL for existing cached GPX
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/heli-ski-files/${existingGPX.path}`;
      
      // Using cached GPX with public URL

      // Update run record if provided
      if (runId) {
        const { error: updateError } = await supabase
          .from('runs')
          .update({
            gpx_path: publicUrl, // Store public URL in gpx_path
            gpx_updated_at: existingGPX.updatedAt.toISOString(),
          })
          .eq('id', runId);
        
        if (updateError) {
          // Failed to update run record with cached GPX
        } else {
          // Run record updated with cached GPX public URL
        }
      }

      return NextResponse.json({
        success: true,
        path: publicUrl, // Return the public URL instead of storage path
        checksum: existingGPX.checksum,
        updatedAt: existingGPX.updatedAt.toISOString(),
        method: 'cached' as const
      });
    }

    // Fetching CalTopo map data
    
    // Initialize storage bucket if it doesn't exist
    try {
      await initializeStorageBucket();
      // Storage bucket ready
    } catch {
      // Bucket initialization failed, continuing anyway
    }
    
    // Method 1: Try to get feature geometry from map JSON
    let gpxContent: string;
    let method: 'geojson' | 'gpx-extract' | 'map-data-convert' = 'geojson';
    
    try {
      const mapDataResponse = await caltopoRequest(
        'GET',
        `/api/v1/map/${mapId}/since/0`,
        credentialId,
        credentialSecret
      );

      // Debug: Log the actual response structure
      // CalTopo API response received

      // Type guard to ensure we have valid map data
      if (!isCalTopoMapData(mapDataResponse)) {
        // Map data validation failed
        throw new Error('Invalid map data structure received from CalTopo API');
      }

      const mapData: CalTopoMapData = mapDataResponse;

      // Map data received

      // Find the specific feature in the correct location
      const feature = mapData.state?.features?.find((f: CalTopoFeature) => f.id === featureId);
      
      if (!feature) {
        throw new Error(`Feature ${featureId} not found in map ${mapId}`);
      }

      // Found feature

      // Convert GeoJSON to GPX
      if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
        gpxContent = geojsonToGPX(feature, {
          name: feature.properties?.name || `Feature ${featureId}`,
          description: feature.properties?.description || '',
          author: 'CalTopo Integration',
          link: `https://caltopo.com/m/${mapId}`,
          time: new Date()
        });
        
        // Converted GeoJSON to GPX
      } else {
        throw new Error(`Feature ${featureId} has unsupported geometry type: ${feature.geometry?.type}`);
      }
    } catch (geojsonError) {
      // GeoJSON method failed, trying GPX extraction
      
        // Method 2: Get map data and convert features to GPX
        try {
          const mapDataResponse = await caltopoRequest(
            'GET',
            `/api/v1/map/${mapId}/since/0`,
            credentialId,
            credentialSecret
          );

          // Type guard to ensure we have valid map data
          if (!isCalTopoMapData(mapDataResponse)) {
            // Map data validation failed in fallback
            throw new Error('Invalid map data structure received from CalTopo API');
          }

          const mapData: CalTopoMapData = mapDataResponse;

        // Downloaded map data

        // Find the specific feature in the correct location
        const feature = mapData.state?.features?.find((f: CalTopoFeature) => f.id === featureId);
        
        if (!feature) {
          throw new Error(`Feature ${featureId} not found in map data`);
        }

        // Converting feature to GPX

        // Convert feature to GPX using the same logic as Method 1
        if (!feature.geometry || (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString')) {
          throw new Error(`Feature ${featureId} has unsupported geometry type: ${feature.geometry?.type}`);
        }

        gpxContent = geojsonToGPX(feature, {
          name: feature.properties?.name || `Feature ${featureId}`,
          description: feature.properties?.description || '',
          author: 'CalTopo Integration',
          link: `https://caltopo.com/m/${mapId}`,
          time: new Date()
        });
        
        method = 'map-data-convert';
        
        // Converted feature to GPX from map data
      } catch (gpxError: unknown) {
        const gpxErrorMessage = gpxError instanceof Error ? gpxError.message : 'Unknown error';
        // Both methods failed
        
        return NextResponse.json({
          success: false,
          error: `Failed to fetch GPX data: ${(geojsonError as Error).message}. GPX extraction also failed: ${gpxErrorMessage}`,
          path: '',
          checksum: '',
          updatedAt: new Date().toISOString(),
          method: 'failed' as const
        }, { status: 500 });
      }
    }

    // Upload to Supabase Storage
    // Uploading GPX to Supabase Storage
    const { path, checksum } = await uploadGPX(mapId, featureId, gpxContent);
    const updatedAt = new Date();

    // GPX uploaded successfully

    // Generate public URL for frontend access
    // Generating public URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/heli-ski-files/${path}`;
    
    // Public URL generated

    // Update run record if provided
    if (runId && runId !== 'none') {
      // Updating run record
      
        const { error: updateError } = await supabase
          .from('runs')
          .update({
            gpx_path: publicUrl, // Store public URL in gpx_path
            caltopo_map_id: mapId,
            caltopo_feature_id: featureId,
            gpx_updated_at: updatedAt.toISOString(),
          })
          .eq('id', runId);
      
      if (updateError) {
        // Failed to update run record
      } else {
        // Run record updated successfully
      }
    } else {
      // Skipping run record update - no valid runId provided
    }

    const response: CacheGPXResponse = {
      success: true,
      path: publicUrl, // Return the public URL instead of storage path
      checksum,
      updatedAt: updatedAt.toISOString(),
      method
    };

    // Cache GPX API Success
    return NextResponse.json(response);

    } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Cache GPX API Error

    return NextResponse.json({
      success: false,
      error: errorMessage,
      path: '',
      checksum: '',
      updatedAt: new Date().toISOString(),
      method: 'failed' as const
    }, { status: 500 });
  }
}

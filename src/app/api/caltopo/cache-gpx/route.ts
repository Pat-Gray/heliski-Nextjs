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
        Array.isArray(data.state.features) && 
        data.state.features.every(f => 
          typeof f === 'object' && 
          f !== null && 
          'type' in f && 
          f.type === 'Feature' &&
          'id' in f &&
          'geometry' in f &&
          typeof f.geometry === 'object' &&
          f.geometry !== null &&
          'type' in f.geometry &&
          (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') &&
          'coordinates' in f.geometry &&
          Array.isArray(f.geometry.coordinates)
        ) : true)))
  );
}

export async function POST(request: NextRequest) {
  console.log('🔄 Cache GPX API - Request Started:', {
    url: request.url,
    timestamp: new Date().toISOString()
  });

  try {
    const body: CacheGPXRequest = await request.json();
    const { mapId, featureId, runId } = body;

    console.log('📝 Cache GPX Request:', {
      mapId,
      featureId,
      runId: runId ? `${runId.substring(0, 8)}...` : 'none',
      hasRunId: !!runId,
      runIdType: typeof runId,
      runIdValue: runId
    });

    if (!mapId || !featureId) {
      return NextResponse.json(
        { error: 'Missing required fields: mapId and featureId' },
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

    // Check if GPX already exists and is recent
    const existingGPX = await getGPX(mapId, featureId);
    if (existingGPX) {
      console.log('✅ GPX already cached:', {
        path: existingGPX.path,
        checksum: existingGPX.checksum.substring(0, 16) + '...',
        updatedAt: existingGPX.updatedAt.toISOString()
      });

      // Generate public URL for existing cached GPX
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/gpx/${existingGPX.path}`;
      
      console.log('✅ Using cached GPX with public URL:', {
        storagePath: existingGPX.path,
        publicUrl: publicUrl
      });

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
          console.error('❌ Failed to update run record with cached GPX:', updateError);
        } else {
          console.log('✅ Run record updated with cached GPX public URL');
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

    console.log('🌐 Fetching CalTopo map data...');
    
    // Initialize storage bucket if it doesn't exist
    try {
      await initializeStorageBucket();
      console.log('✅ Storage bucket ready');
    } catch (bucketError) {
      console.warn('⚠️ Bucket initialization failed, continuing anyway:', bucketError);
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

      // Type guard to ensure we have valid map data
      if (!isCalTopoMapData(mapDataResponse)) {
        throw new Error('Invalid map data structure received from CalTopo API');
      }

      const mapData: CalTopoMapData = mapDataResponse;

      console.log('📊 Map data received:', {
        hasState: !!mapData.state,
        hasFeatures: !!mapData.state?.features,
        featuresCount: mapData.state?.features?.length || 0,
        mapKeys: Object.keys(mapData)
      });

      // Find the specific feature in the correct location
      const feature = mapData.state?.features?.find((f: CalTopoFeature) => f.id === featureId);
      
      if (!feature) {
        throw new Error(`Feature ${featureId} not found in map ${mapId}`);
      }

      console.log('🎯 Found feature:', {
        featureId: feature.id,
        featureType: feature.geometry?.type,
        hasGeometry: !!feature.geometry,
        properties: feature.properties
      });

      // Convert GeoJSON to GPX
      if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
        gpxContent = geojsonToGPX(feature, {
          name: feature.properties?.name || `Feature ${featureId}`,
          description: feature.properties?.description || '',
          author: 'CalTopo Integration',
          link: `https://caltopo.com/m/${mapId}`,
          time: new Date()
        });
        
        console.log('✅ Converted GeoJSON to GPX:', {
          gpxLength: gpxContent.length,
          method: 'geojson'
        });
      } else {
        throw new Error(`Feature ${featureId} has unsupported geometry type: ${feature.geometry?.type}`);
      }
    } catch (geojsonError) {
      console.log('⚠️ GeoJSON method failed, trying GPX extraction:', geojsonError);
      
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
            throw new Error('Invalid map data structure received from CalTopo API');
          }

          const mapData: CalTopoMapData = mapDataResponse;

        console.log('📥 Downloaded map data:', {
          hasState: !!mapData.state,
          hasFeatures: !!mapData.state?.features,
          featuresCount: mapData.state?.features?.length || 0
        });

        // Find the specific feature in the correct location
        const feature = mapData.state?.features?.find((f: CalTopoFeature) => f.id === featureId);
        
        if (!feature) {
          throw new Error(`Feature ${featureId} not found in map data`);
        }

        console.log('🔍 Converting feature to GPX:', {
          featureId,
          geometryType: feature.geometry?.type,
          hasProperties: !!feature.properties
        });

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
        
        console.log('✅ Converted feature to GPX from map data:', {
          gpxLength: gpxContent.length,
          method: 'map-data-convert'
        });
      } catch (gpxError: unknown) {
        const gpxErrorMessage = gpxError instanceof Error ? gpxError.message : 'Unknown error';
        console.error('❌ Both methods failed:', {
          geojsonError: (geojsonError as Error).message,
          gpxError: gpxErrorMessage
        });
        
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
    console.log('☁️ Uploading GPX to Supabase Storage...');
    const { path, checksum } = await uploadGPX(mapId, featureId, gpxContent);
    const updatedAt = new Date();

    console.log('✅ GPX uploaded successfully:', {
      path,
      checksum: checksum.substring(0, 16) + '...',
      updatedAt: updatedAt.toISOString()
    });

    // Generate public URL for frontend access
    console.log('🔗 Generating public URL...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/gpx/${path}`;
    
    console.log('✅ Public URL generated:', {
      url: publicUrl,
      urlLength: publicUrl.length,
      path: path
    });

    // Update run record if provided
    if (runId && runId !== 'none') {
      console.log('📝 Updating run record:', {
        runId,
        publicUrl: publicUrl,
        storagePath: path,
        checksum: checksum.substring(0, 16) + '...',
        mapId,
        featureId
      });
      
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
        console.error('❌ Failed to update run record:', updateError);
      } else {
        console.log('✅ Run record updated successfully');
      }
    } else {
      console.log('⚠️ Skipping run record update - no valid runId provided:', runId);
    }

    const response: CacheGPXResponse = {
      success: true,
      path: publicUrl, // Return the public URL instead of storage path
      checksum,
      updatedAt: updatedAt.toISOString(),
      method
    };

    console.log('✅ Cache GPX API Success:', response);
    return NextResponse.json(response);

    } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('❌ Cache GPX API Error:', {
      errorMessage,
      errorStack,
      errorName
    });

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

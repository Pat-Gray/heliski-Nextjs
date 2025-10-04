// my-app/src/app/api/caltopo/sync-all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '@/utils/caltopo';
import { supabase } from '@/lib/supabase-db';

interface CalTopoFeature {
  id?: string;
  type?: string;
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][] | number[];
  };
  properties?: {
    title?: string;
    class?: string;
    folderId?: string;
    parentId?: string;
    backendMediaId?: string;
    description?: string;
    comment?: string;
    notes?: string;
    details?: string;
    'marker-color'?: string;
    'marker-size'?: string;
    'marker-symbol'?: string;
    created?: number;
    updated?: number;
    creator?: string;
    color?: string;
    fill?: string;
    stroke?: string;
    [key: string]: unknown;
  };
}

interface CalTopoGroup {
  id: string;
  name: string;
  color?: string;
}

interface CalTopoMapResponse {
  state: {
    groups?: CalTopoGroup[];
    features?: CalTopoFeature[];
  };
  [key: string]: unknown;
}

interface SyncResult {
  success: boolean;
  mapId: string;
  stats: {
    folders: { created: number; updated: number; total: number };
    features: { created: number; updated: number; total: number };
    images: { created: number; updated: number; total: number };
    gpxTracks: { created: number; updated: number; total: number };
  };
  errors: string[];
  lastSync: string;
  duration: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let mapId = 'unknown'; // Initialize mapId for error handling
  
  try {
    const body = await request.json();
    const { mapId: requestedMapId, syncType = 'full' } = body;
    mapId = requestedMapId || process.env.CALTOPO_AVALANCHE_MAP_ID; // Use env var as fallback

    if (!mapId) {
      return NextResponse.json({ 
        error: 'Missing mapId in request body and CALTOPO_AVALANCHE_MAP_ID not configured in environment variables' 
      }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      return NextResponse.json({ error: 'Missing CalTopo credentials' }, { status: 500 });
    }

    console.log(`🔄 Starting ${syncType} sync for map ${mapId}`);

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('caltopo_sync_logs')
      .insert({
        map_id: mapId,
        sync_type: syncType,
        status: 'started',
        stats: {},
        errors: []
      })
      .select()
      .single();

    // Fetch all data from CalTopo
    const mapDataResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );

    if (!mapDataResponse || typeof mapDataResponse !== 'object') {
      throw new Error('Invalid response from CalTopo');
    }

    const mapData = mapDataResponse as CalTopoMapResponse;
    const features = mapData.state.features || [];
    const groups = mapData.state.groups || [];

    console.log(`📊 Found ${features.length} features and ${groups.length} groups`);

    const result: SyncResult = {
      success: true,
      mapId,
      stats: {
        folders: { created: 0, updated: 0, total: 0 },
        features: { created: 0, updated: 0, total: 0 },
        images: { created: 0, updated: 0, total: 0 },
        gpxTracks: { created: 0, updated: 0, total: 0 }
      },
      errors: [],
      lastSync: new Date().toISOString(),
      duration: 0
    };

    // 1. Sync Map Info
    await supabase
      .from('caltopo_maps')
      .upsert({
        id: mapId,
        name: `Map ${mapId}`,
        last_sync: new Date().toISOString(),
        sync_status: 'in_progress'
      });

    // 2. Sync Folders/Groups
    console.log('📁 Syncing folders...');
    for (const group of groups) {
      try {
        const { data: existingFolder } = await supabase
          .from('caltopo_folders')
          .select('id, last_updated')
          .eq('id', group.id)
          .single();

        const folderData = {
          id: group.id,
          map_id: mapId,
          name: group.name,
          color: group.color,
          last_updated: new Date().toISOString()
        };

        if (existingFolder) {
          await supabase
            .from('caltopo_folders')
            .update(folderData)
            .eq('id', group.id);
          result.stats.folders.updated++;
        } else {
          await supabase
            .from('caltopo_folders')
            .insert(folderData);
          result.stats.folders.created++;
        }
        result.stats.folders.total++;
      } catch (error) {
        result.errors.push(`Failed to sync folder ${group.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 3. Sync Features (Polygons, Lines, Points)
    console.log('🎯 Syncing features...');
    const featureTypes = ['Polygon', 'LineString', 'Point'];
    
    for (const feature of features) {
      try {
        if (!feature.id || !feature.properties?.class || !featureTypes.includes(feature.geometry?.type || '')) {
          continue;
        }

        const { data: existingFeature } = await supabase
          .from('caltopo_features')
          .select('id, last_updated')
          .eq('id', feature.id)
          .single();

        // Extract coordinates based on geometry type
        let coordinates: number[][] = [];
        if (feature.geometry?.coordinates) {
          if (feature.geometry.type === 'Polygon') {
            const polygonCoords = feature.geometry.coordinates as number[][][];
            coordinates = polygonCoords[0] || [];
          } else if (feature.geometry.type === 'LineString') {
            coordinates = feature.geometry.coordinates as number[][];
          } else if (feature.geometry.type === 'Point') {
            const point = feature.geometry.coordinates as number[];
            coordinates = [point];
          }
        }

        const featureData = {
          id: feature.id,
          map_id: mapId,
          type: feature.geometry?.type || 'Unknown',
          title: feature.properties.title || 'Unnamed Feature',
          class: feature.properties.class,
          folder_id: feature.properties.folderId,
          coordinates: coordinates,
          properties: feature.properties,
          last_updated: new Date().toISOString()
        };

        if (existingFeature) {
          await supabase
            .from('caltopo_features')
            .update(featureData)
            .eq('id', feature.id);
          result.stats.features.updated++;
        } else {
          await supabase
            .from('caltopo_features')
            .insert(featureData);
          result.stats.features.created++;
        }
        result.stats.features.total++;

        // Track GPX tracks separately
        if (feature.geometry?.type === 'LineString') {
          result.stats.gpxTracks.total++;
          if (!existingFeature) {
            result.stats.gpxTracks.created++;
          } else {
            result.stats.gpxTracks.updated++;
          }
        }
      } catch (error) {
        result.errors.push(`Failed to sync feature ${feature.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 4. Sync Images
    console.log('📸 Syncing images...');
    const imageFeatures = features.filter(f => f.properties?.class === 'MapMediaObject');
    
    for (const imageFeature of imageFeatures) {
      try {
        if (!imageFeature.id || !imageFeature.properties?.backendMediaId) {
          continue;
        }

        const { data: existingImage } = await supabase
          .from('caltopo_images')
          .select('id, last_updated')
          .eq('id', imageFeature.id)
          .single();

        const imageData = {
          id: imageFeature.id,
          map_id: mapId,
          feature_id: imageFeature.properties.parentId?.replace('Shape:', ''),
          title: imageFeature.properties.title || 'Unnamed Image',
          backend_media_id: imageFeature.properties.backendMediaId,
          parent_id: imageFeature.properties.parentId,
          description: imageFeature.properties.description,
          comment: imageFeature.properties.comment,
          notes: imageFeature.properties.notes,
          details: imageFeature.properties.details,
          marker_color: imageFeature.properties['marker-color'],
          marker_size: imageFeature.properties['marker-size'],
          marker_symbol: imageFeature.properties['marker-symbol'],
          created: imageFeature.properties.created,
          updated: imageFeature.properties.updated,
          creator: imageFeature.properties.creator,
          properties: imageFeature.properties,
          last_updated: new Date().toISOString()
        };

        if (existingImage) {
          await supabase
            .from('caltopo_images')
            .update(imageData)
            .eq('id', imageFeature.id);
          result.stats.images.updated++;
        } else {
          await supabase
            .from('caltopo_images')
            .insert(imageData);
          result.stats.images.created++;
        }
        result.stats.images.total++;
      } catch (error) {
        result.errors.push(`Failed to sync image ${imageFeature.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 5. Update map sync status
    await supabase
      .from('caltopo_maps')
      .update({
        last_sync: new Date().toISOString(),
        sync_status: 'completed'
      })
      .eq('id', mapId);

    // 6. Update sync log
    const duration = Date.now() - startTime;
    result.duration = duration;

    await supabase
      .from('caltopo_sync_logs')
      .update({
        status: 'completed',
        stats: result.stats,
        errors: result.errors,
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(duration / 1000)
      })
      .eq('id', syncLog.id);

    console.log('✅ Sync completed successfully');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Sync failed:', error);
    
    // Update sync log with error
    await supabase
      .from('caltopo_sync_logs')
      .update({
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startTime) / 1000)
      })
      .eq('map_id', mapId);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastSync: new Date().toISOString(),
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}
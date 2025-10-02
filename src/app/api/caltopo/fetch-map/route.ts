import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';

interface CalTopoFeature {
  id: string;
  type: string;
  geometry?: {
    type: string;
    coordinates: number[][];
  };
  properties: {
    title?: string;
    class?: string;
    folderId?: string;
    color?: string;
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


export async function POST(request: NextRequest) {
  

  try {
    const body = await request.json();
    const { mapId } = body;

   

    if (!mapId) {
      console.log('❌ Missing mapId in request body');
      return NextResponse.json({ error: 'Missing mapId' }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    

    if (!credentialId || !credentialSecret) {
      console.error('❌ Missing CalTopo credentials in environment');
      return NextResponse.json({ error: 'Missing credentials in environment' }, { status: 500 });
    }

    // Fetch map data (GET /api/v1/map/{map_id}/since/0)
    console.log('🗺️ Fetching map data for mapId:', mapId);
    const mapDataResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );
    
    // Type guard to ensure we have the expected structure
    if (!mapDataResponse || typeof mapDataResponse !== 'object') {
      console.log('❌ Invalid map data response structure');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid response structure from CalTopo' 
      }, { status: 500 });
    }
    
    const mapData = mapDataResponse as CalTopoMapResponse;

    if (!mapData) {
      console.log('❌ No map data received from CalTopo');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch map data from CalTopo' 
      }, { status: 500 });
    }

    console.log('✅ Raw map data received from CalTopo:');
    console.log('📊 Full map data structure:', JSON.stringify(mapData, null, 2));
    
    // Log the state structure specifically
    if (mapData.state) {
      console.log('🏗️ Map state structure:');
      console.log('  - Groups available:', !!mapData.state.groups);
      console.log('  - Features available:', !!mapData.state.features);
      console.log('  - Groups count:', mapData.state.groups?.length || 0);
      console.log('  - Features count:', mapData.state.features?.length || 0);
      
      if (mapData.state.groups) {
        console.log('📁 Groups/folders found:');
        mapData.state.groups.forEach((group: CalTopoGroup, index: number) => {
          console.log(`  ${index + 1}. ID: ${group.id}, Name: "${group.name}", Color: ${group.color}`);
        });
      }
      
      if (mapData.state.features) {
        console.log('🎯 Features found:');
        mapData.state.features.forEach((feature: CalTopoFeature, index: number) => {
          const isFolder = feature.properties?.class === 'Folder';
          const folderId = feature.properties?.folderId;
          console.log(`  ${index + 1}. ID: ${feature.id}, Type: ${feature.geometry?.type || 'Folder'}, Title: "${feature.properties?.title}", Folder: ${folderId || 'none'}, IsFolder: ${isFolder}`);
        });
      }
    } else {
      console.log('❌ No state object found in map data');
    }

    // Extract groups/folders from features (they have class: "Folder")
    const groups = mapData.state.features
      ?.filter((feature: CalTopoFeature) => feature.properties?.class === 'Folder')
      ?.map((folder: CalTopoFeature) => ({
        id: folder.id,
        name: folder.properties?.title || 'Unnamed Folder',
        color: folder.properties?.color
      })) || [];

    console.log('📁 Processed groups:', groups);

    // Extract GPX tracks (LineString features from state, per docs)
    const gpxTracks = mapData.state.features
      ?.filter((feature: CalTopoFeature) => feature.geometry?.type === 'LineString')
      ?.map((track: CalTopoFeature) => ({
        id: track.id,
        title: track.properties?.title || 'Unnamed Track',
        coordinates: track.geometry?.coordinates || [], // Array of [lon, lat]
        properties: track.properties, // Full props like stroke, fill, etc.
        pointCount: track.geometry?.coordinates?.length || 0, // For display
        groupId: track.properties?.folderId || undefined, // Group/folder ID
      })) || [];

    console.log('🎯 Processed GPX tracks:', gpxTracks);
    console.log('📊 Summary - Groups:', groups.length, 'Features:', gpxTracks.length);

    const response = {
      success: true,
      mapId,
      gpxTracks,
      groups,
    };

    console.log('📤 Sending response to frontend:');
    console.log('  - Success:', response.success);
    console.log('  - Map ID:', response.mapId);
    console.log('  - Groups count:', response.groups.length);
    console.log('  - GPX tracks count:', response.gpxTracks.length);
    console.log('  - Full response:', JSON.stringify(response, null, 2));
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('❌ Fetch Map API Error:', {
      errorMessage,
      errorStack,
      errorName,
      errorType: typeof error,
      timestamp: new Date().toISOString()
    });

    if (errorMessage.includes('status 404')) {
      console.log('🔍 404 Error - Map not found or no access permission');
      return NextResponse.json({
        error: `Map ID not found or service account lacks access permission.`,
      }, { status: 404 });
    }
    if (errorMessage.includes('Expected JSON')) {
      console.log('🔍 JSON Error - Invalid response format');
      return NextResponse.json({
        error: `Invalid response from CalTopo API. Check credentials and permissions.`,
      }, { status: 500 });
    }
    if (errorMessage.includes('Missing CalTopo credentials')) {
      console.log('🔍 Credentials Error - Environment variables missing');
      return NextResponse.json({
        error: 'Server configuration error: Missing CalTopo credentials in environment variables.',
      }, { status: 500 });
    }
    
    console.log('🔍 Generic Error - Unknown error type');
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

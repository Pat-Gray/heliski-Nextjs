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
      return NextResponse.json({ error: 'Missing mapId' }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    

    if (!credentialId || !credentialSecret) {
      return NextResponse.json({ error: 'Missing credentials in environment' }, { status: 500 });
    }

    // Fetch map data (GET /api/v1/map/{map_id}/since/0)
    const mapDataResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );
    
    // Type guard to ensure we have the expected structure
    if (!mapDataResponse || typeof mapDataResponse !== 'object') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid response structure from CalTopo' 
      }, { status: 500 });
    }
    
    const mapData = mapDataResponse as CalTopoMapResponse;

    if (!mapData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch map data from CalTopo' 
      }, { status: 500 });
    }
    // Extract groups/folders from features (they have class: "Folder")
    const groups = mapData.state.features
      ?.filter((feature: CalTopoFeature) => feature.properties?.class === 'Folder')
      ?.map((folder: CalTopoFeature) => ({
        id: folder.id,
        name: folder.properties?.title || 'Unnamed Folder',
        color: folder.properties?.color
      })) || [];

    // console.log('📁 Processed groups:', groups);

    // Extract GPX tracks (LineString features from state, per docs)
    const gpxTracks = mapData.state.features
      ?.filter((feature: CalTopoFeature) => feature.geometry?.type === 'LineString')
      ?.map((track: CalTopoFeature) => {
        // Check if this feature has images associated with it
        const hasImages = mapData.state.features?.some((imgFeature: CalTopoFeature) => 
          imgFeature.properties?.class === 'MapMediaObject' && 
          (imgFeature.properties?.parentId === `Shape:${track.id}` || 
           imgFeature.properties?.parentId === track.id)
        ) || false;

        return {
          id: track.id,
          title: track.properties?.title || 'Unnamed Track',
          coordinates: track.geometry?.coordinates || [], // Array of [lon, lat]
          properties: track.properties, // Full props like stroke, fill, etc.
          pointCount: track.geometry?.coordinates?.length || 0, // For display
          groupId: track.properties?.folderId || undefined, // Group/folder ID
          hasImages: hasImages, // Whether this feature has associated images
        };
      }) || [];

    // console.log('🎯 Processed GPX tracks:', gpxTracks);
    // console.log('📊 Summary - Groups:', groups.length, 'Features:', gpxTracks.length);

    // Add to the response structure
    const response = {
      success: true,
      mapId,
      gpxTracks,
      groups,
      images: [], // Add this new field
    };

    // Extract images (MapMediaObject features)
    const _images = mapData.state.features
      ?.filter((feature: CalTopoFeature) => feature.properties?.class === 'MapMediaObject')
      ?.map((image: CalTopoFeature) => ({
        id: image.id,
        title: image.properties?.title || 'Unnamed Image',
        backendMediaId: image.properties?.backendMediaId,
        parentId: image.properties?.parentId,
        markerColor: image.properties?.['marker-color'],
        markerSize: image.properties?.['marker-size'],
        markerSymbol: image.properties?.['marker-symbol'],
        created: image.properties?.created,
        updated: image.properties?.updated,
        creator: image.properties?.creator,
        properties: image.properties
      })) || [];

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('status 404')) {
      return NextResponse.json({
        error: `Map ID not found or service account lacks access permission.`,
      }, { status: 404 });
    }
    if (errorMessage.includes('Expected JSON')) {
      return NextResponse.json({
        error: `Invalid response from CalTopo API. Check credentials and permissions.`,
      }, { status: 500 });
    }
    if (errorMessage.includes('Missing CalTopo credentials')) {
      return NextResponse.json({
        error: 'Server configuration error: Missing CalTopo credentials in environment variables.',
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

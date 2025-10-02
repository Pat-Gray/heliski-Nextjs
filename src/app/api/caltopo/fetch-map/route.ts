import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';

interface GPXTrack {
  id: string;
  title: string;
  coordinates: number[][];
  properties: any;
  pointCount: number;
}

interface CalTopoMapResponse {
  success: boolean;
  mapId: string;
  gpxTracks: GPXTrack[];
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
    
    const mapData = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );

  

    // Extract GPX tracks (LineString features from state, per docs)
    const gpxTracks = mapData.state.features
      .filter((feature: any) => feature.geometry?.type === 'LineString')
      .map((track: any) => ({
        id: track.id,
        title: track.properties?.title || 'Unnamed Track',
        coordinates: track.geometry.coordinates, // Array of [lon, lat]
        properties: track.properties, // Full props like stroke, fill, etc.
        pointCount: track.geometry.coordinates.length, // For display
      }));

  

    const response = {
      success: true,
      mapId,
      gpxTracks,
    };

    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ Fetch Map API Error:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorType: typeof error,
      timestamp: new Date().toISOString()
    });

    if (error.message.includes('status 404')) {
      console.log('🔍 404 Error - Map not found or no access permission');
      return NextResponse.json({
        error: `Map ID not found or service account lacks access permission.`,
      }, { status: 404 });
    }
    if (error.message.includes('Expected JSON')) {
      console.log('🔍 JSON Error - Invalid response format');
      return NextResponse.json({
        error: `Invalid response from CalTopo API. Check credentials and permissions.`,
      }, { status: 500 });
    }
    if (error.message.includes('Missing CalTopo credentials')) {
      console.log('🔍 Credentials Error - Environment variables missing');
      return NextResponse.json({
        error: 'Server configuration error: Missing CalTopo credentials in environment variables.',
      }, { status: 500 });
    }
    
    console.log('🔍 Generic Error - Unknown error type');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';

interface UpdateColorsRequest {
  mapId: string;
  featureUpdates: Array<{
    featureId: string;
    status: 'open' | 'conditional' | 'closed';
  }>;
}

const STATUS_COLORS = {
  open: '#22c55e',      // Green
  conditional: '#f97316', // Orange  
  closed: '#ef4444'     // Red
} as const;

export async function POST(request: NextRequest) {
  try {
    const body: UpdateColorsRequest = await request.json();
    const { mapId, featureUpdates } = body;

    if (!mapId || !featureUpdates?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: mapId and featureUpdates' },
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

    // 1. Get current map data
    const mapData = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );

    // 2. Update each feature individually using the correct CalTopo API
    let updatedCount = 0;
    const errors: string[] = [];

    for (const update of featureUpdates) {
      try {
        // Find the feature in the map data - access features from result.state.features
        const feature = mapData.result?.state?.features?.find((f: any) => f.id === update.featureId);
        
        if (!feature) {
          errors.push(`Feature ${update.featureId} not found in map`);
          continue;
        }

        const newColor = STATUS_COLORS[update.status];
        
        if (!newColor) {
          errors.push(`Unknown status: ${update.status} for feature ${update.featureId}`);
          continue;
        }

        // Create updated feature with new color in properties (not style)
        const updatedFeature = {
          ...feature,
          properties: {
            ...feature.properties,
            stroke: newColor,
            fill: newColor
          }
        };

        // Update individual feature using correct CalTopo API endpoint (POST, not PUT)
        const response = await caltopoRequest(
          'POST',  // Use POST, not PUT (CalTopo doesn't support PUT)
          `/api/v1/map/${mapId}/Shape/${update.featureId}`,
          credentialId,
          credentialSecret,
          updatedFeature  // Send the complete updated feature
        );

        updatedCount++;
        

      } catch (error: any) {
        const errorMsg = `Failed to update feature ${update.featureId}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      errors,
      mapId
    });

  } catch (error: any) {
    console.error('❌ Update colors error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
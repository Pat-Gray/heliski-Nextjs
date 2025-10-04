import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '@/utils/caltopo';

interface UpdateFeatureCommentsRequest {
  mapId: string;
  featureId: string;
  comments: string;
}

export async function POST(request: NextRequest) {
  try {
    const { mapId, featureId, comments }: UpdateFeatureCommentsRequest = await request.json();

    if (!mapId || !featureId || !comments) {
      return NextResponse.json(
        { error: 'Missing required parameters: mapId, featureId, comments' },
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


    // Create a minimal feature update without fetching current data
    // This avoids CalTopo timeout issues when fetching large maps
    const updatedFeature = {
      id: featureId,
      type: 'Feature',
      properties: {
        description: comments, // Update the description field with the comments
      }
    };

    // Update the feature in CalTopo using the correct endpoint

    // Try different CalTopo update endpoints
    // Method 1: Try the Shape update endpoint (correct CalTopo format)
    try {
      await caltopoRequest(
        'POST',
        `/api/v1/map/${mapId}/Shape/${featureId}`,
        credentialId,
        credentialSecret,
        updatedFeature
      );
    } catch {
      // Method 2: Try updating via the map update endpoint
      try {
        const mapUpdatePayload = {
          state: {
            features: [updatedFeature]
          }
        };
        
        await caltopoRequest(
          'POST',
          `/api/v1/map/${mapId}`,
          credentialId,
          credentialSecret,
          mapUpdatePayload
        );
      } catch {
        // Method 3: Try PUT instead of POST
        try {
          await caltopoRequest(
            'PUT',
            `/api/v1/map/${mapId}/Shape/${featureId}`,
            credentialId,
            credentialSecret,
            updatedFeature
          );
        } catch (error3) {
          // If all methods fail, return a more specific error
          return NextResponse.json(
            { 
              error: 'Failed to update CalTopo feature comments', 
              details: `All update methods failed. Last error: ${error3 instanceof Error ? error3.message : 'Unknown error'}`,
              caltopoTimeout: true
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'CalTopo feature comments updated successfully',
      featureId,
      comments
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to update CalTopo feature comments', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}



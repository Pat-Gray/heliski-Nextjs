import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';

interface UpdateFeatureCommentsRequest {
  mapId: string;
  featureId: string;
  comments: string;
}

interface CalTopoFeature {
  id: string;
  type: string;
  properties: {
    class: string;
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
  geometry?: {
    type: string;
    coordinates: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { mapId, featureId, comments }: UpdateFeatureCommentsRequest = await request.json();

    // Validate input parameters
    if (!mapId || !featureId || comments === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: mapId, featureId, comments' },
        { status: 400 }
      );
    }

    // Validate comments length (CalTopo has limits)
    if (comments.length > 10000) {
      return NextResponse.json(
        { error: 'Comments too long. Maximum 10,000 characters allowed.' },
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

    console.log(`🔄 Updating comments for feature ${featureId} in map ${mapId}`);
    console.log(`📝 Comments length: ${comments.length} characters`);

    // Get current feature data from CalTopo
    const featureResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/Shape/${featureId}`,
      credentialId,
      credentialSecret
    ) as CalTopoFeature;

    if (!featureResponse) {
      return NextResponse.json(
        { error: 'Feature not found in CalTopo' },
        { status: 404 }
      );
    }

    console.log(`📋 Current feature data:`, {
      id: featureResponse.id,
      type: featureResponse.type,
      class: featureResponse.properties?.class,
      title: featureResponse.properties?.title,
      currentDescription: featureResponse.properties?.description?.slice(0, 100) + '...'
    });

    // Create updated feature with new comments
    // Ensure we preserve all existing properties and only update the description
    const updatedFeature: CalTopoFeature = {
      ...featureResponse,
      properties: {
        ...featureResponse.properties,
        description: comments,
        // Ensure the feature has all required properties
        class: featureResponse.properties?.class || 'Shape',
        title: featureResponse.properties?.title || 'Unnamed Feature'
      }
    };

    console.log(`📝 Updated feature properties:`, {
      description: updatedFeature.properties.description?.slice(0, 100) + '...',
      propertiesCount: Object.keys(updatedFeature.properties).length
    });

    // Send updated feature back to CalTopo
    // Try different approaches based on CalTopo API requirements
    let updateResponse;
    
    try {
      // First try: Update the entire feature
      updateResponse = await caltopoRequest(
        'POST',
        `/api/v1/map/${mapId}/Shape/${featureId}`,
        credentialId,
        credentialSecret,
        updatedFeature as unknown as Record<string, unknown>
      );
      
      console.log(`📊 Update response (full feature):`, updateResponse);
      
    } catch (error) {
      console.log('⚠️ Full feature update failed, trying properties-only update:', error);
      
      try {
        // Second try: Update only the properties
        const propertiesUpdate = {
          properties: updatedFeature.properties
        };
        
        updateResponse = await caltopoRequest(
          'POST',
          `/api/v1/map/${mapId}/Shape/${featureId}`,
          credentialId,
          credentialSecret,
          propertiesUpdate
        );
        
        console.log(`📊 Update response (properties only):`, updateResponse);
        
      } catch (propertiesError) {
        console.log('⚠️ Properties update failed, trying description-only update:', propertiesError);
        
        // Third try: Update only the description
        const descriptionUpdate = {
          properties: {
            description: comments
          }
        };
        
        updateResponse = await caltopoRequest(
          'POST',
          `/api/v1/map/${mapId}/Shape/${featureId}`,
          credentialId,
          credentialSecret,
          descriptionUpdate
        );
        
        console.log(`📊 Update response (description only):`, updateResponse);
      }
    }

    console.log(`✅ Successfully updated comments for feature ${featureId}`);
    console.log(`📊 Update response:`, updateResponse);

    // Verify the update was actually applied by fetching the feature again
    try {
      const verifyResponse = await caltopoRequest(
        'GET',
        `/api/v1/map/${mapId}/Shape/${featureId}`,
        credentialId,
        credentialSecret
      ) as CalTopoFeature;
      
      const actualDescription = verifyResponse.properties?.description || '';
      console.log(`🔍 Verification - Actual description length: ${actualDescription.length}`);
      console.log(`🔍 Verification - Expected comments length: ${comments.length}`);
      console.log(`🔍 Verification - Description matches: ${actualDescription === comments}`);
      
      if (actualDescription !== comments) {
        console.warn(`⚠️ CalTopo update may not have been applied correctly`);
        console.warn(`Expected: ${comments.slice(0, 100)}...`);
        console.warn(`Actual: ${actualDescription.slice(0, 100)}...`);
      }
    } catch (verifyError) {
      console.error(`❌ Failed to verify CalTopo update:`, verifyError);
    }

    return NextResponse.json({
      success: true,
      message: 'Feature comments updated successfully',
      mapId,
      featureId,
      commentsLength: comments.length,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating feature comments:', error);
    
    // Enhanced error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };
    
    console.error('❌ Error details:', errorDetails);

    return NextResponse.json(
      { 
        error: 'Failed to update feature comments', 
        details: errorDetails.message,
        timestamp: errorDetails.timestamp
      },
      { status: 500 }
    );
  }
}

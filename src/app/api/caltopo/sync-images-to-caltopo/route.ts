import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '@/utils/caltopo';
import { supabase } from '@/lib/supabase-db';

interface SyncImagesToCalTopoRequest {
  runId: string;
}

interface CalTopoFeature {
  id: string;
  properties?: {
    description?: string;
    [key: string]: unknown;
  };
  geometry?: {
    coordinates?: number[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CalTopoResponse {
  state?: {
    features?: CalTopoFeature[];
  };
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { runId }: SyncImagesToCalTopoRequest = await request.json();

    if (!runId) {
      return NextResponse.json(
        { error: 'Missing required parameter: runId' },
        { status: 400 }
      );
    }

    // Get run data including CalTopo integration fields
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('id, name, additional_photos, caltopo_map_id, caltopo_feature_id')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check if run is linked to CalTopo
    if (!run.caltopo_map_id || !run.caltopo_feature_id) {
      return NextResponse.json(
        { error: 'Run is not linked to CalTopo' },
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

    // Get current CalTopo feature data
    const caltopoResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${run.caltopo_map_id}/since/0`,
      credentialId,
      credentialSecret
    ) as CalTopoResponse;

    if (!caltopoResponse || !caltopoResponse.state?.features) {
      return NextResponse.json(
        { error: 'Failed to fetch CalTopo feature data' },
        { status: 500 }
      );
    }

    // Find the specific feature
    const feature = caltopoResponse.state.features.find(
      (f: CalTopoFeature) => f.id === run.caltopo_feature_id
    );

    if (!feature) {
      return NextResponse.json(
        { error: 'CalTopo feature not found' },
        { status: 404 }
      );
    }

    // Update the feature's properties to include image information
    const updatedFeature = {
      ...feature,
      properties: {
        ...feature.properties,
        // Add image URLs to the feature's description or custom properties
        imageUrls: run.additional_photos || [],
        imageCount: run.additional_photos?.length || 0,
        lastImageUpdate: new Date().toISOString(),
        // Keep existing description and add image info
        description: feature.properties?.description || '',
        // Add a custom property for images
        heliRunImages: run.additional_photos || []
      }
    };

    // Update the feature in CalTopo
    await caltopoRequest(
      'POST',
      `/api/v1/map/${run.caltopo_map_id}/Shape/${run.caltopo_feature_id}`,
      credentialId,
      credentialSecret,
      updatedFeature
    );

    return NextResponse.json({
      success: true,
      message: 'Images synced to CalTopo successfully',
      runId: run.id,
      imagesSynced: run.additional_photos?.length || 0,
      featureId: run.caltopo_feature_id
    });

  } catch (error) {
    console.error('Error syncing images to CalTopo:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync images to CalTopo', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

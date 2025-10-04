import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest, caltopoRequestBinary } from '@/utils/caltopo';
import { supabaseAdmin } from '@/lib/supabase';
import { supabase } from '@/lib/supabase-db';

interface CalTopoImageFeature {
  id: string;
  properties: {
    class: string;
    title?: string;
    parentId?: string;
    backendMediaId?: string;
    description?: string;
    comment?: string;
    notes?: string;
    details?: string;
    [key: string]: unknown;
  };
}

interface CalTopoMapResponse {
  state: {
    features: CalTopoImageFeature[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const { mapId, featureId, runId } = await request.json();

    if (!mapId || !featureId || !runId) {
      return NextResponse.json(
        { error: 'Missing required parameters: mapId, featureId, runId' },
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

    // 1. Get map data from CalTopo
    const mapDataResponse = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );

    const mapData = mapDataResponse as CalTopoMapResponse;
    if (!mapData.state?.features) {
      return NextResponse.json({ 
        success: true, 
        syncedImages: 0, 
        message: 'No features found in map data' 
      });
    }

    // 2. Find the specific feature to get its comments
    const targetFeature = mapData.state.features.find(
      (feature) => feature.id === featureId
    );

    if (!targetFeature) {
      return NextResponse.json({ 
        success: true, 
        syncedImages: 0, 
        syncedComments: 0,
        message: `Feature ${featureId} not found in map data` 
      });
    }

    // 3. Find images associated with this feature
    const imageFeatures = mapData.state.features.filter(
      (feature) => {
        const parentId = feature.properties?.parentId;
        if (!parentId) return false;
        
        // Try different parentId formats
        return parentId === `Shape:${featureId}` || 
               parentId === featureId ||
               parentId.endsWith(featureId);
      }
    );

    // 4. Extract comments from the target feature
    const featureComments = [];
    const properties = targetFeature.properties || {};
    
    // Check for common comment fields in CalTopo
    if (properties.description && typeof properties.description === 'string' && properties.description.trim()) {
      featureComments.push(properties.description.trim());
    }
    if (properties.comment && typeof properties.comment === 'string' && properties.comment.trim()) {
      featureComments.push(properties.comment.trim());
    }
    if (properties.notes && typeof properties.notes === 'string' && properties.notes.trim()) {
      featureComments.push(properties.notes.trim());
    }
    if (properties.details && typeof properties.details === 'string' && properties.details.trim()) {
      featureComments.push(properties.details.trim());
    }


    if (imageFeatures.length === 0 && featureComments.length === 0) {
      return NextResponse.json({ 
        success: true, 
        syncedImages: 0, 
        syncedComments: 0,
        message: `No images or comments found for feature ${featureId}` 
      });
    }

    // 5. Get current run data to check existing photos and CalTopo comments
    const { data: currentRun, error: runError } = await supabase
      .from('runs')
      .select('additional_photos, run_notes')
      .eq('id', runId)
      .single();

    if (runError) {
      return NextResponse.json(
        { error: 'Failed to fetch current run data' },
        { status: 500 }
      );
    }

    const existingPhotos = (currentRun?.additional_photos as string[]) || [];
    const existingNotes = currentRun?.run_notes || '';
    const newPhotoUrls: string[] = [];
    const errors: string[] = [];

    // 4. Process each image using the REAL CalTopo download endpoint
    for (const imageFeature of imageFeatures) {
      try {
        const { backendMediaId, title } = imageFeature.properties;
        
        if (!backendMediaId) {
          continue;
        }


        // Use the REAL CalTopo image download endpoint
        // Format: /api/v1/media/{media_id}/{size}.jpeg
        const result = await caltopoRequestBinary(
          `/api/v1/media/${backendMediaId}/1024.jpeg`, // 1024px for good quality
          credentialId,
          credentialSecret
        );

        const { arrayBuffer, contentType } = result;

        // Detect content type
        let finalContentType = contentType;
        if (title) {
          const ext = title.toLowerCase().split('.').pop();
          if (ext === 'jpg' || ext === 'jpeg') {
            finalContentType = 'image/jpeg';
          } else if (ext === 'png') {
            finalContentType = 'image/png';
          }
        }

        // Sanitize filename
        const sanitizedTitle = title?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'image';
        const timestamp = Date.now();
        const storagePath = `runs/${runId}/images/${timestamp}-${sanitizedTitle}.jpeg`;

        // Upload to Supabase Storage
        const buffer = Buffer.from(arrayBuffer);
        const { data: _uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('heli-ski-files')
          .upload(storagePath, buffer, {
            contentType: finalContentType,
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('heli-ski-files')
          .getPublicUrl(storagePath);

        const publicUrl = urlData.publicUrl;

        // Check for duplicates
        if (!existingPhotos.includes(publicUrl) && !newPhotoUrls.includes(publicUrl)) {
          newPhotoUrls.push(publicUrl);
        }

      } catch (error) {
        const errorMessage = `Failed to sync image ${imageFeature.properties.title}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
      }
    }

    // 6. Prepare updates for run
    const updates: { additional_photos?: string[]; run_notes?: string } = {};
    let syncedComments = 0;

    // Update photos if we have new ones
    if (newPhotoUrls.length > 0) {
      const updatedPhotos = [...existingPhotos, ...newPhotoUrls];
      updates.additional_photos = updatedPhotos;
    }

    // Update notes if we have comments (replace existing CalTopo comments)
    if (featureComments.length > 0) {
      const caltopoComments = featureComments.join('\n\n');
      
      // If there are existing notes, check if they contain CalTopo comments
      let updatedNotes = caltopoComments;
      if (existingNotes && !existingNotes.includes('--- CalTopo Comments ---')) {
        // Keep existing non-CalTopo notes and add CalTopo comments
        updatedNotes = `${existingNotes}\n\n--- CalTopo Comments ---\n${caltopoComments}`;
      }
      
      updates.run_notes = updatedNotes;
      syncedComments = featureComments.length;
    }

    // Apply updates if we have any
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('runs')
        .update(updates)
        .eq('id', runId);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update run with synced data' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      syncedImages: newPhotoUrls.length,
      syncedComments: syncedComments,
      totalImages: imageFeatures.length,
      totalComments: featureComments.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully synced ${newPhotoUrls.length} images and ${syncedComments} comments for run ${runId}`
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to sync feature images', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

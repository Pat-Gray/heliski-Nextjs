import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest, caltopoRequestBinary } from '../../../../utils/caltopo';
import { supabaseAdmin } from '../../../../lib/supabase';
import { supabase } from '../../../../lib/supabase-db';

interface CalTopoFeature {
  id: string;
  type: string;
  properties: {
    class: string;
    title?: string;
    folderId?: string;
    parentId?: string;
    backendMediaId?: string;
    description?: string;
    comment?: string;
    notes?: string;
    details?: string;
    visible?: boolean;
    labelVisible?: boolean;
    creator?: string;
    created?: number;
    updated?: number;
    '-created-by'?: string;
    '-updated-by'?: string;
    '-created-on'?: number;
    '-updated-on'?: number;
    // Geometry properties
    fill?: string;
    stroke?: string;
    'stroke-opacity'?: number;
    'stroke-width'?: number;
    'fill-opacity'?: number;
    pattern?: string;
    // Marker properties
    'marker-color'?: string;
    'marker-size'?: string;
    'marker-symbol'?: string;
    'marker-rotation'?: number;
    heading?: number;
    [key: string]: unknown;
  };
  geometry?: {
    type: string;
    coordinates: unknown;
  };
}

interface CalTopoMapResponse {
  ids: Record<string, string[]>;
  state: {
    features: CalTopoFeature[];
    type: string;
  };
  timestamp: number;
}

interface SyncStats {
  features: { total: number; new: number; updated: number };
  images: { total: number; new: number; updated: number; downloaded: number };
  folders: { total: number; new: number; updated: number };
  errors: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let mapId = 'unknown';
  
  try {
    const body = await request.json();
    const { mapId: requestedMapId, syncType = 'full' } = body;
    mapId = requestedMapId || process.env.CALTOPO_AVALANCHE_MAP_ID;

    if (!mapId) {
      return NextResponse.json({ 
        error: 'Missing mapId in request body and CALTOPO_AVALANCHE_MAP_ID not configured in environment variables' 
      }, { status: 400 });
    }

    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;

    if (!credentialId || !credentialSecret) {
      return NextResponse.json({ 
        error: 'Missing CalTopo credentials' 
      }, { status: 400 });
    }

    console.log(`🔄 Starting ${syncType} sync for map ${mapId}`);

    // Create sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from('caltopo_sync_logs')
      .insert({
        map_id: mapId,
        sync_type: syncType,
        status: 'syncing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (syncLogError) {
      throw new Error(`Failed to create sync log: ${syncLogError.message}`);
    }

    // Fetch map data from CalTopo
    console.log('📡 Fetching map data from CalTopo...');
    const mapData = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    ) as CalTopoMapResponse;

    console.log(`📊 Found ${mapData.state.features.length} features`);

    // Initialize stats
    const stats: SyncStats = {
      features: { total: 0, new: 0, updated: 0 },
      images: { total: 0, new: 0, updated: 0, downloaded: 0 },
      folders: { total: 0, new: 0, updated: 0 },
      errors: []
    };

    // Upsert map record
    const { error: mapError } = await supabase
      .from('caltopo_maps')
      .upsert({
        map_id: mapId,
        name: `Map ${mapId}`,
        last_synced_at: new Date().toISOString(),
        sync_status: 'syncing',
        total_features: mapData.state.features.length,
        total_images: mapData.state.features.filter(f => f.properties.class === 'MapMediaObject').length,
        total_folders: mapData.state.features.filter(f => f.properties.class === 'Folder').length
      }, {
        onConflict: 'map_id'
      });

    if (mapError) {
      throw new Error(`Failed to upsert map: ${mapError.message}`);
    }

    // Process folders first
    console.log('📁 Processing folders...');
    const folders = mapData.state.features.filter(f => f.properties.class === 'Folder');
    stats.folders.total = folders.length;

    for (const folder of folders) {
      try {
        const { error } = await supabase
          .from('caltopo_folders')
          .upsert({
            map_id: mapId,
            folder_id: folder.id,
            name: folder.properties.title || 'Unnamed Folder',
            parent_id: folder.properties.parentId,
            visible: folder.properties.visible ?? true,
            label_visible: folder.properties.labelVisible ?? true,
            creator: folder.properties.creator || folder.properties['-created-by'],
            caltopo_created_at: folder.properties.created ? new Date(folder.properties.created) : null,
            caltopo_updated_at: folder.properties.updated ? new Date(folder.properties.updated) : null
          }, {
            onConflict: 'map_id,folder_id'
          });

        if (error) {
          stats.errors.push(`Failed to upsert folder ${folder.id}: ${error.message}`);
        } else {
          stats.folders.new++;
        }
      } catch (error) {
        stats.errors.push(`Error processing folder ${folder.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Process features (shapes, markers, etc.)
    console.log('🎯 Processing features...');
    const features = mapData.state.features.filter(f => 
      f.properties.class === 'Shape' || f.properties.class === 'Marker'
    );
    stats.features.total = features.length;

    for (const feature of features) {
      try {
        const geometryType = feature.geometry?.type;
        const coordinates = feature.geometry?.coordinates;

        const { error } = await supabase
          .from('caltopo_features')
          .upsert({
            map_id: mapId,
            feature_id: feature.id,
            folder_id: feature.properties.folderId,
            parent_id: feature.properties.parentId,
            title: feature.properties.title,
            class: feature.properties.class,
            geometry_type: geometryType,
            coordinates: coordinates ? JSON.stringify(coordinates) : null,
            properties: JSON.stringify(feature.properties),
            visible: feature.properties.visible ?? true,
            creator: feature.properties.creator || feature.properties['-created-by'],
            caltopo_created_at: feature.properties.created ? new Date(feature.properties.created) : null,
            caltopo_updated_at: feature.properties.updated ? new Date(feature.properties.updated) : null,
            // Marker-specific fields
            marker_symbol: feature.properties['marker-symbol'],
            marker_color: feature.properties['marker-color'],
            marker_size: feature.properties['marker-size'],
            marker_rotation: feature.properties['marker-rotation'],
            heading: feature.properties.heading,
            icon: feature.properties.icon,
            label: feature.properties.label,
            label_visible: feature.properties.labelVisible ?? true
          }, {
            onConflict: 'map_id,feature_id'
          });

        if (error) {
          stats.errors.push(`Failed to upsert feature ${feature.id}: ${error.message}`);
        } else {
          stats.features.new++;
        }
      } catch (error) {
        stats.errors.push(`Error processing feature ${feature.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Process images
    console.log('📸 Processing images...');
    const images = mapData.state.features.filter(f => f.properties.class === 'MapMediaObject');
    stats.images.total = images.length;
    console.log(`📸 Found ${images.length} MapMediaObject features to process`);

    for (const image of images) {
      try {
        // Extract feature ID from parentId (handles multiple formats)
        let featureId = null;
        const parentId = image.properties.parentId;
        
        if (parentId) {
          // Handle different parentId formats:
          // - "Shape:feature-id" (for polygons/lines)
          // - "Marker:feature-id" (for markers/points)
          // - "feature-id" (direct reference)
          if (parentId.startsWith('Shape:')) {
            featureId = parentId.replace('Shape:', '');
          } else if (parentId.startsWith('Marker:')) {
            featureId = parentId.replace('Marker:', '');
          } else if (parentId.includes(':')) {
            // Handle other formats like "Point:feature-id"
            featureId = parentId.split(':')[1];
          } else {
            // Direct feature ID reference
            featureId = parentId;
          }
        }
        
        console.log(`📸 Processing image: ${image.properties.title} (${image.id})`);
        console.log(`📸   Backend Media ID: ${image.properties.backendMediaId}`);
        console.log(`📸   Parent ID: ${parentId}`);
        console.log(`📸   Extracted Feature ID: ${featureId}`);

        const { error } = await supabase
          .from('caltopo_images')
          .upsert({
            map_id: mapId,
            image_id: image.id,
            feature_id: featureId,
            parent_id: image.properties.parentId,
            title: image.properties.title,
            backend_media_id: image.properties.backendMediaId,
            description: image.properties.description,
            comment: image.properties.comment,
            notes: image.properties.notes,
            details: image.properties.details,
            marker_color: image.properties['marker-color'],
            marker_size: image.properties['marker-size'],
            marker_symbol: image.properties['marker-symbol'],
            heading: image.properties.heading,
            creator: image.properties.creator,
            caltopo_created_at: image.properties.created ? new Date(image.properties.created) : null,
            caltopo_updated_at: image.properties.updated ? new Date(image.properties.updated) : null,
            download_status: 'pending'
          }, {
            onConflict: 'map_id,image_id'
          });

        if (error) {
          stats.errors.push(`Failed to upsert image ${image.id}: ${error.message}`);
        } else {
          stats.images.new++;
        }
      } catch (error) {
        stats.errors.push(`Error processing image ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Download images if requested
    if (syncType === 'full' || syncType === 'images') {
      console.log('⬇️ Downloading images...');
      
      // Get all pending images
      const { data: pendingImages, error: pendingError } = await supabase
        .from('caltopo_images')
        .select('*')
        .eq('map_id', mapId)
        .eq('download_status', 'pending');

      console.log(`📸 Found ${pendingImages?.length || 0} pending images to download`);
      if (pendingImages && pendingImages.length > 0) {
        console.log('📸 Pending images:', pendingImages.map(img => ({
          id: img.image_id,
          title: img.title,
          backend_media_id: img.backend_media_id,
          download_status: img.download_status
        })));
      }

      if (pendingError) {
        stats.errors.push(`Failed to fetch pending images: ${pendingError.message}`);
      } else if (pendingImages) {
        for (const image of pendingImages) {
          try {
            console.log(`⬇️ Downloading image: ${image.title} (${image.image_id})`);
            console.log(`⬇️   Backend Media ID: ${image.backend_media_id}`);
            
            if (!image.backend_media_id) {
              console.log(`⬇️   Skipping - no backend media ID`);
              continue;
            }

            // Update status to downloading
            await supabase
              .from('caltopo_images')
              .update({ download_status: 'downloading' })
              .eq('id', image.id);

            // Download image from CalTopo
            const result = await caltopoRequestBinary(
              `/api/v1/media/${image.backend_media_id}/1024.jpeg`,
              credentialId,
              credentialSecret
            );

            const { arrayBuffer, contentType } = result;

            // Clean the content type (remove charset and other parameters)
            let cleanContentType = contentType?.split(';')[0] || 'image/jpeg';
            
            // Ensure we have a valid MIME type
            if (!cleanContentType.startsWith('image/')) {
              // Determine from file extension
              if (image.title?.toLowerCase().includes('.png')) {
                cleanContentType = 'image/png';
              } else if (image.title?.toLowerCase().includes('.gif')) {
                cleanContentType = 'image/gif';
              } else if (image.title?.toLowerCase().includes('.webp')) {
                cleanContentType = 'image/webp';
              } else {
                cleanContentType = 'image/jpeg'; // Default fallback
              }
            }
            
            console.log(`⬇️   Original content type: ${contentType}`);
            console.log(`⬇️   Clean content type: ${cleanContentType}`);

            // Determine file extension
            let ext = 'jpeg';
            if (image.title) {
              const titleExt = image.title.toLowerCase().split('.').pop();
              if (titleExt === 'jpg' || titleExt === 'jpeg' || titleExt === 'png') {
                ext = titleExt;
              }
            }

            // Sanitize filename
            const sanitizedTitle = image.title?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'image';
            const timestamp = Date.now();
            const storagePath = `caltopo/${mapId}/images/${timestamp}-${sanitizedTitle}.${ext}`;

            // Upload to Supabase Storage
            console.log(`⬇️   Uploading to storage path: ${storagePath}`);
            const buffer = Buffer.from(arrayBuffer);
            console.log(`⬇️   Buffer size: ${buffer.length} bytes`);
            
            const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
              .from('caltopo')
              .upload(storagePath, buffer, {
                contentType: cleanContentType,
                upsert: true
              });

            if (uploadError) {
              console.log(`⬇️   Upload error: ${uploadError.message}`);
              throw new Error(`Storage upload failed: ${uploadError.message}`);
            }
            
            console.log(`⬇️   Upload successful:`, uploadData);

            // Get public URL
            const { data: urlData } = supabaseAdmin.storage
              .from('caltopo')
              .getPublicUrl(storagePath);

            // Update image record with download info
            console.log(`⬇️   Updating database with download info`);
            console.log(`⬇️   Public URL: ${urlData.publicUrl}`);
            
            const { error: updateError } = await supabase
              .from('caltopo_images')
              .update({
                local_file_path: storagePath,
                local_file_url: urlData.publicUrl,
                file_size_bytes: buffer.length,
                content_type: cleanContentType,
                download_status: 'completed'
              })
              .eq('id', image.id);

            if (updateError) {
              console.log(`⬇️   Database update error: ${updateError.message}`);
              throw new Error(`Database update failed: ${updateError.message}`);
            }

            console.log(`⬇️   Image download completed successfully`);
            stats.images.downloaded++;

          } catch (error) {
            // Update status to failed
            await supabase
              .from('caltopo_images')
              .update({ download_status: 'failed' })
              .eq('id', image.id);

            stats.errors.push(`Failed to download image ${image.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }

    // Update sync log
    const duration = Date.now() - startTime;
    await supabase
      .from('caltopo_sync_logs')
      .update({
        status: stats.errors.length > 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(duration / 1000),
        features_synced: stats.features.new,
        images_synced: stats.images.new,
        folders_synced: stats.folders.new,
        images_downloaded: stats.images.downloaded,
        errors: stats.errors.length > 0 ? stats.errors : null
      })
      .eq('id', syncLog.id);

    // Update map status
    await supabase
      .from('caltopo_maps')
      .update({
        sync_status: stats.errors.length > 0 ? 'failed' : 'completed',
        last_synced_at: new Date().toISOString()
      })
      .eq('map_id', mapId);

    console.log('✅ Sync completed successfully');

    return NextResponse.json({
      success: true,
      message: `Sync completed for map ${mapId}`,
      stats: {
        features: stats.features,
        images: stats.images,
        folders: stats.folders,
        errors: stats.errors.length,
        duration: Math.round(duration / 1000)
      },
      errors: stats.errors.length > 0 ? stats.errors : undefined
    });

  } catch (error: unknown) {
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

import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest, caltopoRequestBinary } from '../../../../utils/caltopo';
import { supabaseAdmin } from '../../../../lib/supabase';
import { supabase } from '../../../../lib/supabase-db';
import { deleteGPX } from '../../../../lib/supabase-storage';

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
  features: { total: number; new: number; updated: number; unchanged: number };
  markers: { total: number; new: number; updated: number; unchanged: number };
  points: { total: number; new: number; updated: number; unchanged: number };
  images: { total: number; new: number; updated: number; downloaded: number; skipped: number };
  folders: { total: number; new: number; updated: number; unchanged: number };
  errors: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let mapId = 'unknown';
  
  try {
    const body = await request.json();
    const { mapId: requestedMapId, syncType = 'incremental' } = body;
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

    // Get last sync timestamp for incremental sync
    let lastSyncTimestamp = 0;
    if (syncType === 'incremental') {
      const { data: lastSync } = await supabase
        .from('caltopo_sync_logs')
        .select('started_at')
        .eq('map_id', mapId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (lastSync?.started_at) {
        lastSyncTimestamp = Math.floor(new Date(lastSync.started_at).getTime() / 1000);
        console.log(`📅 Last sync: ${new Date(lastSync.started_at).toISOString()}`);
      } else {
        console.log('📅 No previous sync found, doing full sync');
        lastSyncTimestamp = 0;
      }
    }

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

    // Fetch map data from CalTopo (incremental or full)
    console.log('📡 Fetching map data from CalTopo...');
    const endpoint = lastSyncTimestamp > 0 
      ? `/api/v1/map/${mapId}/since/${lastSyncTimestamp}`
      : `/api/v1/map/${mapId}/since/0`;
    
    console.log(`📡 Using endpoint: ${endpoint}`);
    const mapData = await caltopoRequest(
      'GET',
      endpoint,
      credentialId,
      credentialSecret
    ) as CalTopoMapResponse;

    console.log(`📊 Found ${mapData.state.features.length} features`);

    // Initialize stats
    const stats: SyncStats = {
      features: { total: 0, new: 0, updated: 0, unchanged: 0 },
      markers: { total: 0, new: 0, updated: 0, unchanged: 0 },
      points: { total: 0, new: 0, updated: 0, unchanged: 0 },
      images: { total: 0, new: 0, updated: 0, downloaded: 0, skipped: 0 },
      folders: { total: 0, new: 0, updated: 0, unchanged: 0 },
      errors: []
    };

    // Track downloaded images by feature to prevent duplicates
    const downloadedImagesByFeature: Record<string, string[]> = {};

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

    // Process folders with change detection
    console.log('📁 Processing folders...');
    const folders = mapData.state.features.filter(f => f.properties.class === 'Folder');
    stats.folders.total = folders.length;

    for (const folder of folders) {
      try {
        // Check if folder exists and get current data
        const { data: existingFolder } = await supabase
          .from('caltopo_folders')
          .select('*')
          .eq('map_id', mapId)
          .eq('folder_id', folder.id)
          .single();

        const folderData = {
          map_id: mapId,
          folder_id: folder.id,
          name: folder.properties.title || 'Unnamed Folder',
          parent_id: folder.properties.parentId,
          visible: folder.properties.visible ?? true,
          label_visible: folder.properties.labelVisible ?? true,
          creator: folder.properties.creator || folder.properties['-created-by'],
          caltopo_created_at: folder.properties.created ? new Date(folder.properties.created) : null,
          caltopo_updated_at: folder.properties.updated ? new Date(folder.properties.updated) : null
        };

        // Check if folder has changed
        const hasChanged = !existingFolder || 
          existingFolder.name !== folderData.name ||
          existingFolder.parent_id !== folderData.parent_id ||
          existingFolder.visible !== folderData.visible ||
          existingFolder.label_visible !== folderData.label_visible ||
          (existingFolder.caltopo_updated_at && folderData.caltopo_updated_at && 
           new Date(existingFolder.caltopo_updated_at).getTime() !== new Date(folderData.caltopo_updated_at).getTime());

        if (hasChanged) {
          const { error } = await supabase
            .from('caltopo_folders')
            .upsert(folderData, {
              onConflict: 'map_id,folder_id'
            });

          if (error) {
            stats.errors.push(`Failed to upsert folder ${folder.id}: ${error.message}`);
          } else {
            if (existingFolder) {
              stats.folders.updated++;
            } else {
              stats.folders.new++;
            }
          }
        } else {
          stats.folders.unchanged++;
        }
      } catch (error) {
        stats.errors.push(`Error processing folder ${folder.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Process features with change detection
    console.log('🎯 Processing features...');
    const features = mapData.state.features.filter(f => 
      f.properties.class === 'Shape' || f.properties.class === 'Marker'
    );
    stats.features.total = features.length;

    // Separate markers and points for detailed tracking
    const markers = features.filter(f => f.properties.class === 'Marker');
    const points = features.filter(f => f.properties.class === 'Shape' && f.geometry?.type === 'Point');
    const otherFeatures = features.filter(f => f.properties.class === 'Shape' && f.geometry?.type !== 'Point');
    
    stats.markers.total = markers.length;
    stats.points.total = points.length;
    
    console.log(`📍 Found ${markers.length} markers, ${points.length} points, ${otherFeatures.length} other features`);

    for (const feature of features) {
      try {
        // Check if feature exists and get current data
        const { data: existingFeature } = await supabase
          .from('caltopo_features')
          .select('*')
          .eq('map_id', mapId)
          .eq('feature_id', feature.id)
          .single();

        const geometryType = feature.geometry?.type;
        const coordinates = feature.geometry?.coordinates;

        const featureData = {
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
        };

        // Check if feature has changed
        const hasChanged = !existingFeature || 
          existingFeature.title !== featureData.title ||
          existingFeature.folder_id !== featureData.folder_id ||
          existingFeature.geometry_type !== featureData.geometry_type ||
          existingFeature.coordinates !== featureData.coordinates ||
          existingFeature.properties !== featureData.properties ||
          (existingFeature.caltopo_updated_at && featureData.caltopo_updated_at && 
           new Date(existingFeature.caltopo_updated_at).getTime() !== new Date(featureData.caltopo_updated_at).getTime());

        if (hasChanged) {
          const { error } = await supabase
            .from('caltopo_features')
            .upsert(featureData, {
              onConflict: 'map_id,feature_id'
            });

          if (error) {
            stats.errors.push(`Failed to upsert feature ${feature.id}: ${error.message}`);
          } else {
            if (existingFeature) {
              stats.features.updated++;
              
        // If geometry changed, regenerate GPX cache
if (existingFeature.geometry_type !== featureData.geometry_type ||
  existingFeature.coordinates !== featureData.coordinates) {
try {
  await deleteGPX(mapId, feature.id);
  console.log(`🗑️ Invalidated GPX cache for feature ${feature.id} (geometry changed)`);
  
  // Regenerate GPX for linked runs
  const { data: linkedRuns } = await supabase
    .from('runs')
    .select('id')
    .eq('caltopo_map_id', mapId)
    .eq('caltopo_feature_id', feature.id);
  
  if (linkedRuns && linkedRuns.length > 0) {
    for (const run of linkedRuns) {
      try {
        // Trigger GPX cache regeneration
        const cacheResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/caltopo/cache-gpx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapId,
            featureId: feature.id,
            runId: run.id
          })
        });
        
        if (cacheResponse.ok) {
          console.log(`✅ Regenerated GPX for run ${run.id}`);
        }
      } catch (error) {
        console.error(`Failed to regenerate GPX for run ${run.id}:`, error);
      }
    }
  }
} catch (error) {
  console.error(`Failed to invalidate GPX for feature ${feature.id}:`, error);
  stats.errors.push(`Failed to invalidate GPX for feature ${feature.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
}
              
              // Track markers and points separately
              if (feature.properties.class === 'Marker') {
                stats.markers.updated++;
              } else if (feature.geometry?.type === 'Point') {
                stats.points.updated++;
              }
            } else {
              stats.features.new++;
              // Track markers and points separately
              if (feature.properties.class === 'Marker') {
                stats.markers.new++;
              } else if (feature.geometry?.type === 'Point') {
                stats.points.new++;
              }
            }
          }
        } else {
          stats.features.unchanged++;
          // Track markers and points separately
          if (feature.properties.class === 'Marker') {
            stats.markers.unchanged++;
          } else if (feature.geometry?.type === 'Point') {
            stats.points.unchanged++;
          }
        }
      } catch (error) {
        stats.errors.push(`Error processing feature ${feature.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Process images with change detection
    console.log('📸 Processing images...');
    const images = mapData.state.features.filter(f => f.properties.class === 'MapMediaObject');
    stats.images.total = images.length;

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

        // Check if image exists and get current data
        const { data: existingImage } = await supabase
          .from('caltopo_images')
          .select('*')
          .eq('map_id', mapId)
          .eq('image_id', image.id)
          .single();

        const imageData = {
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
        };

        // Check if image has changed
        const hasChanged = !existingImage || 
          existingImage.title !== imageData.title ||
          existingImage.backend_media_id !== imageData.backend_media_id ||
          existingImage.parent_id !== imageData.parent_id ||
          (existingImage.caltopo_updated_at && imageData.caltopo_updated_at && 
           new Date(existingImage.caltopo_updated_at).getTime() !== new Date(imageData.caltopo_updated_at).getTime());

        if (hasChanged) {
          const { error } = await supabase
            .from('caltopo_images')
            .upsert(imageData, {
              onConflict: 'map_id,image_id'
            });

          if (error) {
            stats.errors.push(`Failed to upsert image ${image.id}: ${error.message}`);
          } else {
            if (existingImage) {
              stats.images.updated++;
            } else {
              stats.images.new++;
            }
          }
        } else {
          stats.images.skipped++;
        }
      } catch (error) {
        stats.errors.push(`Error processing image ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Download only new/changed images
    if (syncType === 'full' || syncType === 'incremental') {
      console.log('⬇️ Downloading new/changed images...');
      
      // Get only pending images (new or changed)
      const { data: pendingImages, error: pendingError } = await supabase
        .from('caltopo_images')
        .select('*')
        .eq('map_id', mapId)
        .eq('download_status', 'pending');

      console.log(`📸 Found ${pendingImages?.length || 0} pending images to download`);

      if (pendingError) {
        stats.errors.push(`Failed to fetch pending images: ${pendingError.message}`);
      } else if (pendingImages && pendingImages.length > 0) {
        for (const image of pendingImages) {
          try {
            console.log(`⬇️ Downloading image: ${image.title} (${image.image_id})`);
            
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

            // Clean the content type
            let cleanContentType = contentType?.split(';')[0] || 'image/jpeg';
            if (!cleanContentType.startsWith('image/')) {
              if (image.title?.toLowerCase().includes('.png')) {
                cleanContentType = 'image/png';
              } else if (image.title?.toLowerCase().includes('.gif')) {
                cleanContentType = 'image/gif';
              } else if (image.title?.toLowerCase().includes('.webp')) {
                cleanContentType = 'image/webp';
              } else {
                cleanContentType = 'image/jpeg';
              }
            }

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
            const buffer = Buffer.from(arrayBuffer);
            const { data: _uploadData, error: uploadError } = await supabaseAdmin.storage
              .from('caltopo')
              .upload(storagePath, buffer, {
                contentType: cleanContentType,
                upsert: true
              });

            if (uploadError) {
              throw new Error(`Storage upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const { data: urlData } = supabaseAdmin.storage
              .from('caltopo')
              .getPublicUrl(storagePath);

            // Update image record with download info
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
              throw new Error(`Database update failed: ${updateError.message}`);
            }

            console.log(`⬇️   Image download completed successfully`);
            stats.images.downloaded++;

            // Track downloaded image by feature
            if (!downloadedImagesByFeature[image.feature_id]) {
              downloadedImagesByFeature[image.feature_id] = [];
            }
            downloadedImagesByFeature[image.feature_id].push(urlData.publicUrl);

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
    // Update linked runs with NEW photos only
    if (Object.keys(downloadedImagesByFeature).length > 0) {
      console.log('🔄 Updating linked runs with new photos...');
      
      // Get all runs linked to this map
      const { data: linkedRuns, error: runsError } = await supabase
        .from('runs')
        .select('id, caltopo_feature_id, additional_photos')
        .eq('caltopo_map_id', mapId)
        .not('caltopo_feature_id', 'is', null);

      if (runsError) {
        stats.errors.push(`Failed to fetch linked runs: ${runsError.message}`);
      } else if (linkedRuns && linkedRuns.length > 0) {
        console.log(`📸 Found ${linkedRuns.length} runs linked to this map`);
        
        for (const run of linkedRuns) {
          if (!run.caltopo_feature_id) continue;
          
          // Only update if this feature had new images downloaded
          const newImageUrls = downloadedImagesByFeature[run.caltopo_feature_id];
          if (!newImageUrls || newImageUrls.length === 0) continue;
          
          try {
            // Get existing photos (handle both array and null)
            const existingPhotos = Array.isArray(run.additional_photos) ? run.additional_photos : [];
            
            // Only add URLs that aren't already in the run
            const trulyNewUrls = newImageUrls.filter(url => !existingPhotos.includes(url));

            if (trulyNewUrls.length > 0) {
              // Update run with new photos
              const updatedPhotos = [...existingPhotos, ...trulyNewUrls];
              
              const { error: updateError } = await supabase
                .from('runs')
                .update({ additional_photos: updatedPhotos })
                .eq('id', run.id);

              if (updateError) {
                console.error(`Failed to update photos for run ${run.id}:`, updateError);
                stats.errors.push(`Failed to update photos for run ${run.id}: ${updateError.message}`);
              } else {
                console.log(`✅ Updated run ${run.id} with ${trulyNewUrls.length} new photos`);
              }
            }
          } catch (error) {
            console.error(`Error updating photos for run ${run.id}:`, error);
            stats.errors.push(`Error updating photos for run ${run.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        features_synced: stats.features.new + stats.features.updated,
        markers_synced: stats.markers.new + stats.markers.updated,
        points_synced: stats.points.new + stats.points.updated,
        images_synced: stats.images.new + stats.images.updated,
        folders_synced: stats.folders.new + stats.folders.updated,
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

    console.log('✅ Incremental sync completed successfully');

    return NextResponse.json({
      success: true,
      message: `Incremental sync completed for map ${mapId}`,
      stats: {
        features: stats.features,
        markers: stats.markers,
        points: stats.points,
        images: stats.images,
        folders: stats.folders,
        errors: stats.errors.length,
        duration: Math.round(duration / 1000),
        efficiency: {
          featuresEfficiency: `${Math.round((stats.features.unchanged / stats.features.total) * 100)}% unchanged`,
          markersEfficiency: `${Math.round((stats.markers.unchanged / stats.markers.total) * 100)}% unchanged`,
          pointsEfficiency: `${Math.round((stats.points.unchanged / stats.points.total) * 100)}% unchanged`,
          imagesEfficiency: `${Math.round((stats.images.skipped / stats.images.total) * 100)}% skipped`,
          foldersEfficiency: `${Math.round((stats.folders.unchanged / stats.folders.total) * 100)}% unchanged`
        }
      },
      errors: stats.errors.length > 0 ? stats.errors : undefined
    });

  } catch (error: unknown) {
    console.error('❌ Incremental sync failed:', error);

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

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');

    if (!mapId) {
      return NextResponse.json({
        success: false,
        error: 'mapId parameter is required'
      }, { status: 400 });
    }

    console.log(`🔍 Searching for avalanche features in map ${mapId}`);

    // First, find the avalanche folder by name pattern
    const { data: avalancheFolder, error: folderError } = await supabase
      .from('caltopo_folders')
      .select('folder_id, name')
      .eq('map_id', mapId)
      .ilike('name', '%avalanche%')
      .limit(1)
      .single();

    console.log(`📁 Avalanche folder search result:`, { avalancheFolder, folderError });

    if (folderError || !avalancheFolder) {
      // Let's also check what folders exist for this map
      const { data: allFolders } = await supabase
        .from('caltopo_folders')
        .select('folder_id, name')
        .eq('map_id', mapId);
      
      console.log(`📁 All folders in map ${mapId}:`, allFolders);
      
      return NextResponse.json({
        success: false,
        error: `Avalanche folder not found. Available folders: ${allFolders?.map(f => f.name).join(', ') || 'none'}`
      }, { status: 404 });
    }

    console.log(`📁 Found avalanche folder: ${avalancheFolder.name} (${avalancheFolder.folder_id})`);

    // Get features from the avalanche folder
    const { data: features, error: featuresError } = await supabase
      .from('caltopo_features')
      .select('*')
      .eq('map_id', mapId)
      .eq('folder_id', avalancheFolder.folder_id)
      .eq('visible', true)
      .order('title');

    console.log(`🔍 Features query result:`, { features: features?.length || 0, featuresError });

    if (featuresError) {
      throw new Error(`Database error: ${featuresError.message}`);
    }

    // Get images for these features separately
    const featureIds = features?.map(f => f.feature_id) || [];
    let images: any[] = [];
    
    if (featureIds.length > 0) {
      const { data: imagesData, error: imagesError } = await supabase
        .from('caltopo_images')
        .select('*')
        .in('feature_id', featureIds)
        .eq('map_id', mapId)
        .eq('download_status', 'completed');
      
      if (imagesError) {
        console.error('Images query error:', imagesError);
      } else {
        images = imagesData || [];
        console.log(`📸 Found ${images.length} images for avalanche features`);
      }
    }

    // Transform features to match the expected interface
    const transformedFeatures = features?.map(feature => {
      // Find images for this feature
      const featureImages = images.filter(img => img.feature_id === feature.feature_id);
      
      return {
        id: feature.feature_id,
        title: feature.title || 'Unnamed Feature',
        pointCount: feature.geometry_type === 'Point' ? 1 : 
                    feature.geometry_type === 'LineString' ? 
                      (Array.isArray(feature.coordinates) ? feature.coordinates.length : 0) :
                      feature.geometry_type === 'Polygon' ?
                        (Array.isArray(feature.coordinates) && Array.isArray(feature.coordinates[0]) ? 
                          feature.coordinates[0].length : 0) : 0,
        properties: feature.properties || {},
        groupId: feature.folder_id,
        hasImages: featureImages.length > 0,
        geometryType: feature.geometry_type,
        class: feature.class,
        markerSymbol: feature.marker_symbol,
        markerColor: feature.marker_color,
        markerSize: feature.marker_size,
        coordinates: feature.coordinates,
        visible: feature.visible,
        creator: feature.creator,
        created: feature.caltopo_created_at,
        updated: feature.caltopo_updated_at,
        images: featureImages.map(img => ({
          id: img.image_id,
          title: img.title,
          description: img.description,
          comment: img.comment,
          notes: img.notes,
          local_file_url: img.local_file_url,
          caltopo_url: img.caltopo_url,
          file_size: img.file_size_bytes,
          mime_type: img.content_type,
          caltopo_created_at: img.caltopo_created_at,
          caltopo_updated_at: img.caltopo_updated_at
        }))
      };
    }) || [];

    return NextResponse.json({ 
      success: true, 
      avalancheFeatures: transformedFeatures 
    });

  } catch (error: unknown) {
    console.error('Error fetching avalanche features:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

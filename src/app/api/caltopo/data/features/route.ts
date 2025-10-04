import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('mapId');
    const type = searchParams.get('type') || 'all'; // all, markers, points, shapes

    if (!mapId) {
      return NextResponse.json({
        success: false,
        error: 'mapId parameter is required'
      }, { status: 400 });
    }

    console.log(`📡 Fetching synced features for map ${mapId}, type: ${type}`);

    let query = supabase
      .from('caltopo_features')
      .select('*')
      .eq('map_id', mapId);

    // Filter by type
    if (type === 'markers') {
      query = query.eq('class', 'Marker');
    } else if (type === 'points') {
      query = query.eq('geometry_type', 'Point');
    } else if (type === 'shapes') {
      query = query.eq('class', 'Shape');
    }
    // 'all' includes everything

    const { data: features, error } = await query.order('title');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Found ${features?.length || 0} synced features`);

    // Transform to match expected format
    const transformedFeatures = features?.map(feature => ({
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
      hasImages: false, // Will be determined by checking caltopo_images table
      geometryType: feature.geometry_type,
      class: feature.class,
      markerSymbol: feature.marker_symbol,
      markerColor: feature.marker_color,
      markerSize: feature.marker_size,
      coordinates: feature.coordinates,
      visible: feature.visible,
      creator: feature.creator,
      created: feature.caltopo_created_at,
      updated: feature.caltopo_updated_at
    })) || [];

    // Check for images for each feature
    if (transformedFeatures.length > 0) {
      const featureIds = transformedFeatures.map(f => f.id);
      const { data: images } = await supabase
        .from('caltopo_images')
        .select('feature_id')
        .in('feature_id', featureIds);

      const featuresWithImages = new Set(images?.map(img => img.feature_id) || []);
      
      transformedFeatures.forEach(feature => {
        feature.hasImages = featuresWithImages.has(feature.id);
      });
    }

    return NextResponse.json({
      success: true,
      features: transformedFeatures,
      count: transformedFeatures.length
    });

  } catch (error: unknown) {
    console.error('❌ Failed to fetch synced features:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

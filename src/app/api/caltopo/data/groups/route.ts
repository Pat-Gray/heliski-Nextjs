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

    console.log(`📡 Fetching synced groups for map ${mapId}`);

    const { data: groups, error } = await supabase
      .from('caltopo_folders')
      .select('*')
      .eq('map_id', mapId)
      .order('name');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Found ${groups?.length || 0} synced groups`);

    // Transform to match expected format
    const transformedGroups = groups?.map(group => ({
      id: group.folder_id,
      name: group.name,
      color: group.properties?.color || '#3B82F6', // Default blue color
      parentId: group.parent_id,
      visible: group.visible,
      labelVisible: group.label_visible,
      creator: group.creator,
      created: group.caltopo_created_at,
      updated: group.caltopo_updated_at
    })) || [];

    return NextResponse.json({
      success: true,
      groups: transformedGroups,
      count: transformedGroups.length
    });

  } catch (error: unknown) {
    console.error('❌ Failed to fetch synced groups:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

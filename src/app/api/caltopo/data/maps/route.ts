import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-db';

export async function GET(_request: NextRequest) {
  try {
    console.log('📡 Fetching synced CalTopo maps...');

    const { data: maps, error } = await supabase
      .from('caltopo_maps')
      .select('*')
      .order('last_synced_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Found ${maps?.length || 0} synced maps`);

    // Transform to match expected format
    const transformedMaps = maps?.map(map => ({
      id: map.map_id,
      title: map.name || `Map ${map.map_id}`,
      accountId: 'synced', // Since we're using synced data
      lastSynced: map.last_synced_at,
      totalFeatures: map.total_features || 0,
      totalImages: map.total_images || 0,
      totalFolders: map.total_folders || 0,
      totalMarkers: map.total_markers || 0,
      totalPoints: map.total_points || 0,
      syncStatus: map.sync_status
    })) || [];

    return NextResponse.json({
      success: true,
      maps: transformedMaps
    });

  } catch (error: unknown) {
    console.error('❌ Failed to fetch synced maps:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

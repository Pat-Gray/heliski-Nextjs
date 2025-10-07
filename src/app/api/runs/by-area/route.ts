import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');
    
    if (!areaId) {
      return NextResponse.json({ error: 'areaId parameter is required' }, { status: 400 });
    }

    // First get sub-areas for this area
    const { data: subAreas, error: subAreaError } = await supabase
      .from('sub_areas')
      .select('id')
      .eq('area_id', areaId);

    if (subAreaError) {
      console.error('Error fetching sub-areas:', subAreaError);
      return NextResponse.json({ error: 'Failed to fetch sub-areas' }, { status: 500 });
    }

    if (!subAreas || subAreas.length === 0) {
      return NextResponse.json({ runs: [] });
    }

    const subAreaIds = subAreas.map(sa => sa.id);

    // Then get runs for those sub-areas
    const { data: runs, error } = await supabase
      .from('runs')
      .select(`
        id,
        name,
        run_number,
        status,
        aspect,
        elevation_max,
        elevation_min,
        gpx_path,
        caltopo_map_id,
        caltopo_feature_id,
        sub_area_id,
        created_at
      `)
      .in('sub_area_id', subAreaIds)
      .order('run_number', { ascending: true });

    // Transform the data to match the expected schema (camelCase)
    const transformedRuns = runs?.map(run => ({
      id: run.id,
      name: run.name,
      subAreaId: run.sub_area_id,
      runNumber: run.run_number,
      status: run.status,
      aspect: run.aspect,
      elevationMax: run.elevation_max,
      elevationMin: run.elevation_min,
      gpxPath: run.gpx_path,
      caltopoMapId: run.caltopo_map_id,
      caltopoFeatureId: run.caltopo_feature_id,
      createdAt: run.created_at
    })) || [];

    if (error) {
      console.error('Error fetching runs for area:', error);
      return NextResponse.json({ error: `Failed to fetch runs: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ runs: transformedRuns });
  } catch (error) {
    console.error('Error in runs by area API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all runs with their sub_area_id
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('sub_area_id')
      .not('sub_area_id', 'is', null);

    if (runsError) {
      console.error('Error fetching runs:', runsError);
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
    }

    // Get all sub-areas with their area_id
    const { data: subAreas, error: subAreasError } = await supabase
      .from('sub_areas')
      .select('id, area_id');

    if (subAreasError) {
      console.error('Error fetching sub-areas:', subAreasError);
      return NextResponse.json({ error: 'Failed to fetch sub-areas' }, { status: 500 });
    }

    // Create a map of sub_area_id to area_id
    const subAreaToAreaMap = new Map();
    subAreas?.forEach(subArea => {
      subAreaToAreaMap.set(subArea.id, subArea.area_id);
    });

    // Count runs per area
    const counts: Record<string, number> = {};
    runs?.forEach(run => {
      const areaId = subAreaToAreaMap.get(run.sub_area_id);
      if (areaId) {
        counts[areaId] = (counts[areaId] || 0) + 1;
      }
    });

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error in run counts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

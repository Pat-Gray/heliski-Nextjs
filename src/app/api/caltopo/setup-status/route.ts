import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase-db';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET(_request: NextRequest) {
  try {
    const mapId = process.env.CALTOPO_AVALANCHE_MAP_ID;
    
    if (!mapId) {
      return NextResponse.json({
        isConfigured: false,
        needsSetup: true,
        setupSteps: {
          environmentVariables: false,
          databaseSchema: false,
          storageBucket: false,
          initialSync: false
        }
      });
    }

    // Check if database schema exists
    const { data: mapsTable } = await supabase
      .from('caltopo_maps')
      .select('map_id')
      .limit(1);

    const hasDatabaseSchema = !!mapsTable;

    // Check if storage bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const hasStorageBucket = buckets?.some(bucket => bucket.name === 'caltopo') || false;

    // Check if initial sync has been completed
    const { data: syncLogs } = await supabase
      .from('caltopo_sync_logs')
      .select('status')
      .eq('map_id', mapId)
      .eq('status', 'completed')
      .limit(1);

    const hasInitialSync = !!syncLogs && syncLogs.length > 0;

    const isFullyConfigured = hasDatabaseSchema && hasStorageBucket && hasInitialSync;

    return NextResponse.json({
      isConfigured: isFullyConfigured,
      needsSetup: !isFullyConfigured,
      setupSteps: {
        environmentVariables: !!mapId,
        databaseSchema: hasDatabaseSchema,
        storageBucket: hasStorageBucket,
        initialSync: hasInitialSync
      },
      mapId: mapId,
      lastSync: syncLogs?.[0] ? syncLogs[0] : null
    });

  } catch (error: unknown) {
    console.error('❌ Setup status check failed:', error);
    
    return NextResponse.json({
      isConfigured: false,
      needsSetup: true,
      setupSteps: {
        environmentVariables: false,
        databaseSchema: false,
        storageBucket: false,
        initialSync: false
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

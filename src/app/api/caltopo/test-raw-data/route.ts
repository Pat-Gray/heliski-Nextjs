import { NextRequest, NextResponse } from 'next/server';
import { caltopoRequest } from '../../../../utils/caltopo';

export async function POST(_request: NextRequest) {
  try {
    console.log('🧪 ===========================================');
    console.log('🧪 CALTOPO RAW DATA TEST');
    console.log('🧪 ===========================================');

    // Get credentials
    const credentialId = process.env.CALTOPO_CREDENTIAL_ID;
    const credentialSecret = process.env.CALTOPO_CREDENTIAL_SECRET;
    const mapId = process.env.CALTOPO_AVALANCHE_MAP_ID;

    console.log('🔑 Environment check:');
    console.log('  - CALTOPO_CREDENTIAL_ID:', credentialId ? 'Set' : 'Missing');
    console.log('  - CALTOPO_CREDENTIAL_SECRET:', credentialSecret ? 'Set' : 'Missing');
    console.log('  - CALTOPO_AVALANCHE_MAP_ID:', mapId || 'Missing');

    if (!credentialId || !credentialSecret) {
      return NextResponse.json({ 
        error: 'Missing CalTopo credentials' 
      }, { status: 400 });
    }

    if (!mapId) {
      return NextResponse.json({ 
        error: 'Missing CALTOPO_AVALANCHE_MAP_ID environment variable' 
      }, { status: 400 });
    }

    console.log('📡 Fetching raw map data from CalTopo...');
    console.log('  - Map ID:', mapId);
    console.log('  - Endpoint: /api/v1/map/' + mapId + '/since/0');

    // Fetch the raw map data
    const mapData = await caltopoRequest(
      'GET',
      `/api/v1/map/${mapId}/since/0`,
      credentialId,
      credentialSecret
    );

    console.log('✅ Raw map data received!');
    console.log('📊 Data structure analysis:');
    console.log('  - Type:', typeof mapData);
    console.log('  - Keys:', Object.keys(mapData || {}));
    
    let state: Record<string, unknown> | undefined;
    let groups: Record<string, unknown>[] | undefined;
    let features: Record<string, unknown>[] | undefined;

    if (mapData && typeof mapData === 'object') {
      const mapDataObj = mapData as Record<string, unknown>;
      console.log('📋 Top-level properties:');
      Object.keys(mapDataObj).forEach(key => {
        const value = mapDataObj[key];
        console.log(`  - ${key}:`, {
          type: typeof value,
          isArray: Array.isArray(value),
          length: Array.isArray(value) ? value.length : 'N/A',
          sample: typeof value === 'object' && value !== null ? 
            (Array.isArray(value) ? 
              (value.length > 0 ? value[0] : 'Empty array') : 
              Object.keys(value as Record<string, unknown>).slice(0, 3).reduce((acc, k) => ({ ...acc, [k]: (value as Record<string, unknown>)[k] }), {})
            ) : value
        });
      });

      // Analyze state object if it exists
      state = mapDataObj.state as Record<string, unknown> | undefined;
      if (state) {
        console.log('🗺️ State object analysis:');
        console.log('  - State keys:', Object.keys(state));
        
        groups = state.groups as Record<string, unknown>[] | undefined;
        if (groups) {
          console.log('📁 Groups analysis:');
          console.log('  - Groups count:', groups.length);
          console.log('  - First group:', groups[0]);
          console.log('  - All groups:', groups.map((g: Record<string, unknown>, i: number) => ({
            index: i,
            id: g.id,
            name: g.name,
            parentId: g.parentId,
            type: g.type
          })));
        }

        features = state.features as Record<string, unknown>[] | undefined;
        if (features) {
          console.log('🎯 Features analysis:');
          console.log('  - Features count:', features.length);
          console.log('  - First feature:', features[0]);
          
          // Analyze feature types
          const featureTypes = features.reduce((acc: Record<string, number>, f: Record<string, unknown>) => {
            const type = (f.type as string) || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});
          console.log('  - Feature types:', featureTypes);

          // Analyze feature classes
          const featureClasses = features.reduce((acc: Record<string, number>, f: Record<string, unknown>) => {
            const className = (f.properties as Record<string, unknown>)?.class as string || 'unknown';
            acc[className] = (acc[className] || 0) + 1;
            return acc;
          }, {});
          console.log('  - Feature classes:', featureClasses);

          // Analyze specific feature types we care about
          const polygons = features.filter(f => (f.properties as Record<string, unknown>)?.class === 'Shape' && (f.geometry as Record<string, unknown>)?.type === 'Polygon');
          const photos = features.filter(f => (f.properties as Record<string, unknown>)?.class === 'MapMediaObject');
          const lines = features.filter(f => (f.properties as Record<string, unknown>)?.class === 'Shape' && (f.geometry as Record<string, unknown>)?.type === 'LineString');
          const folders = features.filter(f => (f.properties as Record<string, unknown>)?.class === 'Folder');

          console.log('\n🎯 SPECIFIC FEATURE ANALYSIS:');
          console.log(`  - Polygons: ${polygons.length}`);
          console.log(`  - Photos/Media: ${photos.length}`);
          console.log(`  - Lines: ${lines.length}`);
          console.log(`  - Folders: ${folders.length}`);

          // Show polygon details
          if (polygons.length > 0) {
            console.log('\n🔷 ===========================================');
            console.log('🔷 POLYGON FEATURES:');
            console.log('🔷 ===========================================');
            polygons.forEach((polygon, index) => {
              const props = polygon.properties as Record<string, unknown>;
              const geom = polygon.geometry as Record<string, unknown>;
              console.log(`\n🔷 POLYGON ${index + 1}:`);
              console.log(`🔷   ID: ${polygon.id}`);
              console.log(`🔷   Title: ${props?.title || 'No title'}`);
              console.log(`🔷   Folder ID: ${props?.folderId || 'No folder'}`);
              console.log(`🔷   Description: ${props?.description || 'No description'}`);
              console.log(`🔷   Full Properties:`, JSON.stringify(props, null, 2));
              console.log(`🔷   Full Geometry:`, JSON.stringify(geom, null, 2));
            });
          }

          // Show photo details
          if (photos.length > 0) {
            console.log('\n📸 ===========================================');
            console.log('📸 PHOTO/MEDIA FEATURES:');
            console.log('📸 ===========================================');
            photos.forEach((photo, index) => {
              const props = photo.properties as Record<string, unknown>;
              console.log(`\n📸 PHOTO ${index + 1}:`);
              console.log(`📸   ID: ${photo.id}`);
              console.log(`📸   Title: ${props?.title || 'No title'}`);
              console.log(`📸   Parent ID: ${props?.parentId || 'No parent'}`);
              console.log(`📸   Backend Media ID: ${props?.backendMediaId || 'No media ID'}`);
              console.log(`📸   Description: ${props?.description || 'No description'}`);
              console.log(`📸   Comment: ${props?.comment || 'No comment'}`);
              console.log(`📸   Notes: ${props?.notes || 'No notes'}`);
              console.log(`📸   Full Properties:`, JSON.stringify(props, null, 2));
            });
          }

          // Show ALL features in detail
          console.log('🔍 ALL FEATURES DETAILED:');
          features?.forEach((feature: Record<string, unknown>, index: number) => {
            const geometry = feature.geometry as Record<string, unknown> | undefined;
            const properties = feature.properties as Record<string, unknown> | undefined;
            
            console.log(`\n📋 ===========================================`);
            console.log(`📋 FEATURE ${index + 1} of ${features?.length || 0}`);
            console.log(`📋 ===========================================`);
            console.log(`📋 ID: ${feature.id}`);
            console.log(`📋 Type: ${feature.type}`);
            console.log(`📋 Class: ${properties?.class || 'Unknown'}`);
            console.log(`📋 Title: ${properties?.title || 'No title'}`);
            console.log(`📋 Folder ID: ${properties?.folderId || 'No folder'}`);
            console.log(`📋 Parent ID: ${properties?.parentId || 'No parent'}`);
            
            // Full properties
            console.log(`📋 FULL PROPERTIES:`, JSON.stringify(properties, null, 2));
            
            // Full geometry
            if (geometry) {
              console.log(`📋 GEOMETRY TYPE: ${geometry.type}`);
              console.log(`📋 FULL GEOMETRY:`, JSON.stringify(geometry, null, 2));
              
              if (Array.isArray(geometry.coordinates)) {
                console.log(`📋 COORDINATES COUNT: ${geometry.coordinates.length}`);
                if (geometry.coordinates.length > 0) {
                  console.log(`📋 FIRST COORDINATE:`, geometry.coordinates[0]);
                  console.log(`📋 LAST COORDINATE:`, geometry.coordinates[geometry.coordinates.length - 1]);
                }
              }
            } else {
              console.log(`📋 GEOMETRY: No geometry`);
            }
            
            console.log(`📋 ===========================================`);
          });
        }
      }
    }

    console.log('🧪 ===========================================');
    console.log('🧪 END OF RAW DATA ANALYSIS');
    console.log('🧪 ===========================================');

    return NextResponse.json({
      success: true,
      message: 'Raw data fetched and analyzed successfully',
      data: {
        mapId,
        dataKeys: Object.keys(mapData || {}),
        stateKeys: state ? Object.keys(state) : null,
        groupsCount: groups?.length || 0,
        featuresCount: features?.length || 0,
        sampleData: {
          firstGroup: groups?.[0] || null,
          firstFeature: features?.[0] || null
        }
      }
    });

  } catch (error: unknown) {
    console.error('❌ Raw data test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}

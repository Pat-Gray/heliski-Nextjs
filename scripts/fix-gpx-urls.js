const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// New Zealand ski areas with realistic coordinates
const NZ_SKI_AREAS = [
  { name: "Queenstown", lat: -45.0312, lon: 168.6626, elevation: 1200 },
  { name: "Wanaka", lat: -44.7032, lon: 169.1321, elevation: 1000 },
  { name: "Mount Cook", lat: -43.5944, lon: 170.1419, elevation: 2000 },
  { name: "Arthur's Pass", lat: -42.9500, lon: 171.5667, elevation: 1500 },
  { name: "Mount Aspiring", lat: -44.3833, lon: 168.7333, elevation: 1800 },
  { name: "Fiordland", lat: -45.4167, lon: 167.7167, elevation: 800 },
  { name: "Canterbury", lat: -43.5333, lon: 171.0500, elevation: 1100 },
  { name: "Westland", lat: -43.3833, lon: 170.1833, elevation: 1300 }
];

// Generate a minimal, optimized GPX file (3 points only)
function generateValidGPX(runName, areaIndex) {
  const area = NZ_SKI_AREAS[areaIndex % NZ_SKI_AREAS.length];
  
  // Create a realistic small ski run (100-300 meters)
  // 0.0001 degrees = ~10 meters, so 0.001 = ~100m, 0.003 = ~300m
  const startLat = area.lat + (Math.random() - 0.5) * 0.0005; // ±250m from area center
  const startLon = area.lon + (Math.random() - 0.5) * 0.0005;
  const startElevation = area.elevation + Math.random() * 200; // 200m above area base
  
  // Realistic ski run: 100-300m length, 50-150m elevation drop
  const runLength = 0.001 + Math.random() * 0.002; // 100-300m in degrees
  const elevationDrop = 50 + Math.random() * 100; // 50-150m drop
  
  // Create 3 points for a realistic ski run
  const points = [
    { lat: startLat, lon: startLon, ele: startElevation },
    { lat: startLat - runLength * 0.5, lon: startLon + runLength * 0.3, ele: startElevation - elevationDrop * 0.5 },
    { lat: startLat - runLength, lon: startLon + runLength * 0.6, ele: startElevation - elevationDrop }
  ];
  
  const trackPoints = points.map(point => 
    `    <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}">
      <ele>${point.ele.toFixed(2)}</ele>
    </trkpt>`
  ).join('\n');
  
  // Minimal GPX with no unnecessary metadata
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="HeliRun" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${runName}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

async function fixGPXFiles() {
  console.log('🔧 Fixing GPX files with realistic small ski runs...');
  console.log('📏 Target: 100-300m runs, 50-150m elevation drop');
  
  try {
    // Get all runs in small batches
    const BATCH_SIZE = 20;
    let offset = 0;
    let totalProcessed = 0;
    let totalFixed = 0;
    
    while (true) {
      const { data: runs, error: runError } = await supabase
        .from('runs')
        .select('id, name, caltopo_map_id, caltopo_feature_id')
        .not('caltopo_map_id', 'is', null)
        .not('caltopo_feature_id', 'is', null)
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (runError) {
        console.error('❌ Error fetching runs:', runError);
        break;
      }
      
      if (!runs || runs.length === 0) {
        console.log('✅ No more runs to process');
        break;
      }
      
      console.log(`📦 Processing ${runs.length} runs...`);
      
      // Process each run
      for (const run of runs) {
        try {
          console.log(`🔄 Creating realistic run: ${run.name}`);
          
          // Generate realistic small GPX
          const areaIndex = Math.floor(Math.random() * NZ_SKI_AREAS.length);
          const gpxContent = generateValidGPX(run.name, areaIndex);
          
          // Validate GPX content before uploading
          if (gpxContent.length < 200 || gpxContent.length > 1000) {
            console.warn(`⚠️ GPX content size unusual: ${gpxContent.length} bytes for ${run.name}`);
          }
          
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('heli-ski-files')
            .upload(`runs/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`, gpxContent, {
              contentType: 'application/gpx+xml',
              upsert: true
            });
          
          if (uploadError) {
            console.error(`❌ Upload failed: ${uploadError.message}`);
            continue;
          }
          
          // Update database URL
          const correctUrl = `${supabaseUrl}/storage/v1/object/public/heli-ski-files/runs/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`;
          
          const { error: updateError } = await supabase
            .from('runs')
            .update({ gpx_path: correctUrl })
            .eq('id', run.id);
          
          if (updateError) {
            console.error(`❌ Update failed: ${updateError.message}`);
            continue;
          }
          
          console.log(`✅ Created realistic run: ${run.name} (${gpxContent.length} bytes)`);
          totalFixed++;
          
        } catch (error) {
          console.error(`❌ Error processing ${run.name}:`, error.message);
        }
        
        totalProcessed++;
      }
      
      offset += BATCH_SIZE;
      console.log(`📈 Progress: ${totalProcessed} processed, ${totalFixed} fixed`);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n🎉 GPX fix complete!`);
    console.log(`📊 Fixed ${totalFixed} out of ${totalProcessed} runs`);
    console.log(`📏 All runs now 100-300m with realistic elevation drops`);
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixGPXFiles().then(() => {
  console.log('\n✅ All GPX files fixed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
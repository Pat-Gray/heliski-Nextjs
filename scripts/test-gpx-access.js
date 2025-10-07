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

async function testGPXAccess() {
  console.log('Testing GPX file access...');
  
  try {
    // Get a sample run from the database
    const { data: runs, error: runError } = await supabase
      .from('runs')
      .select('id, name, caltopo_map_id, caltopo_feature_id, gpx_path')
      .not('caltopo_map_id', 'is', null)
      .not('caltopo_feature_id', 'is', null)
      .limit(5);
    
    if (runError) {
      console.error('Error fetching runs:', runError);
      return;
    }
    
    if (!runs || runs.length === 0) {
      console.log('No runs with CalTopo data found. Please run the dummy data script first.');
      return;
    }
    
    console.log(`Found ${runs.length} runs with CalTopo data`);
    
    for (const run of runs) {
      console.log(`\nTesting run: ${run.name}`);
      console.log(`Map ID: ${run.caltopo_map_id}`);
      console.log(`Feature ID: ${run.caltopo_feature_id}`);
      console.log(`GPX Path: ${run.gpx_path}`);
      
      // Test 1: Check if file exists using gpxExists logic
      const { data: listData, error: listError } = await supabase.storage
        .from('heli-ski-files')
        .list(`runs/${run.caltopo_map_id}`, {
          search: `${run.caltopo_feature_id}.gpx`
        });
      
      if (listError) {
        console.error(`❌ List error: ${listError.message}`);
      } else if (!listData || listData.length === 0) {
        console.error(`❌ File not found in storage`);
      } else {
        console.log(`✅ File found in storage: ${listData[0].name}`);
      }
      
      // Test 2: Try to download the file
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('heli-ski-files')
        .download(`runs/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`);
      
      if (downloadError) {
        console.error(`❌ Download error: ${downloadError.message}`);
      } else {
        const content = await downloadData.text();
        console.log(`✅ File downloaded successfully (${content.length} characters)`);
      }
      
      // Test 3: Test public URL access
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/heli-ski-files/runs/${run.caltopo_map_id}/${run.caltopo_feature_id}.gpx`;
      console.log(`Public URL: ${publicUrl}`);
      
      try {
        const response = await fetch(publicUrl);
        if (response.ok) {
          console.log(`✅ Public URL accessible (${response.status})`);
        } else {
          console.error(`❌ Public URL not accessible (${response.status})`);
        }
      } catch (fetchError) {
        console.error(`❌ Public URL fetch error: ${fetchError.message}`);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testGPXAccess().then(() => {
  console.log('\nTest complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});

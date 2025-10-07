import { createClient } from '@supabase/supabase-js';
import { geojsonToGPX } from '../src/lib/geojson-to-gpx';

// Southern Alps region coordinates (approximate bounds)
const SOUTHERN_ALPS_BOUNDS = {
  minLat: -44.5,
  maxLat: -42.0,
  minLon: 168.0,
  maxLon: 172.0
};

// Realistic ski area names in Southern Alps region
const AREAS = [
  { name: "Aoraki/Mount Cook National Park", lat: -43.5944, lon: 170.1419 },
  { name: "Wanaka Region", lat: -44.7032, lon: 169.1321 },
  { name: "Queenstown Region", lat: -45.0312, lon: 168.6626 },
  { name: "Fiordland National Park", lat: -45.4167, lon: 167.7167 },
  { name: "Mount Aspiring National Park", lat: -44.3833, lon: 168.7333 },
  { name: "Arthur's Pass National Park", lat: -42.9500, lon: 171.5667 },
  { name: "Westland Tai Poutini National Park", lat: -43.3833, lon: 170.1833 },
  { name: "Canterbury High Country", lat: -43.5333, lon: 171.0500 }
];

const SUBAREA_NAMES = [
  "North Face", "South Face", "East Ridge", "West Ridge", "Central Bowl",
  "Upper Slopes", "Lower Slopes", "Backcountry", "Glacier", "Valley",
  "Peak", "Saddle", "Ridge", "Chute", "Couloir", "Gully", "Face",
  "Headwall", "Cirque", "Avalanche Path", "Tree Line", "Alpine Zone"
];

const RUN_NAMES = [
  "Powder Paradise", "Steep & Deep", "Avalanche Alley", "Glacier Run", "Tree Line",
  "Backcountry Bliss", "Peak Performance", "Ridge Rider", "Valley View", "Mountain Majesty",
  "Snowy Slopes", "Alpine Adventure", "Powder Puff", "Steep Descent", "Mountain Magic",
  "Snowy Summit", "Alpine Arrow", "Powder Path", "Steep Slope", "Mountain Mist",
  "Snowy Serpent", "Alpine Ace", "Powder Peak", "Steep Storm", "Mountain Master",
  "Snowy Star", "Alpine Angel", "Powder Prince", "Steep Spirit", "Mountain Monarch"
];

const ASPECTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const STATUSES = ["open", "conditional", "closed"];
const STATUS_COMMENTS = [
  "Excellent conditions", "Good snow coverage", "Some exposed rocks", "Avalanche risk moderate",
  "Recent snowfall", "Wind affected", "Icy patches", "Powder conditions", "Spring conditions",
  "Firm snow", "Variable conditions", "Excellent visibility", "Poor visibility", "High avalanche risk"
];

const RUN_DESCRIPTIONS = [
  "A challenging run with steep terrain and excellent powder conditions.",
  "Moderate difficulty with beautiful views and consistent snow coverage.",
  "Advanced terrain with potential avalanche risk - check conditions before skiing.",
  "Beginner-friendly run with gentle slopes and good visibility.",
  "Expert-only terrain with extreme steepness and technical challenges.",
  "Backcountry run requiring proper safety equipment and avalanche training.",
  "Glacier run with stunning alpine scenery and variable snow conditions.",
  "Tree skiing with tight turns and excellent snow quality.",
  "Open bowl with consistent fall line and excellent powder retention.",
  "Ridge run with exposure and technical terrain features."
];

const RUN_NOTES = [
  "Best skied after fresh snowfall", "Avoid during high winds", "Check avalanche bulletin",
  "Excellent for powder skiing", "Watch for rocks in early season", "Great for intermediate skiers",
  "Expert terrain only", "Requires avalanche safety gear", "Best conditions in morning",
  "Variable snow quality", "Excellent visibility", "Watch for crevasses", "Steep and technical"
];

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate random coordinates within Southern Alps bounds
function generateRandomCoordinates() {
  const lat = SOUTHERN_ALPS_BOUNDS.minLat + 
    Math.random() * (SOUTHERN_ALPS_BOUNDS.maxLat - SOUTHERN_ALPS_BOUNDS.minLat);
  const lon = SOUTHERN_ALPS_BOUNDS.minLon + 
    Math.random() * (SOUTHERN_ALPS_BOUNDS.maxLon - SOUTHERN_ALPS_BOUNDS.minLon);
  return { lat, lon };
}

// Generate realistic elevation based on Southern Alps terrain
function generateElevation() {
  // Southern Alps elevations range from ~500m to ~3700m
  const minElevation = 500 + Math.random() * 1000; // 500-1500m
  const elevationRange = 200 + Math.random() * 800; // 200-1000m range
  const maxElevation = minElevation + elevationRange;
  
  return {
    min: Math.round(minElevation),
    max: Math.round(maxElevation)
  };
}

// Generate realistic GPX track for a ski run
function generateGPXTrack(runName: string, elevation: { min: number; max: number }) {
  const startPoint = generateRandomCoordinates();
  const endPoint = generateRandomCoordinates();
  
  // Create a realistic ski run path with elevation changes
  const numPoints = 20 + Math.floor(Math.random() * 30); // 20-50 points
  const coordinates: number[][] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress + 
      (Math.random() - 0.5) * 0.01; // Add some randomness
    const lon = startPoint.lon + (endPoint.lon - startPoint.lon) * progress + 
      (Math.random() - 0.5) * 0.01; // Add some randomness
    
    // Elevation decreases as we go down the mountain
    const ele = elevation.max - (elevation.max - elevation.min) * progress + 
      (Math.random() - 0.5) * 50; // Add some randomness
    
    coordinates.push([lon, lat, ele]);
  }
  
  const geojsonFeature = {
    type: "Feature" as const,
    properties: {
      name: runName,
      description: "Generated ski run track"
    },
    geometry: {
      type: "LineString" as const,
      coordinates
    }
  };
  
  return geojsonToGPX(geojsonFeature, {
    name: runName,
    description: "Generated ski run track for testing",
    author: "HeliRun Data Generator",
    time: new Date()
  });
}

// Generate random run data
function generateRunData(areaId: string, subAreaId: string, runNumber: number) {
  const elevation = generateElevation();
  const runName = RUN_NAMES[Math.floor(Math.random() * RUN_NAMES.length)];
  const aspect = ASPECTS[Math.floor(Math.random() * ASPECTS.length)];
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  
  const runDescription = RUN_DESCRIPTIONS[Math.floor(Math.random() * RUN_DESCRIPTIONS.length)];
  const runNotes = RUN_NOTES[Math.floor(Math.random() * RUN_NOTES.length)];
  const statusComment = Math.random() > 0.3 ? STATUS_COMMENTS[Math.floor(Math.random() * STATUS_COMMENTS.length)] : null;
  
  // Generate GPX content
  const gpxContent = generateGPXTrack(runName, elevation);
  
  // Generate CalTopo integration data
  const caltopoMapId = `map_${Math.random().toString(36).substr(2, 9)}`;
  const caltopoFeatureId = `feature_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    name: runName,
    subAreaId,
    runNumber,
    runDescription,
    runNotes,
    aspect,
    elevationMax: elevation.max,
    elevationMin: elevation.min,
    status,
    statusComment,
    gpxPath: `runs/${caltopoMapId}/${caltopoFeatureId}.gpx`,
    runPhoto: Math.random() > 0.7 ? `photos/run_${Math.random().toString(36).substr(2, 9)}.jpg` : null,
    avalanchePhoto: Math.random() > 0.8 ? `photos/avalanche_${Math.random().toString(36).substr(2, 9)}.jpg` : null,
    additionalPhotos: Math.random() > 0.6 ? 
      Array.from({ length: Math.floor(Math.random() * 3) }, () => 
        `photos/additional_${Math.random().toString(36).substr(2, 9)}.jpg`
      ) : [],
    caltopoMapId,
    caltopoFeatureId,
    gpxUpdatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
    gpxContent
  };
}

// Upload GPX content to Supabase Storage
async function uploadGPXContent(mapId: string, featureId: string, gpxContent: string) {
  const path = `runs/${mapId}/${featureId}.gpx`;
  
  const { error } = await supabase.storage
    .from('heli-ski-files')
    .upload(path, gpxContent, {
      contentType: 'application/gpx+xml',
      upsert: true
    });
  
  if (error) {
    console.error(`Failed to upload GPX for ${mapId}/${featureId}:`, error);
    return false;
  }
  
  return true;
}

// Main function to generate and insert data
async function generateDummyData() {
  console.log('Starting dummy data generation...');
  
  try {
    // 1. Create areas
    console.log('Creating areas...');
    const createdAreas = [];
    for (const area of AREAS) {
      const { data, error } = await supabase
        .from('areas')
        .insert({ name: area.name })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating area:', error);
        continue;
      }
      
      createdAreas.push(data);
      console.log(`Created area: ${area.name}`);
    }
    
    // 2. Create subareas for each area
    console.log('Creating subareas...');
    const createdSubAreas = [];
    for (const area of createdAreas) {
      const numSubAreas = 3 + Math.floor(Math.random() * 4); // 3-6 subareas per area
      
      for (let i = 0; i < numSubAreas; i++) {
        const subAreaName = SUBAREA_NAMES[Math.floor(Math.random() * SUBAREA_NAMES.length)];
        const { data, error } = await supabase
          .from('sub_areas')
          .insert({ 
            name: `${subAreaName} - ${area.name}`,
            area_id: area.id 
          })
          .select()
          .single();
        
        if (error) {
          console.error('Error creating subarea:', error);
          continue;
        }
        
        createdSubAreas.push(data);
        console.log(`Created subarea: ${subAreaName} - ${area.name}`);
      }
    }
    
    // 3. Generate and insert runs
    console.log('Creating runs...');
    const totalRuns = 1000;
    const runsPerSubArea = Math.ceil(totalRuns / createdSubAreas.length);
    
    let runCount = 0;
    for (const subArea of createdSubAreas) {
      const runsForThisSubArea = Math.min(runsPerSubArea, totalRuns - runCount);
      
      for (let i = 0; i < runsForThisSubArea; i++) {
        const runNumber = i + 1;
        const runData = generateRunData(subArea.area_id, subArea.id, runNumber);
        
        // Insert run into database
        const { data: run, error: runError } = await supabase
          .from('runs')
          .insert({
            name: runData.name,
            sub_area_id: runData.subAreaId,
            run_number: runData.runNumber,
            run_description: runData.runDescription,
            run_notes: runData.runNotes,
            aspect: runData.aspect,
            elevation_max: runData.elevationMax,
            elevation_min: runData.elevationMin,
            status: runData.status,
            status_comment: runData.statusComment,
            gpx_path: runData.gpxPath,
            run_photo: runData.runPhoto,
            avalanche_photo: runData.avalanchePhoto,
            additional_photos: runData.additionalPhotos,
            caltopo_map_id: runData.caltopoMapId,
            caltopo_feature_id: runData.caltopoFeatureId,
            gpx_updated_at: runData.gpxUpdatedAt,
            last_updated: new Date(),
            created_at: new Date()
          })
          .select()
          .single();
        
        if (runError) {
          console.error('Error creating run:', runError);
          continue;
        }
        
        // Upload GPX content to storage
        const uploadSuccess = await uploadGPXContent(
          runData.caltopoMapId, 
          runData.caltopoFeatureId, 
          runData.gpxContent
        );
        
        if (uploadSuccess) {
          console.log(`Created run ${runCount + 1}/${totalRuns}: ${runData.name} in ${subArea.name}`);
        }
        
        runCount++;
        
        // Add small delay to avoid overwhelming the database
        if (runCount % 50 === 0) {
          console.log(`Progress: ${runCount}/${totalRuns} runs created`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    console.log(`\n✅ Successfully generated ${runCount} runs across ${createdAreas.length} areas and ${createdSubAreas.length} subareas!`);
    console.log('Data includes:');
    console.log('- Realistic Southern Alps coordinates');
    console.log('- Complete run data with descriptions and notes');
    console.log('- GPX tracks uploaded to Supabase Storage');
    console.log('- CalTopo integration fields');
    console.log('- Random photos and status comments');
    
  } catch (error) {
    console.error('Error generating dummy data:', error);
  }
}

// Run the script
if (require.main === module) {
  generateDummyData().then(() => {
    console.log('Dummy data generation complete!');
    process.exit(0);
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { generateDummyData };

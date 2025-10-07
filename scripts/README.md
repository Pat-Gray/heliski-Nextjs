# Dummy Data Generation Scripts

This directory contains scripts to generate realistic dummy data for testing the HeliRun application with 1000 runs in the Southern Alps region.

## Prerequisites

1. Make sure you have your Supabase environment variables set up in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Ensure the Supabase storage bucket `heli-ski-files` exists and is configured properly.

## Running the Script

### Option 1: Using npm script (Recommended)
```bash
npm run db:generate-dummy
```

### Option 2: Direct execution
```bash
node scripts/run-dummy-data.js
```

## What the Script Generates

The script will create:

### Areas (8 total)
- Aoraki/Mount Cook National Park
- Wanaka Region
- Queenstown Region
- Fiordland National Park
- Mount Aspiring National Park
- Arthur's Pass National Park
- Westland Tai Poutini National Park
- Canterbury High Country

### Subareas (3-6 per area)
- Realistic subarea names like "North Face", "South Face", "East Ridge", etc.
- Each subarea is associated with one of the main areas

### Runs (1000 total)
- **Names**: Realistic ski run names like "Powder Paradise", "Steep & Deep", etc.
- **Locations**: Coordinates within the Southern Alps region (-44.5° to -42.0° latitude, 168.0° to 172.0° longitude)
- **Elevations**: Realistic elevation ranges (500m to 3700m) based on Southern Alps terrain
- **Aspects**: All 8 compass directions (N, NE, E, SE, S, SW, W, NW)
- **Status**: Random distribution of "open", "conditional", "closed"
- **Descriptions & Notes**: Realistic ski run descriptions and safety notes
- **GPX Tracks**: Generated GPX files with realistic ski run paths uploaded to Supabase Storage
- **Photos**: Random assignment of run photos, avalanche photos, and additional photos
- **CalTopo Integration**: Mock CalTopo map and feature IDs
- **Timestamps**: Realistic creation and update dates

## Data Distribution

- **Areas**: 8 areas across the Southern Alps
- **Subareas**: 3-6 subareas per area (total ~40 subareas)
- **Runs**: ~25 runs per subarea (total 1000 runs)
- **GPX Files**: All runs have associated GPX tracks stored in Supabase Storage
- **Photos**: ~30% of runs have run photos, ~20% have avalanche photos, ~40% have additional photos

## Performance Testing

This data set is designed to test:
- Dashboard performance with large datasets
- Map rendering with many GPX tracks
- Database query performance
- Storage bucket performance
- UI responsiveness with 1000+ runs

## Cleanup

To remove all generated data, you can:
1. Delete all records from the `runs` table
2. Delete all records from the `sub_areas` table  
3. Delete all records from the `areas` table
4. Clear the `heli-ski-files` storage bucket

Or run the cleanup migration:
```sql
-- This will remove all data
DELETE FROM runs;
DELETE FROM sub_areas;
DELETE FROM areas;
```

## Notes

- The script includes progress indicators and error handling
- GPX files are generated with realistic ski run paths
- All data is geographically accurate to the Southern Alps region
- The script respects database constraints and foreign key relationships
- Generated data includes all required fields for the application to function properly

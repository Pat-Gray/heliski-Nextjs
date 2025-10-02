-- Remove redundant GPX fields from runs table
-- These fields are no longer needed since we simplified the GPX storage approach

-- Drop the redundant columns
ALTER TABLE runs DROP COLUMN IF EXISTS gpx_storage_path;
ALTER TABLE runs DROP COLUMN IF EXISTS gpx_checksum;
ALTER TABLE runs DROP COLUMN IF EXISTS gpx_source;

-- Drop related indexes
DROP INDEX IF EXISTS idx_runs_gpx_storage_path;

-- Drop the check constraint for gpx_source
ALTER TABLE runs DROP CONSTRAINT IF EXISTS check_gpx_source;

-- Note: gpx_path, caltopo_map_id, caltopo_feature_id, and gpx_updated_at are kept
-- as they are essential for the CalTopo integration functionality

-- Add CalTopo integration fields to runs table
ALTER TABLE runs 
ADD COLUMN caltopo_map_id VARCHAR,
ADD COLUMN caltopo_feature_id VARCHAR,
ADD COLUMN gpx_storage_path TEXT,
ADD COLUMN gpx_updated_at TIMESTAMP,
ADD COLUMN gpx_checksum TEXT,
ADD COLUMN gpx_source TEXT DEFAULT 'caltopo';

-- Add indexes for better performance
CREATE INDEX idx_runs_caltopo_map_id ON runs(caltopo_map_id);
CREATE INDEX idx_runs_caltopo_feature_id ON runs(caltopo_feature_id);
CREATE INDEX idx_runs_gpx_storage_path ON runs(gpx_storage_path);

-- Add check constraint for gpx_source
ALTER TABLE runs 
ADD CONSTRAINT check_gpx_source 
CHECK (gpx_source IN ('caltopo', 'manual'));

-- Add GPX metadata columns to runs table for performance optimization
-- This migration adds metadata that can be pre-computed to avoid parsing GPX files repeatedly

-- Add GPX metadata columns
ALTER TABLE runs ADD COLUMN IF NOT EXISTS gpx_metadata JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS gpx_bounds JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS gpx_point_count INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS gpx_updated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient filtering and querying
CREATE INDEX IF NOT EXISTS idx_runs_gpx_metadata ON runs USING GIN (gpx_metadata);
CREATE INDEX IF NOT EXISTS idx_runs_gpx_bounds ON runs USING GIN (gpx_bounds);
CREATE INDEX IF NOT EXISTS idx_runs_gpx_point_count ON runs (gpx_point_count);
CREATE INDEX IF NOT EXISTS idx_runs_gpx_updated_at ON runs (gpx_updated_at);

-- Add comments for documentation
COMMENT ON COLUMN runs.gpx_metadata IS 'Pre-computed GPX metadata including track count, total distance, elevation stats';
COMMENT ON COLUMN runs.gpx_bounds IS 'Pre-computed bounding box of GPX data for viewport filtering';
COMMENT ON COLUMN runs.gpx_point_count IS 'Total number of track points in GPX data for performance estimation';
COMMENT ON COLUMN runs.gpx_updated_at IS 'Timestamp when GPX metadata was last computed';

-- Create a function to update GPX metadata
CREATE OR REPLACE FUNCTION update_gpx_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be called by the application when GPX data is processed
  -- The actual metadata computation happens in the application layer
  NEW.gpx_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update timestamp when metadata changes
CREATE TRIGGER trigger_update_gpx_metadata
  BEFORE UPDATE OF gpx_metadata, gpx_bounds, gpx_point_count ON runs
  FOR EACH ROW
  EXECUTE FUNCTION update_gpx_metadata();

-- Enhanced Marker Support Migration
-- This migration adds marker-specific fields and indexes for better marker handling

-- Add marker-specific fields to caltopo_features table
ALTER TABLE caltopo_features 
ADD COLUMN IF NOT EXISTS marker_symbol TEXT,
ADD COLUMN IF NOT EXISTS marker_color TEXT,
ADD COLUMN IF NOT EXISTS marker_size TEXT,
ADD COLUMN IF NOT EXISTS marker_rotation NUMERIC,
ADD COLUMN IF NOT EXISTS heading NUMERIC,
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS label_visible BOOLEAN DEFAULT true;

-- Add indexes for better marker querying
CREATE INDEX IF NOT EXISTS idx_caltopo_features_markers 
ON caltopo_features (map_id, class) 
WHERE class = 'Marker';

CREATE INDEX IF NOT EXISTS idx_caltopo_features_points 
ON caltopo_features (map_id, geometry_type) 
WHERE geometry_type = 'Point';

CREATE INDEX IF NOT EXISTS idx_caltopo_features_marker_symbol 
ON caltopo_features (marker_symbol) 
WHERE marker_symbol IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caltopo_features_marker_color 
ON caltopo_features (marker_color) 
WHERE marker_color IS NOT NULL;

-- Add marker-specific statistics to caltopo_maps table
ALTER TABLE caltopo_maps 
ADD COLUMN IF NOT EXISTS total_markers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Update the sync logs to track marker statistics
ALTER TABLE caltopo_sync_logs 
ADD COLUMN IF NOT EXISTS markers_synced INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_synced INTEGER DEFAULT 0;

-- Create a view for easy marker querying
CREATE OR REPLACE VIEW caltopo_markers_view AS
SELECT 
  cf.id,
  cf.map_id,
  cf.feature_id,
  cf.title,
  cf.marker_symbol,
  cf.marker_color,
  cf.marker_size,
  cf.marker_rotation,
  cf.heading,
  cf.icon,
  cf.label,
  cf.label_visible,
  cf.coordinates,
  cf.properties,
  cf.visible,
  cf.creator,
  cf.created_at,
  cf.updated_at,
  cf.caltopo_created_at,
  cf.caltopo_updated_at,
  cf.folder_id,
  cf.parent_id,
  cf.class,
  cf.geometry_type
FROM caltopo_features cf
WHERE cf.class = 'Marker' OR (cf.class = 'Shape' AND cf.geometry_type = 'Point');

-- Create a view for easy point querying
CREATE OR REPLACE VIEW caltopo_points_view AS
SELECT 
  cf.id,
  cf.map_id,
  cf.feature_id,
  cf.title,
  cf.marker_symbol,
  cf.marker_color,
  cf.marker_size,
  cf.marker_rotation,
  cf.heading,
  cf.icon,
  cf.label,
  cf.label_visible,
  cf.coordinates,
  cf.properties,
  cf.visible,
  cf.creator,
  cf.created_at,
  cf.updated_at,
  cf.caltopo_created_at,
  cf.caltopo_updated_at,
  cf.folder_id,
  cf.parent_id,
  cf.class,
  cf.geometry_type
FROM caltopo_features cf
WHERE cf.geometry_type = 'Point';

-- Add RLS policies for the new views
ALTER VIEW caltopo_markers_view SET (security_invoker = true);
ALTER VIEW caltopo_points_view SET (security_invoker = true);

-- Grant permissions
GRANT SELECT ON caltopo_markers_view TO authenticated;
GRANT SELECT ON caltopo_points_view TO authenticated;

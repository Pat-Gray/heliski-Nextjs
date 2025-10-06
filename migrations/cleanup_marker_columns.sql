-- Cleanup Marker Columns Migration
-- This migration removes marker-specific columns and their dependencies

-- First, drop the dependent views
DROP VIEW IF EXISTS caltopo_markers_view;
DROP VIEW IF EXISTS caltopo_points_view;

-- Drop marker-specific indexes
DROP INDEX IF EXISTS idx_caltopo_features_markers;
DROP INDEX IF EXISTS idx_caltopo_features_points;
DROP INDEX IF EXISTS idx_caltopo_features_marker_symbol;
DROP INDEX IF EXISTS idx_caltopo_features_marker_color;

-- Now drop the marker-specific columns from caltopo_features
ALTER TABLE caltopo_features 
DROP COLUMN IF EXISTS marker_symbol,
DROP COLUMN IF EXISTS marker_color,
DROP COLUMN IF EXISTS marker_size,
DROP COLUMN IF EXISTS marker_rotation,
DROP COLUMN IF EXISTS heading,
DROP COLUMN IF EXISTS icon,
DROP COLUMN IF EXISTS label,
DROP COLUMN IF EXISTS label_visible;

-- Drop marker statistics from caltopo_maps
ALTER TABLE caltopo_maps 
DROP COLUMN IF EXISTS total_markers,
DROP COLUMN IF EXISTS total_points;

-- Drop marker statistics from caltopo_sync_logs
ALTER TABLE caltopo_sync_logs 
DROP COLUMN IF EXISTS markers_synced,
DROP COLUMN IF EXISTS points_synced;

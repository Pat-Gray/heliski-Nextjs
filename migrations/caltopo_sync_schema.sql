-- CalTopo Sync Schema Migration
-- This migration creates tables for storing CalTopo data locally

-- Create caltopo_maps table
CREATE TABLE IF NOT EXISTS caltopo_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed'))
);

-- Create caltopo_folders table
CREATE TABLE IF NOT EXISTS caltopo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES caltopo_maps(map_id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL,
  name TEXT,
  parent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(map_id, folder_id)
);

-- Create caltopo_features table
CREATE TABLE IF NOT EXISTS caltopo_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES caltopo_maps(map_id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  folder_id TEXT,
  parent_id TEXT,
  title TEXT,
  class TEXT,
  geometry_type TEXT,
  coordinates JSONB,
  properties JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(map_id, feature_id)
);

-- Create caltopo_images table
CREATE TABLE IF NOT EXISTS caltopo_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES caltopo_maps(map_id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  feature_id TEXT,
  parent_id TEXT,
  title TEXT,
  backend_media_id TEXT,
  description TEXT,
  comment TEXT,
  notes TEXT,
  details TEXT,
  marker_color TEXT,
  marker_size TEXT,
  marker_symbol TEXT,
  creator TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(map_id, image_id)
);

-- Create caltopo_sync_logs table
CREATE TABLE IF NOT EXISTS caltopo_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'syncing', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  features_synced INTEGER DEFAULT 0,
  images_synced INTEGER DEFAULT 0,
  folders_synced INTEGER DEFAULT 0,
  errors TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_caltopo_maps_map_id ON caltopo_maps(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_folders_map_id ON caltopo_folders(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_folders_folder_id ON caltopo_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_map_id ON caltopo_features(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_feature_id ON caltopo_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_folder_id ON caltopo_features(folder_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_map_id ON caltopo_images(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_image_id ON caltopo_images(image_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_feature_id ON caltopo_images(feature_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_sync_logs_map_id ON caltopo_sync_logs(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_sync_logs_status ON caltopo_sync_logs(status);

-- Enable Row Level Security (RLS)
ALTER TABLE caltopo_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE caltopo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE caltopo_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE caltopo_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE caltopo_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on caltopo_maps" ON caltopo_maps FOR ALL USING (true);
CREATE POLICY "Allow all operations on caltopo_folders" ON caltopo_folders FOR ALL USING (true);
CREATE POLICY "Allow all operations on caltopo_features" ON caltopo_features FOR ALL USING (true);
CREATE POLICY "Allow all operations on caltopo_images" ON caltopo_images FOR ALL USING (true);
CREATE POLICY "Allow all operations on caltopo_sync_logs" ON caltopo_sync_logs FOR ALL USING (true);

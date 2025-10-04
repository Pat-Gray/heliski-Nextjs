-- CalTopo Optimized Schema Migration
-- This migration creates tables optimized for CalTopo data sync and management

-- Create caltopo_maps table
CREATE TABLE IF NOT EXISTS caltopo_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  total_features INTEGER DEFAULT 0,
  total_images INTEGER DEFAULT 0,
  total_folders INTEGER DEFAULT 0
);

-- Create caltopo_folders table
CREATE TABLE IF NOT EXISTS caltopo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES caltopo_maps(map_id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  visible BOOLEAN DEFAULT true,
  label_visible BOOLEAN DEFAULT true,
  creator TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  caltopo_created_at TIMESTAMP WITH TIME ZONE,
  caltopo_updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(map_id, folder_id)
);

-- Create caltopo_features table (shapes, markers, etc.)
CREATE TABLE IF NOT EXISTS caltopo_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES caltopo_maps(map_id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  folder_id TEXT,
  parent_id TEXT,
  title TEXT,
  class TEXT NOT NULL, -- 'Shape', 'Marker', 'Folder', 'MapMediaObject'
  geometry_type TEXT, -- 'Polygon', 'LineString', 'Point'
  coordinates JSONB, -- Full coordinate data
  properties JSONB, -- All CalTopo properties
  visible BOOLEAN DEFAULT true,
  creator TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  caltopo_created_at TIMESTAMP WITH TIME ZONE,
  caltopo_updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(map_id, feature_id)
);

-- Create caltopo_images table (MapMediaObject features)
CREATE TABLE IF NOT EXISTS caltopo_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES caltopo_maps(map_id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  feature_id TEXT, -- The shape/feature this image is attached to
  parent_id TEXT, -- CalTopo parentId (e.g., "Shape:feature-id")
  title TEXT,
  backend_media_id TEXT NOT NULL, -- For downloading from CalTopo
  description TEXT,
  comment TEXT,
  notes TEXT,
  details TEXT,
  marker_color TEXT,
  marker_size TEXT,
  marker_symbol TEXT,
  heading REAL, -- Camera heading if available
  creator TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  caltopo_created_at TIMESTAMP WITH TIME ZONE,
  caltopo_updated_at TIMESTAMP WITH TIME ZONE,
  -- Local storage info
  local_file_path TEXT, -- Path in Supabase storage
  local_file_url TEXT, -- Public URL of downloaded image
  file_size_bytes BIGINT,
  content_type TEXT,
  download_status TEXT DEFAULT 'pending' CHECK (download_status IN ('pending', 'downloading', 'completed', 'failed')),
  UNIQUE(map_id, image_id)
);

-- Create caltopo_sync_logs table
CREATE TABLE IF NOT EXISTS caltopo_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL,
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'images_only'
  status TEXT NOT NULL CHECK (status IN ('pending', 'syncing', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  -- Counts
  features_synced INTEGER DEFAULT 0,
  images_synced INTEGER DEFAULT 0,
  folders_synced INTEGER DEFAULT 0,
  images_downloaded INTEGER DEFAULT 0,
  -- Error tracking
  errors TEXT[],
  warnings TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_caltopo_maps_map_id ON caltopo_maps(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_maps_sync_status ON caltopo_maps(sync_status);

CREATE INDEX IF NOT EXISTS idx_caltopo_folders_map_id ON caltopo_folders(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_folders_folder_id ON caltopo_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_folders_parent_id ON caltopo_folders(parent_id);

CREATE INDEX IF NOT EXISTS idx_caltopo_features_map_id ON caltopo_features(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_feature_id ON caltopo_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_folder_id ON caltopo_features(folder_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_class ON caltopo_features(class);
CREATE INDEX IF NOT EXISTS idx_caltopo_features_geometry_type ON caltopo_features(geometry_type);

CREATE INDEX IF NOT EXISTS idx_caltopo_images_map_id ON caltopo_images(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_image_id ON caltopo_images(image_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_feature_id ON caltopo_images(feature_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_parent_id ON caltopo_images(parent_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_backend_media_id ON caltopo_images(backend_media_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_images_download_status ON caltopo_images(download_status);

CREATE INDEX IF NOT EXISTS idx_caltopo_sync_logs_map_id ON caltopo_sync_logs(map_id);
CREATE INDEX IF NOT EXISTS idx_caltopo_sync_logs_status ON caltopo_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_caltopo_sync_logs_started_at ON caltopo_sync_logs(started_at);

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

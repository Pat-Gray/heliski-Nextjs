import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Service role client for server-side operations
const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-service-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Public client for client-side operations
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const BUCKET_NAME = 'gpx';

export interface GPXFile {
  path: string;
  content: string;
  checksum: string;
  updatedAt: Date;
}

/**
 * Upload GPX content to Supabase Storage
 */
export async function uploadGPX(
  mapId: string, 
  featureId: string, 
  gpxContent: string
): Promise<{ path: string; checksum: string }> {
  const path = `gpx/${mapId}/${featureId}.gpx`;
  
  // Calculate SHA-256 checksum
  const encoder = new TextEncoder();
  const data = encoder.encode(gpxContent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, gpxContent, {
      contentType: 'application/gpx+xml',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload GPX: ${error.message}`);
  }

  return { path, checksum };
}

/**
 * Get GPX content from Supabase Storage
 */
export async function getGPX(mapId: string, featureId: string): Promise<GPXFile | null> {
  const path = `gpx/${mapId}/${featureId}.gpx`;
  
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error || !data) {
    return null;
  }

  const content = await data.text();
  
  // Calculate checksum
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Get file metadata
  const { data: fileData } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(`gpx/${mapId}`, {
      search: `${featureId}.gpx`
    });

  const updatedAt = fileData?.[0]?.updated_at 
    ? new Date(fileData[0].updated_at)
    : new Date();

  return {
    path,
    content,
    checksum,
    updatedAt
  };
}

/**
 * Generate signed URL for client-side access
 */
export async function getSignedGPXUrl(
  mapId: string, 
  featureId: string, 
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const path = `gpx/${mapId}/${featureId}.gpx`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Check if GPX file exists
 */
export async function gpxExists(mapId: string, featureId: string): Promise<boolean> {

  
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(`gpx/${mapId}`, {
      search: `${featureId}.gpx`
    });

  return !error && data && data.length > 0;
}

/**
 * Delete GPX file
 */
export async function deleteGPX(mapId: string, featureId: string): Promise<void> {
  const path = `gpx/${mapId}/${featureId}.gpx`;
  
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete GPX: ${error.message}`);
  }
}

/**
 * List all GPX files for a map
 */
export async function listMapGPXFiles(mapId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(`gpx/${mapId}`);

  if (error || !data) {
    return [];
  }

  return data
    .filter(file => file.name.endsWith('.gpx'))
    .map(file => file.name.replace('.gpx', ''));
}

/**
 * Initialize storage bucket (run once)
 */
export async function initializeStorageBucket(): Promise<void> {
  // Check if bucket exists
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
  
  if (!bucketExists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: false, // Private bucket
      fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
      allowedMimeTypes: ['application/gpx+xml', 'text/xml', 'application/xml']
    });

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }
  }
}

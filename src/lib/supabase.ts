import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:', {
    supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
    supabaseAnonKey: supabaseAnonKey ? 'Set' : 'Missing'
  });
  throw new Error('Missing required Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// File upload helper
export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file);

  return { data, error };
}

// File download helper
export async function getFileUrl(
  bucket: string,
  path: string
): Promise<string> {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

// File delete helper
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  return { data, error };
}

// Generate unique file path
export function generateFilePath(
  type: 'gpx' | 'image',
  runId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  return `runs/${runId}/${type}/${timestamp}.${extension}`;
}

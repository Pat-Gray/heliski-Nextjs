import { supabase } from './supabase';

export interface FileUploadResult {
  filename: string;
  url: string;
  path: string;
  fileSize: number;
  contentType: string;
  status: 'success' | 'error';
  error?: string;
  timestamp: string;
}

export async function uploadFile(
  bucket: string,
  filePath: string,
  file: File,
  fileType: 'gpx' | 'image'
): Promise<FileUploadResult> {
  try {
    // Validate file type
    const allowedGpxTypes = ['application/gpx+xml', 'application/xml', 'text/xml'];
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // For GPX files, also check file extension as browsers often don't set correct MIME type
    if (fileType === 'gpx') {
      const isGpxByExtension = file.name.toLowerCase().endsWith('.gpx');
      const isGpxByMimeType = allowedGpxTypes.includes(file.type);
      
      console.log('GPX file validation:', {
        fileName: file.name,
        fileType: file.type,
        isGpxByExtension,
        isGpxByMimeType,
        allowedTypes: allowedGpxTypes
      });
      
      if (!isGpxByMimeType && !isGpxByExtension) {
        throw new Error(`Invalid GPX file type: ${file.type || 'unknown'}. File must have .gpx extension or correct MIME type. Allowed MIME types: ${allowedGpxTypes.join(', ')}`);
      }
    }
    
    if (fileType === 'image' && !allowedImageTypes.includes(file.type)) {
      throw new Error(`Invalid image file type: ${file.type}. Allowed types: ${allowedImageTypes.join(', ')}`);
    }

    // Validate file size (e.g., 10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      filename: file.name,
      url: urlData.publicUrl,
      path: filePath,
      fileSize: file.size,
      contentType: file.type,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error('File upload utility error:', error);
    return {
      filename: file.name,
      url: '',
      path: '',
      fileSize: file.size,
      contentType: file.type,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function deleteFile(bucket: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
    return { success: true };
  } catch (error: unknown) {
    console.error('File delete utility error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export function generateSupabaseFilePath(
  runId: string,
  fileType: 'gpx' | 'image',
  filename: string,
  fieldName: string // e.g., 'gpxPath', 'runPhoto', 'avalanchePhoto', 'additionalPhotos'
): string {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  let folder = '';

  if (fileType === 'gpx') {
    folder = 'gpx';
  } else if (fileType === 'image') {
    if (fieldName === 'runPhoto') {
      folder = 'images/run_photos';
    } else if (fieldName === 'avalanchePhoto') {
      folder = 'images/avalanche_photos';
    } else if (fieldName === 'additionalPhotos') {
      folder = 'images/additional_photos';
    } else {
      folder = 'images/misc';
    }
  }

  return `runs/${runId}/${folder}/${timestamp}.${extension}`;
}

"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, Image, MapPin } from "lucide-react";
import { useToast } from "@/contexts/hooks/use-toast";
import { generateSupabaseFilePath, uploadFile } from "@/lib/file-upload";

interface FileUploadProps {
  runId: string;
  fileType: 'gpx' | 'image';
  fieldName: 'gpxPath' | 'runPhoto' | 'avalanchePhoto' | 'additionalPhotos';
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
}

export default function FileUpload({
  runId,
  fileType,
  fieldName,
  onUploadComplete,
  onUploadError,
  accept,
  maxSize = 10,
  className = ""
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Basic client-side validation (server-side validation is more comprehensive)
    if (fileType === 'gpx' && !file.name.toLowerCase().endsWith('.gpx')) {
      const error = 'Please select a GPX file (.gpx extension required)';
      onUploadError?.(error);
      toast({ title: "Invalid file type", description: error, variant: "destructive" });
      return;
    }

    if (fileType === 'image' && !file.type.startsWith('image/')) {
      const error = 'Please select an image file';
      onUploadError?.(error);
      toast({ title: "Invalid file type", description: error, variant: "destructive" });
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const error = `File too large. Maximum size is ${maxSize}MB`;
      onUploadError?.(error);
      toast({ title: "File too large", description: error, variant: "destructive" });
      return;
    }

    setIsUploading(true);

    try {
      const bucketName = 'heli-ski-files'; // Your Supabase bucket name
      const filePath = generateSupabaseFilePath(runId, fileType, file.name, fieldName);

      const result = await uploadFile(bucketName, filePath, file, fileType);

      if (result.status === 'success') {
        onUploadComplete(result.url);
        toast({ title: "Upload successful", description: `${file.name} uploaded.` });
      } else {
        throw new Error(result.error || "Unknown upload error");
      }
    } catch (error: unknown) {
      console.error("File upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file.";
      onUploadError?.(errorMessage);
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const getIcon = () => {
    if (fileType === 'gpx') return <MapPin className="w-5 h-5" />;
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image className="w-5 h-5" />;
  };

  const getLabel = () => {
    switch (fieldName) {
      case 'gpxPath': return 'Upload GPX Track';
      case 'runPhoto': return 'Upload Run Photo';
      case 'avalanchePhoto': return 'Upload Avalanche Photo';
      case 'additionalPhotos': return 'Upload Additional Photo';
      default: return 'Upload File';
    }
    
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept || (fileType === 'gpx' ? '.gpx' : 'image/*')}
        onChange={handleChange}
        className="hidden"
      />
      
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center space-y-2">
          {getIcon()}
          <div className="text-sm text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="mb-2"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : getLabel()}
            </Button>
            <p className="text-xs">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {maxSize}MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
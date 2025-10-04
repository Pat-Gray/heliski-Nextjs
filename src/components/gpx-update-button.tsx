"use client";

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface GpxUpdateButtonProps {
  runId: string;
  currentGpxPath: string | null;
  onUpdate?: () => void;
}

export default function GpxUpdateButton({ runId, currentGpxPath, onUpdate }: GpxUpdateButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gpx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('runId', runId);
          formData.append('fieldName', 'gpxPath');
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            const { url } = await response.json();
            const updateResponse = await fetch(`/api/runs/${runId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gpxPath: url }),
            });
            if (updateResponse.ok) {
              queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
              onUpdate?.();
            }
          }
        } catch (error) {
          console.error('Failed to upload GPX file:', error);
        } finally {
          setIsUploading(false);
        }
      }
    };
    input.click();
  };


  return (
    <div className="flex items-center gap-1">
      {currentGpxPath ? (
        <>
          {/* <Button
            variant="outline"
            size="sm"
            onClick={handleUpload}
            disabled={isUploading}
            className="h-7 px-2 text-xs"
          >
            <Upload className="h-3 w-3 mr-1" />
            {isUploading ? 'Uploading...' : 'Update GPX Track'}
          </Button> */}
          
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpload}
          disabled={isUploading}
          className="h-7 px-2 text-xs"
        >
          <MapPin className="h-3 w-3 mr-1" />
          {isUploading ? 'Uploading...' : 'Add GPX'}
        </Button>
      )}
    </div>
  );
}

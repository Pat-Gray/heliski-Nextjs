'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface AvalancheImage {
  id: string;
  title?: string;
  description?: string;
  comment?: string;
  notes?: string;
  local_file_url: string;
  caltopo_url?: string;
  file_size?: number;
  mime_type?: string;
  caltopo_created_at?: string;
  caltopo_updated_at?: string;
}

interface AvalancheFeature {
  id: string;
  title: string;
  pointCount: number;
  properties: Record<string, unknown>;
  groupId?: string;
  hasImages: boolean;
  geometryType: string;
  class: string;
  markerSymbol?: string;
  markerColor?: string;
  markerSize?: string;
  coordinates: number[][];
  visible?: boolean;
  creator?: string;
  created?: string;
  updated?: string;
  images?: AvalancheImage[];
}

interface AvalancheFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: AvalancheFeature | null;
}

export default function AvalancheFeatureModal({ 
  isOpen, 
  onClose, 
  feature 
}: AvalancheFeatureModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!feature) return null;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const selectedImage = feature.images?.[selectedImageIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{feature.title}</span>
            
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[75vh] gap-6">
          {/* Main Image Display - Left Side */}
          {feature.hasImages && feature.images && feature.images.length > 0 && selectedImage && (
            <div className="flex-1 flex flex-col">
              <Card className="p-4 flex-1 flex flex-col">
                <div className="flex-1 bg-muted rounded-lg flex items-center justify-center min-h-[400px] max-h-[70vh] relative">
                  <Image
                    src={selectedImage.local_file_url}
                    alt={selectedImage.title || 'Avalanche feature image'}
                    fill
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      console.error('Image load error:', e);
                    }}
                  />
                </div>
                
                <div className="space-y-2 mt-4">
                  <h4 className="font-medium">
                    {selectedImage.title || 'Untitled Image'}
                  </h4>
                  
                  {selectedImage.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedImage.description}
                    </p>
                  )}
                  
                  {selectedImage.comment && (
                    <p className="text-sm">
                      <span className="font-medium">Comment:</span> {selectedImage.comment}
                    </p>
                  )}
                  
                  {selectedImage.notes && (
                    <p className="text-sm">
                      <span className="font-medium">Notes:</span> {selectedImage.notes}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Size: {formatFileSize(selectedImage.file_size)}</span>
                    <span>Type: {selectedImage.mime_type || 'Unknown'}</span>
                    {selectedImage.caltopo_created_at && (
                      <span>Created: {formatDate(selectedImage.caltopo_created_at)}</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedImage.local_file_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Full Size
                    </Button>
                    {selectedImage.caltopo_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedImage.caltopo_url, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        View in CalTopo
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Image Gallery - Right Side */}
          {feature.hasImages && feature.images && feature.images.length > 0 && (
            <div className="w-48 flex flex-col">
              <h4 className="font-medium mb-3">Images ({feature.images.length})</h4>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {feature.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative w-full h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === selectedImageIndex 
                        ? 'border-primary' 
                        : 'border-muted hover:border-muted-foreground'
                    }`}
                  >
                    <Image
                      fill
                      src={image.local_file_url}
                      alt={image.title || `Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Images Message */}
          {!feature.hasImages && (
            <div className="flex-1 flex items-center justify-center">
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No images available for this feature.</p>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

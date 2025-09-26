import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Image as ImageIcon, Mountain, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { Run } from "@/lib/schemas/schema";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: Run | null;
}

export default function ImageModal({ isOpen, onClose, run }: ImageModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Get all images
  const allImages: string[] = [];
  if (run?.runPhoto) allImages.push(run.runPhoto);
  if (run?.avalanchePhoto) allImages.push(run.avalanchePhoto);
  if (run?.additionalPhotos) allImages.push(...run.additionalPhotos);

  const handleImageClick = (imageUrl: string) => {
    const index = allImages.indexOf(imageUrl);
    if (index !== -1) {
      setSelectedImageIndex(index);
      setShowFullScreen(true);
    }
  };

  const closeFullScreen = () => {
    setShowFullScreen(false);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Handle Escape key to close full screen viewer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showFullScreen) {
        setShowFullScreen(false);
      }
    };

    if (showFullScreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showFullScreen]);

  if (!run) return null;

  return (
    <>
      <Dialog open={isOpen && !showFullScreen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] p-0 [&>button]:hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mountain className="h-5 w-5" />
                <span>{run.name}</span>
                <span className="text-sm text-gray-500">({allImages.length} images)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="p-4">
            {allImages.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No images available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Primary Images */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Primary Images</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Run Photo */}
                    <div>
                      <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                        <Mountain className="h-4 w-4" />
                        <span>Run Photo</span>
                      </div>
                      <div className="h-48 border rounded-lg overflow-hidden">
                        {run.runPhoto ? (
                          <img
                            src={run.runPhoto}
                            alt="Run photo"
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => run.runPhoto && handleImageClick(run.runPhoto)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500">
                            No run photo
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Avalanche Photo */}
                    <div>
                      <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Avalanche Path</span>
                      </div>
                      <div className="h-48 border rounded-lg overflow-hidden">
                        {run.avalanchePhoto ? (
                          <img
                            src={run.avalanchePhoto}
                            alt="Avalanche photo"
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => run.avalanchePhoto && handleImageClick(run.avalanchePhoto)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500">
                            No avalanche photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Images */}
                {run.additionalPhotos && run.additionalPhotos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Additional Photos ({run.additionalPhotos.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {run.additionalPhotos.map((photo, index) => (
                        <div key={index} className="h-24 border rounded-lg overflow-hidden">
                          <img
                            src={photo}
                            alt={`Additional photo ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => handleImageClick(photo)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Viewer */}
      {showFullScreen && allImages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={closeFullScreen}
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                className="text-white hover:bg-white/20"
                disabled={zoomLevel >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                className="text-white hover:bg-white/20"
                disabled={zoomLevel <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetZoom}
                className="text-white hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation */}
            {allImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedImageIndex(prev => prev > 0 ? prev - 1 : allImages.length - 1);
                    setZoomLevel(1);
                    setImagePosition({ x: 0, y: 0 });
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedImageIndex(prev => prev < allImages.length - 1 ? prev + 1 : 0);
                    setZoomLevel(1);
                    setImagePosition({ x: 0, y: 0 });
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                >
                  →
                </Button>
              </>
            )}

            {/* Image */}
            <img
              src={allImages[selectedImageIndex]}
              alt={`Image ${selectedImageIndex + 1}`}
              className={`transition-transform duration-200 ${
                isDragging ? 'cursor-grabbing' : zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'
              }`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                transformOrigin: 'center center'
              }}
              onMouseDown={handleMouseDown}
              draggable={false}
            />

            {/* Image Counter and Zoom Level */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm flex items-center gap-4">
              <span>{selectedImageIndex + 1} of {allImages.length}</span>
              <span className="text-xs opacity-75">{Math.round(zoomLevel * 100)}%</span>
            </div>

            {/* Instructions */}
            {zoomLevel > 1 && (
              <div className="absolute bottom-4 right-4 text-white text-xs opacity-75">
                Drag to pan • Scroll to zoom
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
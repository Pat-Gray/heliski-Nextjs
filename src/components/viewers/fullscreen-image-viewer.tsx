"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface FullscreenImageViewerProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function FullscreenImageViewer({ 
  images, 
  initialIndex = 0, 
  isOpen, 
  onClose 
}: FullscreenImageViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(initialIndex);
      setZoomLevel(1);
      setImagePosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle arrow keys for navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (event.key === 'ArrowLeft') {
        setSelectedIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
        setZoomLevel(1);
        setImagePosition({ x: 0, y: 0 });
      } else if (event.key === 'ArrowRight') {
        setSelectedIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
        setZoomLevel(1);
        setImagePosition({ x: 0, y: 0 });
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, images.length]);

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

  const goToPrevious = () => {
    setSelectedIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const goToNext = () => {
    setSelectedIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  if (!isOpen || images.length === 0) return null;

  return (
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
          onClick={onClose}
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
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Image */}
        <Image
          src={images[selectedIndex]}
          alt={`Image ${selectedIndex + 1}`}
          width={800}
          height={600}
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
          <span>{selectedIndex + 1} of {images.length}</span>
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
  );
}

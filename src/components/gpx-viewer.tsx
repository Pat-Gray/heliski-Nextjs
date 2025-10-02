"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { useGPXUrl } from '@/hooks/use-gpx-url';

interface GPXViewerProps {
  runId: string | null;
  className?: string;
}

interface GPXTrack {
  name: string;
  points: Array<{
    lat: number;
    lon: number;
    ele?: number;
  }>;
}

export default function GPXViewer({ runId, className = "" }: GPXViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [track, setTrack] = useState<GPXTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: gpxData, isLoading: urlLoading, error: urlError } = useGPXUrl(runId);

  // Parse GPX content
  useEffect(() => {
    if (!gpxData?.success || !gpxData.gpxUrl) {
      if (gpxData?.error) {
        setError(gpxData.error);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch(gpxData.gpxUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch GPX: ${response.statusText}`);
        }
        return response.text();
      })
      .then(gpxText => {
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
        
        // Check for parsing errors
        const parseError = gpxDoc.querySelector('parsererror');
        if (parseError) {
          throw new Error('Invalid GPX format');
        }

        // Extract track points
        const trackPoints: Array<{ lat: number; lon: number; ele?: number }> = [];
        
        // Try to find track points
        const trkpts = gpxDoc.querySelectorAll('trkpt');
        trkpts.forEach(trkpt => {
          const lat = parseFloat(trkpt.getAttribute('lat') || '0');
          const lon = parseFloat(trkpt.getAttribute('lon') || '0');
          const eleElement = trkpt.querySelector('ele');
          const ele = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
          
          if (!isNaN(lat) && !isNaN(lon)) {
            trackPoints.push({ lat, lon, ele });
          }
        });

        // If no track points found, try waypoints
        if (trackPoints.length === 0) {
          const wpts = gpxDoc.querySelectorAll('wpt');
          wpts.forEach(wpt => {
            const lat = parseFloat(wpt.getAttribute('lat') || '0');
            const lon = parseFloat(wpt.getAttribute('lon') || '0');
            const eleElement = wpt.querySelector('ele');
            const ele = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
            
            if (!isNaN(lat) && !isNaN(lon)) {
              trackPoints.push({ lat, lon, ele });
            }
          });
        }

        if (trackPoints.length === 0) {
          throw new Error('No track points found in GPX');
        }

        // Get track name
        const trackName = gpxDoc.querySelector('trk name')?.textContent || 
                         gpxDoc.querySelector('metadata name')?.textContent || 
                         'GPX Track';

        setTrack({
          name: trackName,
          points: trackPoints
        });
      })
      .catch(err => {
        console.error('GPX parsing error:', err);
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [gpxData]);

  // Draw track on canvas
  useEffect(() => {
    if (!track || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (track.points.length === 0) return;

    // Calculate bounds
    const lats = track.points.map(p => p.lat);
    const lons = track.points.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Add padding
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const padding = 0.1;
    const paddedMinLat = minLat - latRange * padding;
    const paddedMaxLat = maxLat + latRange * padding;
    const paddedMinLon = minLon - lonRange * padding;
    const paddedMaxLon = maxLon + lonRange * padding;

    // Convert lat/lon to canvas coordinates
    const toCanvasX = (lon: number) => 
      ((lon - paddedMinLon) / (paddedMaxLon - paddedMinLon)) * rect.width;
    const toCanvasY = (lat: number) => 
      ((paddedMaxLat - lat) / (paddedMaxLat - paddedMinLat)) * rect.height;

    // Draw track
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    track.points.forEach((point, index) => {
      const x = toCanvasX(point.lon);
      const y = toCanvasY(point.lat);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw start/end markers
    if (track.points.length > 0) {
      // Start marker (green)
      const startPoint = track.points[0];
      const startX = toCanvasX(startPoint.lon);
      const startY = toCanvasY(startPoint.lat);
      
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(startX, startY, 4, 0, 2 * Math.PI);
      ctx.fill();

      // End marker (red)
      if (track.points.length > 1) {
        const endPoint = track.points[track.points.length - 1];
        const endX = toCanvasX(endPoint.lon);
        const endY = toCanvasY(endPoint.lat);
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(endX, endY, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

  }, [track]);

  if (!runId) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground ${className}`}>
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2" />
          <p>Select a run to view GPX track</p>
        </div>
      </div>
    );
  }

  if (urlLoading || isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading GPX track...</p>
        </div>
      </div>
    );
  }

  if (urlError || error) {
    return (
      <div className={`flex items-center justify-center p-8 text-destructive ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-medium">Failed to load GPX track</p>
          <p className="text-sm text-muted-foreground mt-1">
            {urlError?.message || error}
          </p>
        </div>
      </div>
    );
  }

  if (!gpxData?.success) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground ${className}`}>
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2" />
          <p className="font-medium">No GPX track available</p>
          <p className="text-sm mt-1">
            {gpxData?.error || 'This run is not linked to CalTopo'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground">
        {track?.name || 'GPX Track'}
        {gpxData.cached && (
          <span className="ml-2 text-green-600">• Cached</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full border rounded"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
}

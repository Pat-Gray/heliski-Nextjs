"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface MapComponentProps {
  gpxPath?: string;
  runStatus: 'open' | 'conditional' | 'closed';
  runName: string;
}

export default function MapComponent({ gpxPath, runStatus, runName }: MapComponentProps) {
  // const mapContainer = useRef<HTMLDivElement>(null); // TODO: Implement map integration
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Implement map integration with react-map-gl
    // For now, show a placeholder
    if (!gpxPath) {
      setMapError("No GPX path provided");
    }
  }, [gpxPath]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500';
      case 'conditional': return 'bg-orange-500';
      case 'closed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/20">
      <div className="text-center">
        <div className={`w-4 h-4 rounded-full ${getStatusColor(runStatus)} mx-auto mb-2`} />
        <p className="text-sm font-medium">{runName}</p>
        <p className="text-xs text-muted-foreground">Map view coming soon</p>
        {gpxPath && (
          <p className="text-xs text-muted-foreground mt-1">GPX: {gpxPath}</p>
        )}
      </div>
    </div>
  );
}

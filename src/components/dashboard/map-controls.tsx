"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Mountain, MapPin } from "lucide-react";

interface MapControlsProps {
  showAvalanchePaths: boolean;
  showOperations: boolean;
  onToggleAvalanchePaths: () => void;
  onToggleOperations: () => void;
}

export default function MapControls({
  showAvalanchePaths,
  showOperations,
  onToggleAvalanchePaths,
  onToggleOperations,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex gap-2">
      <Button
        variant={showAvalanchePaths ? "default" : "outline"}
        size="sm"
        onClick={onToggleAvalanchePaths}
        className="shadow-lg"
      >
        <Mountain className="w-4 h-4 mr-2" />
        Avalanche Paths
      </Button>
      <Button
        variant={showOperations ? "default" : "outline"}
        size="sm"
        onClick={onToggleOperations}
        className="shadow-lg"
      >
        <MapPin className="w-4 h-4 mr-2" />
        Operations
      </Button>
    </div>
  );
}

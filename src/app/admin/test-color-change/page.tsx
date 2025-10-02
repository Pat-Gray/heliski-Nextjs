// my-app/src/app/admin/test-color-change/page.tsx
"use client";

import { useState} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Palette, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/contexts/hooks/use-toast";

interface CalTopoMap {
  id: string;
  title: string;
  accountId: string;
}

interface CalTopoFeature {
  id: string;
  title: string;
  coordinates: number[][];
  properties: Record<string, unknown>;
  pointCount: number;
  currentColor?: string;
}

const STATUS_COLORS = {
  open: { name: 'Open (Green)', color: '#22c55e' },
  conditional: { name: 'Conditional (Orange)', color: '#f97316' },
  closed: { name: 'Closed (Red)', color: '#ef4444' }
} as const;

export default function TestColorChangePage() {
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [selectedColor, setSelectedColor] = useState<keyof typeof STATUS_COLORS>('open');
  const [isUpdating, setIsUpdating] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available maps
  const { data: maps = [], isLoading: mapsLoading } = useQuery({
    queryKey: ["/api/caltopo/maps"],
    queryFn: async () => {
      const response = await fetch('/api/caltopo/fetch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: '7QNDP0' }) // Your team ID
      });
      if (!response.ok) throw new Error('Failed to fetch maps');
      const data = await response.json();
      return data.maps || [];
    }
  });

  // Fetch features for selected map
  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ["/api/caltopo/features", selectedMapId],
    queryFn: async () => {
      if (!selectedMapId) return [];
      
      const response = await fetch('/api/caltopo/fetch-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: selectedMapId })
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      return data.gpxTracks || [];
    },
    enabled: !!selectedMapId
  });

  // Update colors mutation
  const updateColorsMutation = useMutation({
    mutationFn: async (featureUpdates: Array<{ featureId: string; status: keyof typeof STATUS_COLORS }>) => {
      const response = await fetch('/api/caltopo/update-feature-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapId: selectedMapId,
          featureUpdates
        })
      });
      if (!response.ok) throw new Error('Failed to update colors');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `Updated ${data.updated} features. Check CalTopo to see the changes.`,
      });
      setSelectedFeatures(new Set());
      // Refresh features to show updated colors
      queryClient.invalidateQueries({ queryKey: ["/api/caltopo/features", selectedMapId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update colors: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleFeatureToggle = (featureId: string) => {
    const newSelected = new Set(selectedFeatures);
    if (newSelected.has(featureId)) {
      newSelected.delete(featureId);
    } else {
      newSelected.add(featureId);
    }
    setSelectedFeatures(newSelected);
  };

  const handleUpdateColors = async () => {
    if (selectedFeatures.size === 0) {
      toast({
        title: "No features selected",
        description: "Please select at least one feature to update.",
        variant: "destructive"
      });
      return;
    }

    const featureUpdates = Array.from(selectedFeatures).map(featureId => ({
      featureId,
      status: selectedColor
    }));

    setIsUpdating(true);
    try {
      await updateColorsMutation.mutateAsync(featureUpdates);
    } finally {
      setIsUpdating(false);
    }
  };

  const getFeatureColor = (feature: CalTopoFeature) => {
    // Try to get current color from properties
    const stroke = feature.properties?.style?.stroke || feature.properties?.stroke;
    if (typeof stroke === 'string') return stroke;
    return '#6b7280'; // Default gray
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test CalTopo Color Changes</h1>
        <Badge variant="outline">Admin Test Page</Badge>
      </div>

      {/* Map Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedMapId || ""} onValueChange={setSelectedMapId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a map to test color changes" />
            </SelectTrigger>
            <SelectContent>
              {mapsLoading ? (
                 <div className="px-2 py-1.5 text-sm text-gray-500">Loading maps...</div>
              ) : (
                maps.map((map: CalTopoMap) => (
                  <SelectItem key={map.id} value={map.id}>
                    {map.title} ({map.id})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedMapId && (
        <>
          {/* Color Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Select Color
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Select value={selectedColor} onValueChange={(value: keyof typeof STATUS_COLORS) => setSelectedColor(value)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_COLORS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: config.color }}
                          />
                          {config.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div 
                  className="w-8 h-8 rounded border-2 border-gray-300"
                  style={{ backgroundColor: STATUS_COLORS[selectedColor].color }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Features List */}
          <Card>
            <CardHeader>
              <CardTitle>
                Features ({features.length})
                {selectedFeatures.size > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedFeatures.size} selected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {featuresLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading features...</span>
                </div>
              ) : features.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No features found in this map</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {features.map((feature: CalTopoFeature) => {
                    const isSelected = selectedFeatures.has(feature.id);
                    const currentColor = getFeatureColor(feature);
                    
                    return (
                      <div
                        key={feature.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => handleFeatureToggle(feature.id)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          onChange={() => handleFeatureToggle(feature.id)}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {feature.title || 'Unnamed Feature'}
                          </p>
                          <p className="text-sm text-gray-500">
                            ID: {feature.id.substring(0, 8)}... • {feature.pointCount} points
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Current:</span>
                          <div 
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: currentColor }}
                            title={`Current color: ${currentColor}`}
                          />
                        </div>
                        
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Update Button */}
          {selectedFeatures.size > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      Update {selectedFeatures.size} feature{selectedFeatures.size > 1 ? 's' : ''} to {STATUS_COLORS[selectedColor].name}
                    </p>
                    <p className="text-sm text-gray-500">
                      This will change the colors on CalTopo.com
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleUpdateColors}
                    disabled={isUpdating || updateColorsMutation.isPending}
                    className="min-w-32"
                  >
                    {isUpdating || updateColorsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Colors'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. <strong>Select a map</strong> from the dropdown above</p>
          <p>2. <strong>Choose a color</strong> (Open/Green, Conditional/Orange, Closed/Red)</p>
          <p>3. <strong>Select features</strong> by clicking on them (they&apos;ll highlight in blue)</p>
          <p>4. <strong>Click &quot;Update Colors&quot;</strong> to change the selected features</p>
          <p>5. <strong>Check CalTopo.com</strong> to see the color changes on the actual map</p>
        </CardContent>
      </Card>
    </div>
  );
}
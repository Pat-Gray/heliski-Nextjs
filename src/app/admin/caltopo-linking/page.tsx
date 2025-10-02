"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Link, Search, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/contexts/hooks/use-toast";
import { apiRequest, queryFn } from "@/lib/queryClient";
import type { Run, Area, SubArea } from "@/lib/schemas/schema";

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
}

interface LinkingState {
  selectedMapId: string | null;
  features: CalTopoFeature[];
  searchTerm: string;
  selectedRunId: string | null;
  selectedFeatureId: string | null;
  isLinking: boolean;
}

export default function CalTopoLinkingPage() {
  const [linkingState, setLinkingState] = useState<LinkingState>({
    selectedMapId: null,
    features: [],
    searchTerm: '',
    selectedRunId: null,
    selectedFeatureId: null,
    isLinking: false
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch runs, areas, and sub-areas
  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: () => queryFn("/api/runs"),
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    queryFn: () => queryFn("/api/areas"),
  });

  const { data: subAreas = [] } = useQuery<SubArea[]>({
    queryKey: ["/api/sub-areas"],
    queryFn: () => queryFn("/api/sub-areas"),
  });

  // Fetch CalTopo maps
  const { data: caltopoMaps = [] } = useQuery<CalTopoMap[]>({
    queryKey: ["/api/caltopo/maps"],
    queryFn: async () => {
      const response = await fetch('/api/caltopo/fetch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: '7QNDP0' }) // Default team ID
      });
      if (!response.ok) throw new Error('Failed to fetch maps');
      const data = await response.json();
      return data.maps || [];
    },
    enabled: true
  });

  // Fetch features for selected map
  const { data: mapFeatures = [], isLoading: featuresLoading } = useQuery<CalTopoFeature[]>({
    queryKey: ["/api/caltopo/features", linkingState.selectedMapId],
    queryFn: async () => {
      if (!linkingState.selectedMapId) return [];
      
      const response = await fetch('/api/caltopo/fetch-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: linkingState.selectedMapId })
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      return data.gpxTracks || [];
    },
    enabled: !!linkingState.selectedMapId
  });

  // Update features when map changes
  useEffect(() => {
    if (mapFeatures.length > 0) {
      setLinkingState(prev => ({
        ...prev,
        features: mapFeatures,
        searchTerm: '',
        selectedFeatureId: null
      }));
    }
  }, [mapFeatures]);

  // Filter features based on search term
  const filteredFeatures = linkingState.features.filter(feature =>
    feature.title.toLowerCase().includes(linkingState.searchTerm.toLowerCase()) ||
    (typeof feature.properties?.description === 'string' && 
     feature.properties.description.toLowerCase().includes(linkingState.searchTerm.toLowerCase()))
  );

  // Filter runs that are not yet linked
  const unlinkedRuns = runs.filter(run => !run.caltopoMapId || !run.caltopoFeatureId);

  // Calculate name similarity score
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Simple Levenshtein distance-based similarity
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
  };

  // Get suggested features for a run
  const getSuggestedFeatures = (run: Run) => {
    return filteredFeatures
      .map(feature => ({
        feature,
        similarity: calculateSimilarity(run.name, feature.title)
      }))
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  };

  // Link run to feature mutation
  const linkRunMutation = useMutation({
    mutationFn: async ({ runId, mapId, featureId }: { runId: string; mapId: string; featureId: string }) => {
      const response = await apiRequest("PUT", `/api/runs/${runId}`, {
        caltopoMapId: mapId,
        caltopoFeatureId: featureId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      toast({
        title: "Run linked successfully",
        description: "The run has been linked to the CalTopo feature."
      });
      setLinkingState(prev => ({
        ...prev,
        selectedRunId: null,
        selectedFeatureId: null
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to link run",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Cache GPX mutation
  const cacheGPXMutation = useMutation({
    mutationFn: async ({ mapId, featureId, runId }: { mapId: string; featureId: string; runId: string }) => {
      const response = await fetch('/api/caltopo/cache-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId, featureId, runId })
      });
      if (!response.ok) throw new Error('Failed to cache GPX');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      toast({
        title: "GPX cached successfully",
        description: "The GPX track has been cached for fast dashboard rendering."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cache GPX",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleLinkRun = async (runId: string, mapId: string, featureId: string) => {
    setLinkingState(prev => ({ ...prev, isLinking: true }));
    
    try {
      // First link the run
      await linkRunMutation.mutateAsync({ runId, mapId, featureId });
      
      // Then cache the GPX
      await cacheGPXMutation.mutateAsync({ mapId, featureId, runId });
      
    } catch (error) {
      console.error('Linking failed:', error);
    } finally {
      setLinkingState(prev => ({ ...prev, isLinking: false }));
    }
  };

  const getRunSubArea = (run: Run) => {
    const subArea = subAreas.find(sa => sa.id === run.subAreaId);
    const area = subArea ? areas.find(a => a.id === subArea.areaId) : null;
    return { subArea, area };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CalTopo Linking</h1>
          <p className="text-muted-foreground">
            Link runs to CalTopo features for automatic GPX caching and style syncing
          </p>
          <div className="mt-2 text-sm text-muted-foreground">
            <p><strong>How to link:</strong> 1) Select a CalTopo map → 2) Click a run → 3) Click a feature → 4) Click &quot;Link Selected&quot;</p>
          </div>
        </div>
        <Badge variant="outline">
          {unlinkedRuns.length} unlinked runs
        </Badge>
      </div>

      {/* Map Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Select CalTopo Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={linkingState.selectedMapId || ""}
            onValueChange={(mapId) => setLinkingState(prev => ({ ...prev, selectedMapId: mapId }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a CalTopo map..." />
            </SelectTrigger>
            <SelectContent>
              {caltopoMaps.map(map => (
                <SelectItem key={map.id} value={map.id}>
                  {map.title} ({map.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {featuresLoading && (
            <div className="flex items-center mt-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span>Loading features...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection Status */}
      {(linkingState.selectedRunId || linkingState.selectedFeatureId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Run:</span>
                {linkingState.selectedRunId ? (
                  <Badge variant="default">
                    {runs.find(r => r.id === linkingState.selectedRunId)?.name}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">None selected</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Feature:</span>
                {linkingState.selectedFeatureId ? (
                  <Badge variant="default">
                    {linkingState.features.find(f => f.id === linkingState.selectedFeatureId)?.title}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">None selected</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {linkingState.selectedRunId && linkingState.selectedFeatureId && (
                  <Button
                    size="sm"
                    onClick={() => handleLinkRun(
                      linkingState.selectedRunId!,
                      linkingState.selectedMapId!,
                      linkingState.selectedFeatureId!
                    )}
                    disabled={linkingState.isLinking}
                  >
                    {linkingState.isLinking ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Link className="w-3 h-3 mr-1" />
                    )}
                    Link Now
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLinkingState(prev => ({ 
                    ...prev, 
                    selectedRunId: null, 
                    selectedFeatureId: null 
                  }))}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Features */}
      {linkingState.selectedMapId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="w-5 h-5 mr-2" />
              Features ({filteredFeatures.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search features..."
              value={linkingState.searchTerm}
              onChange={(e) => setLinkingState(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="mb-4"
            />
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredFeatures.map(feature => (
                <div
                  key={feature.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    linkingState.selectedFeatureId === feature.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setLinkingState(prev => ({ 
                    ...prev, 
                    selectedFeatureId: feature.id 
                  }))}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        LineString • {feature.pointCount} points
                      </p>
                    </div>
                    {linkingState.selectedFeatureId === feature.id && (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Runs to Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Link className="w-5 h-5 mr-2" />
              Unlinked Runs ({unlinkedRuns.length})
            </div>
            {linkingState.selectedRunId && linkingState.selectedFeatureId && (
              <Button
                onClick={() => handleLinkRun(
                  linkingState.selectedRunId!,
                  linkingState.selectedMapId!,
                  linkingState.selectedFeatureId!
                )}
                disabled={linkingState.isLinking}
                className="flex items-center gap-2"
              >
                {linkingState.isLinking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
                {linkingState.isLinking ? 'Linking...' : 'Link Selected'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {unlinkedRuns.map(run => {
              const { subArea, area } = getRunSubArea(run);
              const suggestedFeatures = getSuggestedFeatures(run);
              
              return (
                <div 
                  key={run.id} 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    linkingState.selectedRunId === run.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setLinkingState(prev => ({ 
                    ...prev, 
                    selectedRunId: run.id,
                    selectedFeatureId: null
                  }))}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">#{run.runNumber} - {run.name}</h4>
                        {linkingState.selectedRunId === run.id && (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {area?.name} • {subArea?.name} • {run.aspect} • {run.elevationMax}-{run.elevationMin}m
                      </p>
                      
                      {suggestedFeatures.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">Suggested features:</p>
                          <div className="space-y-1">
                            {suggestedFeatures.map(({ feature, similarity }) => (
                              <div
                                key={feature.id}
                                className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent run selection
                                  setLinkingState(prev => ({ 
                                    ...prev, 
                                    selectedFeatureId: feature.id 
                                  }));
                                }}
                              >
                                <span>{feature.title}</span>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">
                                    {Math.round(similarity * 100)}% match
                                  </Badge>
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent run selection
                                      handleLinkRun(run.id, linkingState.selectedMapId!, feature.id);
                                    }}
                                    disabled={linkingState.isLinking}
                                  >
                                    {linkingState.isLinking ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      'Link'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

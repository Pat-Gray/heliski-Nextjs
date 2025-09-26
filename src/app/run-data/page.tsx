"use client";

import { useState} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Mountain,
  MapPin, 
  Activity,
  Search,
  Database,
  ChevronRight,
  Image,
  TrendingUp,
  Compass,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AreaFormModal from "@/components/area-form-modal";
import SubAreaFormModal from "@/components/subarea-form-modal";
import RunFormModal from "@/components/run-form-modal";
import ImageModal from "@/components/image-modal";
import MapComponent from "@/components/map-component";
import FileUpload from "@/components/file-upload";
import type { Area, SubArea, Run } from "@/lib/schemas/schema";
import { queryFn } from "@/lib/queryClient";

export default function RunDataManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedSubArea, setSelectedSubArea] = useState<string>("");
  
  // Navigation state
  const [navigationStack, setNavigationStack] = useState<Array<{
    type: 'area' | 'subarea' | 'run';
    id: string;
    name: string;
  }>>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedRunForImages, setSelectedRunForImages] = useState<Run | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Navigation functions
  const navigateToArea = (area: Area) => {
    setNavigationStack([{ type: 'area', id: area.id, name: area.name }]);
    setSelectedArea(area.id);
    setSelectedSubArea("");
    setSelectedRunId(null);
  };

  const navigateToSubArea = (subArea: SubArea) => {
    const area = areas.find(a => a.id === subArea.areaId);
    setNavigationStack([
      { type: 'area', id: area!.id, name: area!.name },
      { type: 'subarea', id: subArea.id, name: subArea.name }
    ]);
    setSelectedArea(subArea.areaId);
    setSelectedSubArea(subArea.id);
    setSelectedRunId(null);
  };


  const resetNavigation = () => {
    setNavigationStack([]);
    setSelectedArea("");
    setSelectedSubArea("");
    setSelectedRunId(null);
  };

  // Fetch all data
  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    queryFn: () => queryFn("/api/areas"),
  });

  const { data: subAreas = [] } = useQuery<SubArea[]>({
    queryKey: ["/api/sub-areas"],
    queryFn: () => queryFn("/api/sub-areas"),
  });

  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: () => queryFn("/api/runs"),
  });



  const handleViewImages = (run: Run) => {
    setSelectedRunForImages(run);
    setShowImageModal(true);
  };

  // Filter data based on search and selections
  const filteredAreas = areas.filter(area => 
    area.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubAreas = subAreas.filter(subArea => {
    const matchesSearch = subArea.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArea = !selectedArea || subArea.areaId === selectedArea;
    return matchesSearch && matchesArea;
  });

  const filteredRuns = runs.filter(run => {
    const matchesSearch = run.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.statusComment?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubArea = !selectedSubArea || run.subAreaId === selectedSubArea;
    const matchesArea = !selectedArea || subAreas.find(sa => sa.id === run.subAreaId)?.areaId === selectedArea;
    
    return matchesSearch && matchesSubArea && matchesArea;
  });

  // Get area name for sub-area
  const getAreaName = (areaId: string) => {
    return areas.find(area => area.id === areaId)?.name || "Unknown Area";
  };

  // Get sub-area name for run
  const getSubAreaName = (subAreaId: string) => {
    return subAreas.find(subArea => subArea.id === subAreaId)?.name || "Unknown Sub-Area";
  };

  // Status helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500';
      case 'conditional': return 'bg-orange-500';
      case 'closed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'conditional': return 'Conditional';
      case 'closed': return 'Closed';
      default: return 'Unknown';
    }
  };

  const getAngleLabel = (angle: string) => {
    switch (angle) {
      case 'gentle': return 'Gentle (≤25°)';
      case 'moderate': return 'Moderate (26-35°)';
      case 'steep': return 'Steep (36-45°)';
      case 'very_steep': return 'Very Steep (>45°)';
      default: return angle;
    }
  };


  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-foreground">Run Data Management</h2>
        <p className="text-muted-foreground">Manage areas, sub-areas, and ski runs</p>
      </header>

      {/* Navigation Breadcrumb */}
      {navigationStack.length > 0 && (
        <div className="bg-card border-b border-border px-6 py-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={resetNavigation}>
              <Database className="w-4 h-4 mr-1" />
              All Data
            </Button>
            {navigationStack.map((item, index) => (
              <div key={item.id} className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (index < navigationStack.length - 1) {
                      const newStack = navigationStack.slice(0, index + 1);
                      setNavigationStack(newStack);
                      const lastItem = newStack[newStack.length - 1];
                      if (lastItem.type === 'area') {
                        setSelectedArea(lastItem.id);
                        setSelectedSubArea("");
                        setSelectedRunId(null);
                      } else if (lastItem.type === 'subarea') {
                        setSelectedSubArea(lastItem.id);
                        setSelectedRunId(null);
                      }
                    }
                  }}
                >
                  {item.name}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-6 pb-0 flex-shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search areas, sub-areas, or runs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel */}
        <div className="w-1/3 border-r border-border overflow-y-auto">
          <div className="p-6">
            {/* Areas */}
            {!selectedArea && !selectedSubArea && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Areas</h3>
                  <AreaFormModal />
                </div>
                <div className="space-y-3">
                  {filteredAreas.map(area => (
                    <Card 
                      key={area.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigateToArea(area)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{area.name}</h4>
                          </div>
                          <Badge variant="secondary">
                            {subAreas.filter(sa => sa.areaId === area.id).length} sub-areas
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Areas */}
            {selectedArea && !selectedSubArea && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Sub-Areas in {areas.find(a => a.id === selectedArea)?.name}
                  </h3>
                  <SubAreaFormModal preselectedAreaId={selectedArea} />
                </div>
                <div className="space-y-3">
                  {filteredSubAreas.map(subArea => (
                    <Card 
                      key={subArea.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigateToSubArea(subArea)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{subArea.name}</h4>
                          </div>
                          <Badge variant="secondary">
                            {runs.filter(r => r.subAreaId === subArea.id).length} runs
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Runs */}
            {selectedSubArea && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Runs in {subAreas.find(sa => sa.id === selectedSubArea)?.name}
                  </h3>
                  <RunFormModal preselectedSubAreaId={selectedSubArea} />
                </div>
                <div className="space-y-3">
                  {filteredRuns.map(run => (
                    <Card 
                      key={run.id} 
                      className={`cursor-pointer hover:shadow-md transition-all ${
                        selectedRunId === run.id ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(run.status)}`} />
                            <div>
                              <h4 className="font-medium">#{run.runNumber} {run.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {run.aspect} • {getAngleLabel(run.averageAngle)} • {run.elevationMax}-{run.elevationMin}m
                              </p>
                            </div>
                          </div>
                          <Badge className={getStatusColor(run.status)}>
                            {getStatusLabel(run.status)}
                          </Badge>
                        </div>
                        {run.statusComment && (
                          <p className="text-xs text-muted-foreground italic">
                            &ldquo;{run.statusComment}&rdquo;
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedRunId ? (
            <div className="h-full">
              {(() => {
                const run = runs.find(r => r.id === selectedRunId);
                if (!run) return <div>Run not found</div>;
                
                return (
                  <div className="h-full flex flex-col">
                    {/* Run Header */}
                    <div className="p-6 border-b border-border bg-card">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`w-4 h-4 rounded-full ${getStatusColor(run.status)}`} />
                        <div>
                          <h1 className="text-2xl font-bold">#{run.runNumber} {run.name}</h1>
                          <p className="text-muted-foreground">
                            {getSubAreaName(run.subAreaId)} • {getAreaName(subAreas.find(sa => sa.id === run.subAreaId)?.areaId || '')}
                          </p>
                        </div>
                      </div>
                      
                      {/* Run Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="flex items-center space-x-3">
                          <Compass className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Aspect</p>
                            <p className="font-medium">{run.aspect || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <TrendingUp className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Angle</p>
                            <p className="font-medium">{getAngleLabel(run.averageAngle)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Mountain className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Elevation</p>
                            <p className="font-medium">{run.elevationMax}-{run.elevationMin}m</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Activity className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <p className="font-medium">{getStatusLabel(run.status)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {run.statusComment && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-1">Status Comment</p>
                          <p className="text-sm">{run.statusComment}</p>
                        </div>
                      )}
                    </div>

                    {/* Map and Images */}
                    <div className="flex-1 p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        {/* GPX Track Map */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-5 h-5" />
                              <h3 className="text-lg font-semibold">GPX Track</h3>
                            </div>
                            <FileUpload
                              runId={run.id}
                              fileType="gpx"
                              fieldName="gpxPath"
                              onUploadComplete={async (url) => {
                                try {
                                  await apiRequest("PUT", `/api/runs/${run.id}`, { gpxPath: url });
                                  queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
                                  toast({ title: "GPX track updated successfully" });
                                } catch {
                                  toast({ title: "Failed to update run", variant: "destructive" });
                                }
                              }}
                              className="w-auto"
                            />
                          </div>
                          <div className="h-96 border rounded-lg overflow-hidden">
                            <MapComponent 
                              gpxPath={run.gpxPath || undefined}
                              runStatus={run.status as 'open' | 'conditional' | 'closed'}
                              runName={run.name}
                            />
                          </div>
                        </div>

                        {/* Images */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Image className="w-5 h-5" />
                              <h3 className="text-lg font-semibold">Images</h3>
                              <span className="text-sm text-muted-foreground">
                                ({[run.runPhoto, run.avalanchePhoto, ...(run.additionalPhotos || [])].filter(Boolean).length})
                              </span>
                            </div>
                            <div className="flex space-x-2">
                              <FileUpload
                                runId={run.id}
                                fileType="image"
                                fieldName="runPhoto"
                                onUploadComplete={async (url) => {
                                  try {
                                    await apiRequest("PUT", `/api/runs/${run.id}`, { runPhoto: url });
                                    queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
                                    toast({ title: "Run photo updated successfully" });
                                  } catch {
                                    toast({ title: "Failed to update run", variant: "destructive" });
                                  }
                                }}
                                className="w-auto"
                              />
                              <Button variant="outline" onClick={() => handleViewImages(run)}>
                                <Image className="w-4 h-4 mr-2" />
                                View All
                              </Button>
                            </div>
                          </div>
                          <div className="h-96 border rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center">
                            {run.runPhoto ? (
                              <img
                                src={run.runPhoto}
                                alt={`Run photo for ${run.name}`}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleViewImages(run)}
                              />
                            ) : (
                              <div className="text-center">
                                <Image className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-muted-foreground">No images available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Additional Photos */}
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Additional Photos</h3>
                          <FileUpload
                            runId={run.id}
                            fileType="image"
                            fieldName="additionalPhotos"
                            onUploadComplete={async (url) => {
                              try {
                                const updatedPhotos = [...(run.additionalPhotos || []), url];
                                await apiRequest("PUT", `/api/runs/${run.id}`, { additionalPhotos: updatedPhotos });
                                queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
                                toast({ title: "Additional photo added successfully" });
                              } catch {
                                toast({ title: "Failed to update run", variant: "destructive" });
                              }
                            }}
                            className="w-auto"
                          />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {run.additionalPhotos?.map((photoUrl, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={photoUrl}
                                alt={`Additional photo ${index + 1} for ${run.name}`}
                                className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleViewImages(run)}
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const updatedPhotos = run.additionalPhotos?.filter((_, i) => i !== index) || [];
                                  try {
                                    await apiRequest("PUT", `/api/runs/${run.id}`, { additionalPhotos: updatedPhotos });
                                    queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
                                    toast({ title: "Photo removed successfully" });
                                  } catch {
                                    toast({ title: "Failed to remove photo", variant: "destructive" });
                                  }
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          {(!run.additionalPhotos || run.additionalPhotos.length === 0) && (
                            <div className="col-span-full text-center py-8 text-muted-foreground">
                              <Image className="w-8 h-8 mx-auto mb-2" />
                              <p>No additional photos</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Mountain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Select a Run</h3>
                <p className="text-muted-foreground">Choose a run from the list on the left to view its details and GPX track</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && selectedRunForImages && (
        <ImageModal
          isOpen={showImageModal}
          run={selectedRunForImages}
          onClose={() => {
            setShowImageModal(false);
            setSelectedRunForImages(null);
          }}
        />
      )}
    </div>
  );
}
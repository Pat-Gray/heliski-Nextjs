"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, X, MapPin } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/contexts/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import FileUpload from "@/components/file-upload";

interface RunFormModalProps {
  preselectedSubAreaId?: string;
}

interface CalTopoMap {
  id: string;
  title: string;
  accountId: string;
}

interface CalTopoFeature {
  id: string;
  title: string;
  pointCount: number;
  properties: Record<string, unknown>;
  groupId?: string;
  hasImages?: boolean;
}

interface CalTopoGroup {
  id: string;
  name: string;
  color?: string;
}

export default function RunFormModal({ preselectedSubAreaId }: RunFormModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [aspect, setAspect] = useState("");
  const [elevationMin, setElevationMin] = useState("");
  const [elevationMax, setElevationMax] = useState("");
  const [status, setStatus] = useState("open");
  const [statusComment, setStatusComment] = useState("");
  
  // File states - these will store the uploaded file URLs
  const [runPhoto, setRunPhoto] = useState("");
  const [avalanchePhoto, setAvalanchePhoto] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  
  // CalTopo linking states
  const [caltopoMapId, setCalTopoMapId] = useState<string>("");
  const [caltopoGroupId, setCalTopoGroupId] = useState<string>("");
  const [caltopoFeatureId, setCalTopoFeatureId] = useState<string>("");
  const [_selectedCalTopoMap, setSelectedCalTopoMap] = useState<CalTopoMap | null>(null);
  const [selectedCalTopoFeature, setSelectedCalTopoFeature] = useState<CalTopoFeature | null>(null);
  
  // Upload states for tracking upload progress
  const [uploadProgress, setUploadProgress] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate a temporary ID for file uploads
  const [tempRunId] = useState(() => `temp-${Math.floor(123456)}`);

  // Fetch available CalTopo maps
  const { data: caltopoMaps = [], isLoading: mapsLoading, error: mapsError } = useQuery<CalTopoMap[]>({
    queryKey: ["/api/caltopo/maps"],
    queryFn: async () => {
      const response = await fetch('/api/caltopo/fetch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: '7QNDP0' }) // Your team ID
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch maps: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      return data.maps || [];
    },
    enabled: true, // Always fetch maps since GPX must come from CalTopo
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  

  // Fetch features and groups for selected map
  const { data: mapData, isLoading: featuresLoading } = useQuery<{
    gpxTracks: CalTopoFeature[];
    groups: CalTopoGroup[];
  }>({
    queryKey: ["/api/caltopo/features", caltopoMapId],
    queryFn: async () => {
      if (!caltopoMapId) return { gpxTracks: [], groups: [] };
      
      const response = await fetch('/api/caltopo/fetch-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: caltopoMapId })
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      return {
        gpxTracks: data.gpxTracks || [],
        groups: data.groups || []
      };
    },
    enabled: !!caltopoMapId
  });

  const caltopoFeatures = mapData?.gpxTracks || [];
  const caltopoGroups = mapData?.groups || [];
  
  // Filter features by selected group
  const filteredFeatures = caltopoGroupId && caltopoGroupId !== "all"
    ? caltopoFeatures.filter(feature => feature.groupId === caltopoGroupId)
    : caltopoFeatures;

  const createRunMutation = useMutation({
    mutationFn: async (runData: {
      name: string;
      runDescription?: string;
      runNotes?: string;
      aspect: string;
      elevationMin: number;
      elevationMax: number;
      status: string;
      statusComment: string | null;
      subAreaId: string;
      runPhoto: string | null;
      avalanchePhoto: string | null;
      additionalPhotos: string[] | null;
      caltopoMapId: string;
      caltopoFeatureId: string;
    }) => {
      const response = await apiRequest("POST", "/api/runs", runData);
      if (!response.ok) {
        throw new Error(`Failed to create run: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: async (newRun) => {
      // Always cache CalTopo GPX since it's required
      try {
        const cacheResponse = await fetch('/api/caltopo/cache-gpx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mapId: caltopoMapId, 
            featureId: caltopoFeatureId,
            runId: newRun.id 
          })
        });
        
        if (!cacheResponse.ok) {
          throw new Error(`Cache API failed: ${cacheResponse.statusText}`);
        }
        
        const _cacheResult = await cacheResponse.json();
        
        // Auto-sync CalTopo images and comments for this feature using the REAL endpoint
        const selectedFeature = filteredFeatures.find(f => f.id === caltopoFeatureId);
        if (selectedFeature) {
          try {
            const syncResponse = await fetch('/api/caltopo/sync-feature-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                mapId: caltopoMapId, 
                featureId: caltopoFeatureId,
                runId: newRun.id 
              })
            });
            
            if (syncResponse.ok) {
              const syncResult = await syncResponse.json();
              if (syncResult.syncedImages > 0 || syncResult.syncedComments > 0) {
                const parts = [];
                if (syncResult.syncedImages > 0) parts.push(`${syncResult.syncedImages} images`);
                if (syncResult.syncedComments > 0) parts.push(`${syncResult.syncedComments} comments`);
                
                toast({ 
                  title: "CalTopo Data Synced! 🎉", 
                  description: `Successfully synced ${parts.join(' and ')} from CalTopo` 
                });
              }
            }
          } catch {
            // Don't show error toast - it's not critical for run creation
          }
        }
      } catch {
        toast({ 
          title: "Warning", 
          description: "Run created but failed to cache CalTopo GPX. You can link it later.",
          variant: "destructive" 
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-areas"] });
      toast({ title: "Run created successfully" });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create run", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !aspect || !elevationMin || !elevationMax) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    if (!preselectedSubAreaId) {
      toast({ title: "Please select a sub-area first", variant: "destructive" });
      return;
    }

    // Check if any files are still uploading
    const stillUploading = Object.values(uploadProgress).some(uploading => uploading);
    if (stillUploading) {
      toast({ title: "Please wait for file uploads to complete", variant: "destructive" });
      return;
    }

    // Validate CalTopo linking (required)
    if (!caltopoMapId || !caltopoFeatureId) {
      toast({ title: "Please select a map and feature for CalTopo linking", variant: "destructive" });
      return;
    }
    
    // Validate group selection if groups are available
    if (caltopoGroups.length > 0 && (!caltopoGroupId || caltopoGroupId === "")) {
      toast({ title: "Please select a folder/group to organize the features", variant: "destructive" });
      return;
    }
    
    createRunMutation.mutate({
      name: name.trim(),
      runDescription: runDescription.trim() || undefined,
      runNotes: runNotes.trim() || undefined,
      aspect: aspect.toUpperCase(),
      elevationMin: parseInt(elevationMin),
      elevationMax: parseInt(elevationMax),
      status: status,
      statusComment: statusComment.trim() || null,
      subAreaId: preselectedSubAreaId,
      runPhoto: runPhoto || null,
      avalanchePhoto: avalanchePhoto || null,
      additionalPhotos: additionalPhotos.length > 0 ? additionalPhotos : null,
      caltopoMapId: caltopoMapId,
      caltopoFeatureId: caltopoFeatureId,
    });
  };

  // Handle file upload completion
  const handleFileUploadComplete = (fieldName: string, url: string) => {
    // Update local state with the uploaded file URL
    switch (fieldName) {
      case 'runPhoto':
        setRunPhoto(url);
        break;
      case 'avalanchePhoto':
        setAvalanchePhoto(url);
        break;
      case 'additionalPhotos':
        setAdditionalPhotos(prev => [...prev, url]);
        break;
    }
    
    // Mark this field as no longer uploading
    setUploadProgress(prev => ({ ...prev, [fieldName]: false }));
    
    toast({ 
      title: "File uploaded successfully", 
      description: `${fieldName} has been uploaded and will be included when you create the run.` 
    });
  };

  // Handle file upload error
  const handleFileUploadError = (fieldName: string, error: string) => {
    setUploadProgress(prev => ({ ...prev, [fieldName]: false }));
    toast({ 
      title: "Upload failed", 
      description: `Failed to upload ${fieldName}: ${error}`,
      variant: "destructive" 
    });
  };

  const resetForm = () => {
    setName("");
    setRunDescription("");
    setRunNotes("");
    setAspect("");
    setElevationMin("");
    setElevationMax("");
    setStatus("open");
    setStatusComment("");
    setRunPhoto("");
    setAvalanchePhoto("");
    setAdditionalPhotos([]);
    setUploadProgress({});
    setCalTopoMapId("");
    setCalTopoGroupId("");
    setCalTopoFeatureId("");
    setSelectedCalTopoMap(null);
    setSelectedCalTopoFeature(null);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  // Check if any files are currently uploading
  const isAnyFileUploading = Object.values(uploadProgress).some(uploading => uploading);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogTrigger asChild>
        <Button 
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Run</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sub-area validation warning */}
          {!preselectedSubAreaId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    No Sub-Area Selected
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>Please select a sub-area first before adding a run.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Run Name *
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter run name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="runDescription" className="text-sm font-medium">
                Run Description
              </label>
              <Textarea
                id="runDescription"
                value={runDescription}
                onChange={(e) => setRunDescription(e.target.value)}
                placeholder="Enter run description (optional)"
                rows={3}
              />
            </div>
            
           
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="aspect" className="text-sm font-medium">
                  Aspect *
                </label>
                <Select value={aspect} onValueChange={setAspect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N">North</SelectItem>
                    <SelectItem value="NE">Northeast</SelectItem>
                    <SelectItem value="E">East</SelectItem>
                    <SelectItem value="SE">Southeast</SelectItem>
                    <SelectItem value="S">South</SelectItem>
                    <SelectItem value="SW">Southwest</SelectItem>
                    <SelectItem value="W">West</SelectItem>
                    <SelectItem value="NW">Northwest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="elevationMax" className="text-sm font-medium">
                  Max Elevation (m) *
                </label>
                <Input
                  id="elevationMax"
                  type="number"
                  value={elevationMax}
                  onChange={(e) => setElevationMax(e.target.value)}
                  placeholder="Enter max elevation"
                  required
                />
              </div>
              <div>
                <label htmlFor="elevationMin" className="text-sm font-medium">
                  Min Elevation (m) *
                </label>
                <Input
                  id="elevationMin"
                  type="number"
                  value={elevationMin}
                  onChange={(e) => setElevationMin(e.target.value)}
                  placeholder="Enter min elevation"
                  required
                />
              </div>
            </div>
          </div>

          {/* Status Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Status Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="statusComment" className="text-sm font-medium">
                  Status Comment
                </label>
                <Textarea
                  id="statusComment"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Enter status comment"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* GPX Track Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">GPX Track</h3>
            <p className="text-sm text-muted-foreground">
              Select a GPX track from CalTopo for this run.
            </p>
            
            {/* CalTopo Map Selection */}
            <div className="space-y-4 border rounded-lg p-4">
              <div>
                <label className="text-sm font-medium">Select CalTopo Map *</label>
                <Select 
                  value={caltopoMapId} 
                  onValueChange={(mapId) => {
                    setCalTopoMapId(mapId);
                    setCalTopoGroupId("");
                    setCalTopoFeatureId("");
                    setSelectedCalTopoMap(null);
                    setSelectedCalTopoFeature(null);
                    const map = caltopoMaps.find(m => m.id === mapId);
                    setSelectedCalTopoMap(map || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a map" />
                  </SelectTrigger>
                  <SelectContent>
                    {mapsLoading ? (
                      <div className="p-2 text-sm text-muted-foreground">Loading maps...</div>
                    ) : mapsError ? (
                      <div className="p-2 text-sm text-red-600">
                        Error loading maps: {mapsError.message}
                      </div>
                    ) : caltopoMaps.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No maps available</div>
                    ) : (
                      caltopoMaps.map((map) => (
                        <SelectItem key={map.id} value={map.id}>
                          {map.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Group Selection */}
              {caltopoMapId && (
                <div>
                  <label className="text-sm font-medium">Select Folder/Group *</label>
                  <Select 
                    value={caltopoGroupId} 
                    onValueChange={(groupId) => {
                      setCalTopoGroupId(groupId);
                      setCalTopoFeatureId(""); // Reset feature selection when group changes
                      setSelectedCalTopoFeature(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a folder/group" />
                    </SelectTrigger>
                    <SelectContent>
                      {featuresLoading ? (
                        <div className="p-2 text-sm text-muted-foreground">Loading groups...</div>
                      ) : caltopoGroups.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No groups available - showing all features</div>
                      ) : (
                        <>
                          <SelectItem value="all">All features</SelectItem>
                          {caltopoGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {caltopoGroups.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      This map doesn&apos;t have organized groups. All features will be shown.
                    </p>
                  )}
                </div>
              )}

              {/* Feature Selection */}
              {caltopoMapId && (
                <div>
                  <label className="text-sm font-medium">Select GPX Feature *</label>
                  <Select 
                    value={caltopoFeatureId} 
                    onValueChange={(featureId) => {
                      setCalTopoFeatureId(featureId);
                      const feature = filteredFeatures.find(f => f.id === featureId);
                      setSelectedCalTopoFeature(feature || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a feature" />
                    </SelectTrigger>
                    <SelectContent>
                      {featuresLoading ? (
                        <div className="p-2 text-sm text-muted-foreground">Loading features...</div>
                      ) : filteredFeatures.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          {caltopoGroupId ? "No features in selected group" : "No features available"}
                        </div>
                      ) : (
                        filteredFeatures.map((feature) => (
                          <SelectItem key={feature.id} value={feature.id}>
                            {feature.title} {feature.hasImages ? '📸 (Auto-sync)' : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Selected Feature Info */}
              {selectedCalTopoFeature && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Selected: {selectedCalTopoFeature.title}
                    </span>
                  </div>
                  
                </div>
              )}
            </div>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Files & Media</h3>
            <p className="text-sm text-muted-foreground">
              Upload files now - they will be included when you create the run.
            </p>
            
            {/* Run Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Run Photo</label>
              <FileUpload
                runId={tempRunId}
                fileType="image"
                fieldName="runPhoto"
                onUploadComplete={(url) => handleFileUploadComplete("runPhoto", url)}
                onUploadError={(error) => handleFileUploadError("runPhoto", error)}
              />
              {runPhoto && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Upload className="w-4 h-4" />
                  <span>Run photo uploaded</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRunPhoto("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {uploadProgress.runPhoto && (
                <div className="text-sm text-blue-600">Uploading run photo...</div>
              )}
            </div>

            {/* Avalanche Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Avalanche Photo</label>
              <FileUpload
                runId={tempRunId}
                fileType="image"
                fieldName="avalanchePhoto"
                onUploadComplete={(url) => handleFileUploadComplete("avalanchePhoto", url)}
                onUploadError={(error) => handleFileUploadError("avalanchePhoto", error)}
              />
              {avalanchePhoto && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Upload className="w-4 h-4" />
                  <span>Avalanche photo uploaded</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAvalanchePhoto("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {uploadProgress.avalanchePhoto && (
                <div className="text-sm text-blue-600">Uploading avalanche photo...</div>
              )}
            </div>

            {/* Additional Photos */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Photos</label>
              <FileUpload
                runId={tempRunId}
                fileType="image"
                fieldName="additionalPhotos"
                onUploadComplete={(url) => handleFileUploadComplete("additionalPhotos", url)}
                onUploadError={(error) => handleFileUploadError("additionalPhotos", error)}
              />
              {additionalPhotos.length > 0 && (
                <div className="space-y-2">
                  {additionalPhotos.map((photo, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm text-green-600">
                      <Upload className="w-4 h-4" />
                      <span>Additional photo {index + 1} uploaded</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAdditionalPhotos(prev => prev.filter((_, i) => i !== index))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {uploadProgress.additionalPhotos && (
                <div className="text-sm text-blue-600">Uploading additional photo...</div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={createRunMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                createRunMutation.isPending || 
                !name.trim() || 
                !aspect || 
                !elevationMin || 
                !elevationMax || 
                !preselectedSubAreaId ||
                !caltopoMapId ||
                !caltopoFeatureId ||
                (caltopoGroups.length > 0 && (!caltopoGroupId || caltopoGroupId === "")) ||
                isAnyFileUploading
              }
            >
              {createRunMutation.isPending ? "Creating..." : "Create Run"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
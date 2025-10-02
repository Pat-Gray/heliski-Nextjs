"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Upload, X, Link, MapPin } from "lucide-react";
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
  properties: any;
}

export default function RunFormModal({ preselectedSubAreaId }: RunFormModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [runDescription, setRunDescription] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [aspect, setAspect] = useState("");
  const [averageAngle, setAverageAngle] = useState("");
  const [elevationMin, setElevationMin] = useState("");
  const [elevationMax, setElevationMax] = useState("");
  const [status, setStatus] = useState("open");
  const [statusComment, setStatusComment] = useState("");
  
  // File states - these will store the uploaded file URLs
  const [gpxPath, setGpxPath] = useState("");
  const [runPhoto, setRunPhoto] = useState("");
  const [avalanchePhoto, setAvalanchePhoto] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  
  // CalTopo linking states
  const [caltopoMapId, setCalTopoMapId] = useState<string>("");
  const [caltopoFeatureId, setCalTopoFeatureId] = useState<string>("");
  const [showCalTopoLinking, setShowCalTopoLinking] = useState(false);
  const [selectedCalTopoMap, setSelectedCalTopoMap] = useState<CalTopoMap | null>(null);
  const [selectedCalTopoFeature, setSelectedCalTopoFeature] = useState<CalTopoFeature | null>(null);
  
  // Upload states for tracking upload progress
  const [uploadProgress, setUploadProgress] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate a temporary ID for file uploads
  const [tempRunId] = useState(() => `temp-${Date.now()}`);

  // Fetch available CalTopo maps
  const { data: caltopoMaps = [], isLoading: mapsLoading, error: mapsError } = useQuery<CalTopoMap[]>({
    queryKey: ["/api/caltopo/maps"],
    queryFn: async () => {
      console.log('🔍 Fetching CalTopo maps...'); // Debug log
      const response = await fetch('/api/caltopo/fetch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: '7QNDP0' }) // Your team ID
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ CalTopo maps API error:', response.status, errorText);
        throw new Error(`Failed to fetch maps: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ CalTopo maps response:', data); // Debug log
      return data.maps || [];
    },
    enabled: showCalTopoLinking,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  

  // Fetch features for selected map
  const { data: caltopoFeatures = [], isLoading: featuresLoading } = useQuery<CalTopoFeature[]>({
    queryKey: ["/api/caltopo/features", caltopoMapId],
    queryFn: async () => {
      if (!caltopoMapId) return [];
      
      const response = await fetch('/api/caltopo/fetch-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: caltopoMapId })
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      return data.gpxTracks || [];
    },
    enabled: !!caltopoMapId && showCalTopoLinking
  });

  const createRunMutation = useMutation({
    mutationFn: async (runData: {
      name: string;
      runDescription?: string;
      runNotes?: string;
      aspect: string;
      averageAngle: string;
      elevationMin: number;
      elevationMax: number;
      status: string;
      statusComment: string | null;
      subAreaId: string;
      gpxPath: string | null;
      runPhoto: string | null;
      avalanchePhoto: string | null;
      additionalPhotos: string[] | null;
      caltopoMapId?: string | null;
      caltopoFeatureId?: string | null;
      gpxSource?: string;
    }) => {
      const response = await apiRequest("POST", "/api/runs", runData);
      if (!response.ok) {
        throw new Error(`Failed to create run: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: async (newRun) => {
      console.log('🎉 Run created successfully:', newRun);
      
      // If CalTopo feature is linked, cache the GPX
      if (caltopoMapId && caltopoFeatureId) {
        console.log('🔄 Caching CalTopo GPX for run:', {
          runId: newRun.id,
          mapId: caltopoMapId,
          featureId: caltopoFeatureId
        });
        
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
          
          const cacheResult = await cacheResponse.json();
          console.log('✅ CalTopo GPX cached successfully:', cacheResult);
        } catch (error) {
          console.error('❌ Failed to cache CalTopo GPX:', error);
          toast({ 
            title: "Warning", 
            description: "Run created but failed to cache CalTopo GPX. You can link it later.",
            variant: "destructive" 
          });
        }
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
    if (!name.trim() || !aspect || !averageAngle || !elevationMin || !elevationMax) {
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

    // Validate CalTopo linking
    if (showCalTopoLinking && (!caltopoMapId || !caltopoFeatureId)) {
      toast({ title: "Please select both a map and feature for CalTopo linking", variant: "destructive" });
      return;
    }
    
    createRunMutation.mutate({
      name: name.trim(),
      runDescription: runDescription.trim() || undefined,
      runNotes: runNotes.trim() || undefined,
      aspect: aspect.toUpperCase(),
      averageAngle: averageAngle,
      elevationMin: parseInt(elevationMin),
      elevationMax: parseInt(elevationMax),
      status: status,
      statusComment: statusComment.trim() || null,
      subAreaId: preselectedSubAreaId,
      gpxPath: showCalTopoLinking ? null : (gpxPath || null), // Don't use manual GPX if CalTopo is linked
      runPhoto: runPhoto || null,
      avalanchePhoto: avalanchePhoto || null,
      additionalPhotos: additionalPhotos.length > 0 ? additionalPhotos : null,
      caltopoMapId: showCalTopoLinking ? caltopoMapId : null,
      caltopoFeatureId: showCalTopoLinking ? caltopoFeatureId : null,
      gpxSource: showCalTopoLinking ? 'caltopo' : 'manual',
    });
  };

  // Handle file upload completion
  const handleFileUploadComplete = (fieldName: string, url: string) => {
    // Update local state with the uploaded file URL
    switch (fieldName) {
      case 'gpxPath':
        setGpxPath(url);
        break;
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
    setAverageAngle("");
    setElevationMin("");
    setElevationMax("");
    setStatus("open");
    setStatusComment("");
    setGpxPath("");
    setRunPhoto("");
    setAvalanchePhoto("");
    setAdditionalPhotos([]);
    setUploadProgress({});
    setShowCalTopoLinking(false);
    setCalTopoMapId("");
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
            
            <div>
              <label htmlFor="runNotes" className="text-sm font-medium">
                Run Notes
              </label>
              <Textarea
                id="runNotes"
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="Enter run notes (optional)"
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
              <div>
                <label htmlFor="averageAngle" className="text-sm font-medium">
                  Average Angle *
                </label>
                <Select value={averageAngle} onValueChange={setAverageAngle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select angle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gentle">Gentle (≤25°)</SelectItem>
                    <SelectItem value="moderate">Moderate (26-35°)</SelectItem>
                    <SelectItem value="steep">Steep (36-45°)</SelectItem>
                    <SelectItem value="very_steep">Very Steep (&gt;45°)</SelectItem>
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
              Choose how to add a GPX track for this run.
            </p>
            
            {/* CalTopo Linking Option */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="caltopo-linking"
                  checked={showCalTopoLinking}
                  onCheckedChange={(checked) => {
                    setShowCalTopoLinking(checked as boolean);
                    if (!checked) {
                      setCalTopoMapId("");
                      setCalTopoFeatureId("");
                      setSelectedCalTopoMap(null);
                      setSelectedCalTopoFeature(null);
                    }
                  }}
                />
                <Label htmlFor="caltopo-linking" className="text-sm font-medium">
                  Link to CalTopo GPX Feature
                </Label>
              </div>
              
              {showCalTopoLinking && (
                <div className="space-y-4 pl-6">
                  {/* Map Selection */}
                  <div>
                    <label className="text-sm font-medium">Select CalTopo Map</label>
                    <Select 
                      value={caltopoMapId} 
                      onValueChange={(mapId) => {
                        setCalTopoMapId(mapId);
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

                  {/* Feature Selection */}
                  {caltopoMapId && (
                    <div>
                      <label className="text-sm font-medium">Select GPX Feature</label>
                      <Select 
                        value={caltopoFeatureId} 
                        onValueChange={(featureId) => {
                          setCalTopoFeatureId(featureId);
                          const feature = caltopoFeatures.find(f => f.id === featureId);
                          setSelectedCalTopoFeature(feature || null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a feature" />
                        </SelectTrigger>
                        <SelectContent>
                          {featuresLoading ? (
                            <div className="p-2 text-sm text-muted-foreground">Loading features...</div>
                          ) : caltopoFeatures.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No features available</div>
                          ) : (
                            caltopoFeatures.map((feature) => (
                              <SelectItem key={feature.id} value={feature.id}>
                                {feature.title} ({feature.pointCount} points)
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
                      <p className="text-xs text-green-600 mt-1">
                        {selectedCalTopoFeature.pointCount} GPS points • Will be cached automatically
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual GPX Upload Option */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="manual-gpx"
                  checked={!showCalTopoLinking}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setShowCalTopoLinking(false);
                      setCalTopoMapId("");
                      setCalTopoFeatureId("");
                      setSelectedCalTopoMap(null);
                      setSelectedCalTopoFeature(null);
                    }
                  }}
                />
                <Label htmlFor="manual-gpx" className="text-sm font-medium">
                  Upload Manual GPX File
                </Label>
              </div>
              
              {!showCalTopoLinking && (
                <div className="space-y-2 pl-6">
                  <FileUpload
                    runId={tempRunId}
                    fileType="gpx"
                    fieldName="gpxPath"
                    onUploadComplete={(url) => handleFileUploadComplete("gpxPath", url)}
                    onUploadError={(error) => handleFileUploadError("gpxPath", error)}
                  />
                  {gpxPath && (
                    <div className="flex items-center space-x-2 text-sm text-green-600">
                      <Upload className="w-4 h-4" />
                      <span>GPX file uploaded</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setGpxPath("")}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {uploadProgress.gpxPath && (
                    <div className="text-sm text-blue-600">Uploading GPX file...</div>
                  )}
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
                !averageAngle || 
                !elevationMin || 
                !elevationMax || 
                !preselectedSubAreaId ||
                isAnyFileUploading ||
                (showCalTopoLinking && (!caltopoMapId || !caltopoFeatureId))
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
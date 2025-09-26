"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, X } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryFn } from "@/lib/queryClient";
import FileUpload from "@/components/file-upload";
import type { Run } from "@/lib/schemas/schema";

interface RunFormModalProps {
  preselectedSubAreaId?: string;
}

export default function RunFormModal({ preselectedSubAreaId }: RunFormModalProps) {
  const [name, setName] = useState("");
  const [runNumber, setRunNumber] = useState("");
  const [aspect, setAspect] = useState("");
  const [averageAngle, setAverageAngle] = useState("");
  const [elevationMin, setElevationMin] = useState("");
  const [elevationMax, setElevationMax] = useState("");
  const [status, setStatus] = useState("open");
  const [statusComment, setStatusComment] = useState("");
  
  // File states
  const [gpxPath, setGpxPath] = useState("");
  const [runPhoto, setRunPhoto] = useState("");
  const [avalanchePhoto, setAvalanchePhoto] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [createdRunId, setCreatedRunId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch runs to calculate next run number
  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: async () => {
      const data = await queryFn("/api/runs");
      return data as Run[];
    },
  });

  // Calculate next run number when preselectedSubAreaId changes
  useEffect(() => {
    if (preselectedSubAreaId && runs.length > 0) {
      const runsInSubArea = runs.filter(run => run.subAreaId === preselectedSubAreaId);
      const maxRunNumber = runsInSubArea.length > 0 
        ? Math.max(...runsInSubArea.map(run => run.runNumber))
        : 0;
      setRunNumber((maxRunNumber + 1).toString());
    }
  }, [preselectedSubAreaId, runs]);

  const createRunMutation = useMutation({
    mutationFn: async (runData: {
      name: string;
      runNumber: number;
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
    }) => {
      return await apiRequest("POST", "/api/runs", runData);
    },
    onSuccess: (data: unknown) => {
      const runId = (data as { id: string }).id;
      setCreatedRunId(runId);
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-areas"] });
      toast({ title: "Run created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create run", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  // Mutation to update run with file URLs
  const updateRunMutation = useMutation({
    mutationFn: async (updates: {
      gpxPath?: string;
      runPhoto?: string;
      avalanchePhoto?: string;
      additionalPhotos?: string[];
    }) => {
      if (!createdRunId) throw new Error("No run ID available");
      return await apiRequest("PATCH", `/api/runs/${createdRunId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update run with files", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !runNumber || !aspect || !averageAngle || !elevationMin || !elevationMax) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    if (!preselectedSubAreaId) {
      toast({ title: "Please select a sub-area first", variant: "destructive" });
      return;
    }
    
    createRunMutation.mutate({
      name: name.trim(),
      runNumber: parseInt(runNumber),
      aspect: aspect.toUpperCase(),
      averageAngle: averageAngle,
      elevationMin: parseInt(elevationMin),
      elevationMax: parseInt(elevationMax),
      status: status,
      statusComment: statusComment.trim() || null,
      subAreaId: preselectedSubAreaId,
      gpxPath: null, // Will be updated after file upload
      runPhoto: null, // Will be updated after file upload
      avalanchePhoto: null, // Will be updated after file upload
      additionalPhotos: null, // Will be updated after file upload
    });
  };

  // Handle file upload completion
  const handleFileUploadComplete = (fieldName: string, url: string) => {
    if (!createdRunId) {
      toast({ 
        title: "Please create the run first", 
        variant: "destructive" 
      });
      return;
    }

    // Update local state
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

    // Update database
    const updates: Record<string, unknown> = {};
    updates[fieldName] = fieldName === 'additionalPhotos' 
      ? [...(fieldName === 'additionalPhotos' ? additionalPhotos : []), url]
      : url;
    
    updateRunMutation.mutate(updates);
  };

  const resetForm = () => {
    setName("");
    setRunNumber("");
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
    setCreatedRunId(null);
    
    // Recalculate run number for the sub-area
    if (preselectedSubAreaId && runs.length > 0) {
      const runsInSubArea = runs.filter(run => run.subAreaId === preselectedSubAreaId);
      const maxRunNumber = runsInSubArea.length > 0 
        ? Math.max(...runsInSubArea.map(run => run.runNumber))
        : 0;
      setRunNumber((maxRunNumber + 1).toString());
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
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
            <div className="grid grid-cols-2 gap-4">
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
                <label htmlFor="runNumber" className="text-sm font-medium">
                  Run Number *
                </label>
                <Input
                  id="runNumber"
                  type="number"
                  value={runNumber}
                  onChange={(e) => setRunNumber(e.target.value)}
                  placeholder="Enter run number"
                  required
                />
              </div>
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

          {/* File Uploads */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Files & Media</h3>
            
            {/* GPX Track */}
            <div className="space-y-2">
              <label className="text-sm font-medium">GPX Track</label>
              {createdRunId ? (
                <FileUpload
                  runId={createdRunId}
                  fileType="gpx"
                  fieldName="gpxPath"
                  onUploadComplete={(url) => handleFileUploadComplete("gpxPath", url)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Create the run first to upload files</p>
              )}
              {gpxPath && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Upload className="w-4 h-4" />
                  <span>GPX file uploaded</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setGpxPath("");
                      if (createdRunId) {
                        updateRunMutation.mutate({ gpxPath: "" });
                      }
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Run Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Run Photo</label>
              {createdRunId ? (
                <FileUpload
                  runId={createdRunId}
                  fileType="image"
                  fieldName="runPhoto"
                  onUploadComplete={(url) => handleFileUploadComplete("runPhoto", url)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Create the run first to upload files</p>
              )}
              {runPhoto && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Upload className="w-4 h-4" />
                  <span>Run photo uploaded</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRunPhoto("");
                      if (createdRunId) {
                        updateRunMutation.mutate({ runPhoto: "" });
                      }
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Avalanche Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Avalanche Photo</label>
              {createdRunId ? (
                <FileUpload
                  runId={createdRunId}
                  fileType="image"
                  fieldName="avalanchePhoto"
                  onUploadComplete={(url) => handleFileUploadComplete("avalanchePhoto", url)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Create the run first to upload files</p>
              )}
              {avalanchePhoto && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <Upload className="w-4 h-4" />
                  <span>Avalanche photo uploaded</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAvalanchePhoto("");
                      if (createdRunId) {
                        updateRunMutation.mutate({ avalanchePhoto: "" });
                      }
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Additional Photos */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Photos</label>
              {createdRunId ? (
                <FileUpload
                  runId={createdRunId}
                  fileType="image"
                  fieldName="additionalPhotos"
                  onUploadComplete={(url) => handleFileUploadComplete("additionalPhotos", url)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Create the run first to upload files</p>
              )}
              {additionalPhotos.length > 0 && (
                <div className="space-y-2">
                  {additionalPhotos.map((photo, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm text-green-600">
                      <Upload className="w-4 h-4" />
                      <span>Additional photo {index + 1} uploaded</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newPhotos = additionalPhotos.filter((_, i) => i !== index);
                          setAdditionalPhotos(newPhotos);
                          if (createdRunId) {
                            updateRunMutation.mutate({ additionalPhotos: newPhotos });
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={resetForm}
              disabled={createRunMutation.isPending}
            >
              {createdRunId ? "Close" : "Cancel"}
            </Button>
            {!createdRunId && (
              <Button 
                type="submit" 
                disabled={createRunMutation.isPending || !name.trim() || !runNumber || !aspect || !averageAngle || !elevationMin || !elevationMax || !preselectedSubAreaId}
              >
                {createRunMutation.isPending ? "Creating..." : "Create Run"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

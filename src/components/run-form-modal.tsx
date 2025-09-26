"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import FileUpload from "@/components/file-upload";

interface RunFormModalProps {
  preselectedSubAreaId?: string;
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
  
  // Upload states for tracking upload progress
  const [uploadProgress, setUploadProgress] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate a temporary ID for file uploads (we'll use a timestamp-based ID)
  const [tempRunId] = useState(() => `temp-${Date.now()}`);

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
    }) => {
      return await apiRequest("POST", "/api/runs", runData);
    },
    onSuccess: () => {
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
      gpxPath: gpxPath || null,
      runPhoto: runPhoto || null,
      avalanchePhoto: avalanchePhoto || null,
      additionalPhotos: additionalPhotos.length > 0 ? additionalPhotos : null,
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
            <p className="text-sm text-muted-foreground">
              Upload files now - they will be included when you create the run.
            </p>
            
            {/* GPX Track */}
            <div className="space-y-2">
              <label className="text-sm font-medium">GPX Track</label>
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
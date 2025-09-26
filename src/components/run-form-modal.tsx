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
  const [tempRunId, setTempRunId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      setTempRunId((data as { id: string }).id);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !runNumber || !aspect || !averageAngle || !elevationMin || !elevationMax || !preselectedSubAreaId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
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
      gpxPath: gpxPath || null,
      runPhoto: runPhoto || null,
      avalanchePhoto: avalanchePhoto || null,
      additionalPhotos: additionalPhotos.length > 0 ? additionalPhotos : null,
    });
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
    setTempRunId(null);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
              {tempRunId ? (
                <FileUpload
                  runId={tempRunId}
                  fileType="gpx"
                  fieldName="gpxPath"
                  onUploadComplete={(url) => setGpxPath(url)}
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
                    onClick={() => setGpxPath("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Run Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Run Photo</label>
              {tempRunId ? (
                <FileUpload
                  runId={tempRunId}
                  fileType="image"
                  fieldName="runPhoto"
                  onUploadComplete={(url) => setRunPhoto(url)}
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
                    onClick={() => setRunPhoto("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Avalanche Photo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Avalanche Photo</label>
              {tempRunId ? (
                <FileUpload
                  runId={tempRunId}
                  fileType="image"
                  fieldName="avalanchePhoto"
                  onUploadComplete={(url) => setAvalanchePhoto(url)}
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
                    onClick={() => setAvalanchePhoto("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Additional Photos */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Photos</label>
              {tempRunId ? (
                <FileUpload
                  runId={tempRunId}
                  fileType="image"
                  fieldName="additionalPhotos"
                  onUploadComplete={(url) => setAdditionalPhotos(prev => [...prev, url])}
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
                        onClick={() => setAdditionalPhotos(prev => prev.filter((_, i) => i !== index))}
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
              onClick={handleClose}
              disabled={createRunMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createRunMutation.isPending || !name.trim() || !runNumber || !aspect || !averageAngle || !elevationMin || !elevationMax || !preselectedSubAreaId}
            >
              {createRunMutation.isPending ? "Creating..." : "Create Run"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

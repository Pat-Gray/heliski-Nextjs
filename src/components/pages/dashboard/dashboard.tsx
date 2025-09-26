"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mountain, Plus, CheckCircle, MapPin, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryFn } from "@/lib/queryClient";
import RunDetailView from "@/components/run-detail-view";
import NZTopoMap from "@/components/nz-topo-map";
import ImageModal from "@/components/image-modal";
import AvalancheRiskAssessment from "@/components/dashboard-filters";
import { usePrint } from "@/components/print-provider";
import type { Run, InsertDailyPlan, Area, SubArea } from "@/lib/schemas/schema";

export default function Dashboard() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [focusStatusComment, setFocusStatusComment] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [showAreaSelection, setShowAreaSelection] = useState(true);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [existingDailyPlan, setExistingDailyPlan] = useState<{ id: string } | null>(null);
  const [showOverrideOption, setShowOverrideOption] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedAreaForMap, setSelectedAreaForMap] = useState<string | null>(null);
  const [selectedSubAreaForMap, setSelectedSubAreaForMap] = useState<string | null>(null);
  const [statusCommentInputs, setStatusCommentInputs] = useState<Record<string, string>>({});
  const updateTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedRunForImages, setSelectedRunForImages] = useState<Run | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setPrintData, triggerPrint } = usePrint();

  // Reset focus status comment after it's been used
  useEffect(() => {
    if (focusStatusComment) {
      const timer = setTimeout(() => {
        setFocusStatusComment(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusStatusComment]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(updateTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Clear timeouts when selected areas change
  useEffect(() => {
    Object.values(updateTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    updateTimeoutsRef.current = {};
  }, [selectedAreas]);

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

  // Filter runs based on selected areas
  const filteredRuns = runs.filter(run => {
    if (selectedAreas.size === 0) return true; // Show all runs if no areas selected
    const subArea = subAreas.find(sa => sa.id === run.subAreaId);
    return subArea && selectedAreas.has(subArea.areaId);
  });

  // Area selection handlers
  const handleAreaToggle = (areaId: string) => {
    const newSelected = new Set(selectedAreas);
    if (newSelected.has(areaId)) {
      newSelected.delete(areaId);
      if (selectedAreaForMap === areaId) {
        setShowMap(false);
        setSelectedAreaForMap(null);
        setSelectedSubAreaForMap(null);
      }
    } else {
      newSelected.add(areaId);
      setSelectedAreaForMap(areaId);
      setShowMap(true);
    }
    setSelectedAreas(newSelected);
  };

 

  const handleViewMap = (subAreaId: string) => {
    // Find the area ID for this sub-area
    const subArea = subAreas.find(sa => sa.id === subAreaId);
    if (subArea) {
      setSelectedAreaForMap(subArea.areaId);
      setSelectedSubAreaForMap(subAreaId);
      setShowMap(true);
    }
  };

  const handleViewImages = (run: Run) => {
    setSelectedRunForImages(run);
    setShowImageModal(true);
  };

  const handleStatusCommentChange = (runId: string, comment: string) => {
    setStatusCommentInputs(prev => ({ ...prev, [runId]: comment }));
  };

  const handleAvalancheRiskAssessment = (assessment: {
    strategicMindset: string;
    primaryHazard: string;
    secondaryFactors: {
      newSnow: boolean;
      windLoading: boolean;
      temperatureRise: boolean;
      windSpeed: string;
      visibility: string;
    };
  }) => {
    // Apply risk assessment logic to suggest run statuses
    // This is where you would implement the avalanche risk assessment logic
    console.log("Applying avalanche risk assessment:", assessment);
    
    // Example logic - you can expand this based on your requirements
    const riskLevel = calculateRiskLevel(assessment);
    
    // Apply suggested statuses to runs in selected areas
    const runsToUpdate = runs.filter(run => {
      const subArea = subAreas.find(sa => sa.id === run.subAreaId);
      return subArea && selectedAreas.has(subArea.areaId) && 
        (run.status === 'open' || run.status === 'conditional');
    });
    
    runsToUpdate.forEach(run => {
      const suggestedStatus = getSuggestedStatus(run, riskLevel);
      if (suggestedStatus !== run.status) {
        updateRunStatusMutation.mutate({
          runId: run.id,
          status: suggestedStatus,
          statusComment: `Risk assessment: ${assessment.strategicMindset} mindset - ${assessment.primaryHazard} - ${riskLevel} risk`
        });
      }
    });
    
    toast({
      title: "Risk Assessment Applied",
      description: `Applied ${assessment.strategicMindset} mindset (${riskLevel} risk) to ${runsToUpdate.length} runs`,
    });
  };

  const calculateRiskLevel = (assessment: {
    strategicMindset: string;
    primaryHazard: string;
    secondaryFactors: {
      newSnow: boolean;
      windLoading: boolean;
      temperatureRise: boolean;
      windSpeed: string;
      visibility: string;
    };
  }): string => {
    let riskScore = 0;
    
    // Strategic mindset adjustment
    const mindsetAdjustments: Record<string, number> = {
      'Very Conservative': -2,  // Reduces risk score (more cautious)
      'Conservative': -1,
      'Moderate': 0,
      'Aggressive': 1,          // Increases risk score (less cautious)
      'Very Aggressive': 2
    };
    riskScore += mindsetAdjustments[assessment.strategicMindset] || 0;
    
    // Primary hazard scoring
    const hazardScores: Record<string, number> = {
      'Wind Slab': 3,
      'Storm Slab': 2,
      'Persistent Slab': 4,
      'Wet Slab': 3,
      'Cornice Fall': 2,
      'Loose Snow': 1,
      'Glide Avalanche': 4
    };
    riskScore += hazardScores[assessment.primaryHazard] || 0;
    
    // Secondary factors
    if (assessment.secondaryFactors.newSnow) riskScore += 2;
    if (assessment.secondaryFactors.windLoading) riskScore += 2;
    if (assessment.secondaryFactors.temperatureRise) riskScore += 1;
    
    // Wind speed
    const windScores: Record<string, number> = {
      'calm': 0,
      'light': 1,
      'moderate': 2,
      'strong': 3,
      'very-strong': 4
    };
    riskScore += windScores[assessment.secondaryFactors.windSpeed] || 0;
    
    // Visibility
    const visibilityScores: Record<string, number> = {
      'excellent': 0,
      'good': 1,
      'fair': 2,
      'poor': 3,
      'very-poor': 4
    };
    riskScore += visibilityScores[assessment.secondaryFactors.visibility] || 0;
    
    if (riskScore >= 8) return 'high';
    if (riskScore >= 5) return 'moderate';
    return 'low';
  };

  const getSuggestedStatus = (run: Run, riskLevel: string): string => {
    // Base status on risk level and run characteristics
    if (riskLevel === 'high') {
      return 'closed';
    } else if (riskLevel === 'moderate') {
      // Consider run angle and exposure
      const angle = parseFloat(run.averageAngle);
      if (angle > 40) { // Very steep runs
        return 'closed';
      }
      return 'conditional';
    } else {
      return 'open';
    }
  };

  // Run status update mutation with optimistic updates
  const updateRunStatusMutation = useMutation({
    mutationFn: async ({ runId, status, statusComment }: { runId: string; status: string; statusComment?: string | null }) => {
      const updateData: { status: string; statusComment?: string | null } = { status };
      if (statusComment !== undefined) {
        updateData.statusComment = statusComment;
      }
      const response = await apiRequest("PUT", `/api/runs/${runId}`, updateData);
      return response.json();
    },
    onMutate: async ({ runId, status, statusComment }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/runs"] });

      // Snapshot the previous value
      const previousRuns = queryClient.getQueryData<Run[]>(["/api/runs"]);

      // Optimistically update the cache
      queryClient.setQueryData<Run[]>(["/api/runs"], (old) => {
        if (!old) return old;
        return old.map(run => 
          run.id === runId 
            ? { 
                ...run, 
                status: status as 'open' | 'conditional' | 'closed',
                statusComment: statusComment !== undefined ? statusComment : run.statusComment,
                lastUpdated: new Date()
              }
            : run
        );
      });

      // Return a context object with the snapshotted value
      return { previousRuns };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousRuns) {
        queryClient.setQueryData(["/api/runs"], context.previousRuns);
      }
      toast({ 
        title: "Failed to update run status", 
        description: "Changes have been reverted. Please try again.",
        variant: "destructive" 
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
    },
    onSuccess: () => {
      // Silent success for instant updates - no toast needed
    },
  });

  const handleRunStatusChange = (runId: string, status: 'open' | 'conditional' | 'closed') => {
    console.log('Status change:', { runId, status });
    
    // Clear any existing timeout for this run
    if (updateTimeoutsRef.current[runId]) {
      clearTimeout(updateTimeoutsRef.current[runId]);
    }
    
    // Prepare update data
    const updateData: { status: string; statusComment?: string | null } = { status };
    if (status === 'open' || status === 'closed') {
      updateData.statusComment = null;
      // Clear local input state
      setStatusCommentInputs(prev => {
        const newState = { ...prev };
        delete newState[runId];
        return newState;
      });
    }
    
    // Call the mutation with optimistic updates
    updateRunStatusMutation.mutate({ runId, status, statusComment: updateData.statusComment });
    
    // If changing to conditional, focus the input after a short delay
    if (status === 'conditional') {
      setTimeout(() => {
        const input = document.querySelector(`input[data-run-id="${runId}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }
  };

  const saveComment = (runId: string) => {
    const comment = statusCommentInputs[runId] || '';
    console.log('Saving comment for run:', runId, 'comment:', comment);
    if (comment.trim()) {
      // Use optimistic updates for comment saving
      updateRunStatusMutation.mutate({ runId, status: 'conditional', statusComment: comment });
    }
  };

  // Auto-save comment with debouncing - completely seamless
  const autoSaveComment = (runId: string) => {
    // Clear any existing timeout for this run
    if (updateTimeoutsRef.current[runId]) {
      clearTimeout(updateTimeoutsRef.current[runId]);
    }
    
    // Set a new timeout for auto-save
    updateTimeoutsRef.current[runId] = setTimeout(() => {
      const comment = statusCommentInputs[runId] || '';
      if (comment.trim()) {
        console.log('Auto-saving comment for run:', runId, 'comment:', comment);
        // Save seamlessly without any visual indicators
        updateRunStatusMutation.mutate({ 
          runId, 
          status: 'conditional', 
          statusComment: comment 
        });
      }
    }, 300); // Very fast auto-save for seamless experience
  };
  
  const submitDailyPlanMutation = useMutation({
    mutationFn: async (planData: InsertDailyPlan) => {
      const response = await apiRequest("POST", "/api/daily-plans", planData);
      if (!response.ok) {
        let errorMessage: string;
        
        if (response.status === 409) {
          // Handle duplicate plan conflict
          const errorData = await response.json().catch(() => ({ error: "Duplicate daily plan" }));
          errorMessage = errorData.details || "A daily plan for this date already exists";
        } else {
          // Handle other errors
          const errorText = await response.text();
          errorMessage = `Failed to submit daily plan (${response.status}): ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-plans"] });
      toast({ 
        title: "Daily plan submitted successfully", 
        description: "All current run statuses and comments have been saved as a structured snapshot."
      });
      // Set print data and trigger print
      setPrintData({
        areas,
        subAreas,
        filteredRuns,
        selectedAreas,
        currentDate: currentDate || new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        greenCount,
        orangeCount,
        redCount,
      });
      
      // Trigger print with a small delay to ensure content is ready
      setTimeout(() => {
        console.log('🖨️ Triggering print dialog...');
        triggerPrint();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to submit daily plan", 
        description: error.message || "An unexpected error occurred",
        variant: "destructive" 
      });
    },
  });

  const greenCount = filteredRuns.filter(run => run.status === "open").length;
  const orangeCount = filteredRuns.filter(run => run.status === "conditional").length;
  const redCount = filteredRuns.filter(run => run.status === "closed").length;

  const [currentDate, setCurrentDate] = useState<string>('');

  // Set current date on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }));
  }, []);
  
  const handleSubmitDailyPlan = async () => {
    if (filteredRuns.length === 0) {
      toast({ 
        title: "No runs available", 
        description: "Cannot create daily plan without runs",
        variant: "destructive" 
      });
      return;
    }

    // Check if a daily plan already exists for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    try {
      const response = await fetch(`/api/daily-plans/by-date/${todayStart.toISOString()}`);
      if (response.ok) {
        const existingPlan = await response.json();
        setExistingDailyPlan(existingPlan);
        setShowOverrideOption(true);
        setShowConfirmationModal(true);
        return;
      }
    } catch (error) {
      console.error('Error checking existing daily plan:', error);
    }
    
    // No existing plan, proceed normally
    setExistingDailyPlan(null);
    setShowOverrideOption(false);
    setShowConfirmationModal(true);
  };

  const handleConfirmSubmitDailyPlan = async () => {
    setShowConfirmationModal(false);
    setShowOverrideOption(false);
    
    // If we have an existing plan and user wants to override, delete it first
    if (existingDailyPlan && showOverrideOption) {
      try {
        const deleteResponse = await fetch(`/api/daily-plans/${existingDailyPlan.id}`, {
          method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
          toast({ 
            title: "Failed to delete existing plan", 
            description: "Could not remove the existing daily plan. Please try again.",
            variant: "destructive" 
          });
          return;
        }
        
        toast({ 
          title: "Existing plan deleted", 
          description: "Previous daily plan has been removed. Creating new plan...",
        });
      } catch {
        toast({ 
          title: "Error deleting existing plan", 
          description: "Failed to remove existing daily plan. Please try again.",
          variant: "destructive" 
        });
        return;
      }
    }
    
    // Create structured status snapshot
    const statusSnapshot = filteredRuns.map(run => ({
      runId: run.id,
      status: run.status as 'open' | 'conditional' | 'closed',
      statusComment: run.statusComment || null,
    }));
    
    // Generate summary notes with current status and comments for reference
    const statusSummary = filteredRuns.map(run => {
      let summary = `${run.name}: ${run.status.toUpperCase()}`;
      if (run.statusComment) {
        summary += ` - ${run.statusComment}`;
      }
      return summary;
    }).join('\n');
    
    const planNotes = `Daily Plan Summary - ${currentDate || new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n\nRun Status:\n${statusSummary}`;
    
    // Normalize date to avoid timezone issues
    const normalizedDate = new Date();
    normalizedDate.setHours(0, 0, 0, 0);
    
    console.log('Creating daily plan with data:', {
      planDate: normalizedDate.toISOString(),
      runIds: filteredRuns.map(run => run.id),
      statusSnapshot,
      notes: planNotes,
    });
    
    submitDailyPlanMutation.mutate({
      planDate: normalizedDate,
      runIds: filteredRuns.map(run => run.id),
      statusSnapshot,
      notes: planNotes,
    });
  };


  // Don't render until date is loaded to prevent hydration issues
  if (!currentDate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top Header */}
      <header className="no-print bg-card border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Run Management</h2>
              <p className="text-muted-foreground">Today: <span data-testid="text-current-date">{currentDate || 'Loading...'}</span></p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={handleSubmitDailyPlan}
              disabled={submitDailyPlanMutation.isPending}
              data-testid="button-submit-daily-plan"
            >
              <Plus className="w-4 h-4 mr-2" />
              {submitDailyPlanMutation.isPending ? "Submitting..." : "Submit Daily Plan"}
            </Button>
            <Button 
              onClick={() => {
                console.log('🖨️ Manual print test...');
                setPrintData({
                  areas,
                  subAreas,
                  filteredRuns,
                  selectedAreas,
                  currentDate: currentDate || new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }),
                  greenCount,
                  orangeCount,
                  redCount,
                });
                setTimeout(() => triggerPrint(), 100);
              }}
              variant="outline"
              className="ml-2"
            >
              Test Print
            </Button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 flex min-h-0">
        {/* Runs List */}
        <div className="w-1/2 border-r border-border overflow-y-auto">
          <div className="p-6">
            {/* Area Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Area Selection</h3>
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={() => setShowAreaSelection(!showAreaSelection)}
                    variant="outline"
                  >
                    <Mountain className="w-4 h-4 mr-2" />
                    {showAreaSelection ? "Hide Areas" : "Show Areas"}
                  </Button>
                  
                  {selectedAreas.size > 0 && (
                    <AvalancheRiskAssessment onApplyRiskAssessment={handleAvalancheRiskAssessment} />
                  )}
                </div>
              </div>

              {/* Area Selection Grid */}
              {showAreaSelection && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {areas.map(area => (
                    <Card 
                      key={area.id} 
                      className={`cursor-pointer transition-all ${
                        selectedAreas.has(area.id) 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => handleAreaToggle(area.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Mountain className="w-5 h-5 text-primary" />
                            <div>
                              <h4 className="font-medium">{area.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {subAreas.filter(sa => sa.areaId === area.id).length} sub-areas
                              </p>
                            </div>
                          </div>
                          {selectedAreas.has(area.id) && (
                            <CheckCircle className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Runs Display */}
            <div className="space-y-4">
              {filteredRuns.length === 0 ? (
                <div className="text-center py-8">
                  <Mountain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {selectedAreas.size === 0 
                      ? "Select areas to view runs" 
                      : "No runs found in selected areas"}
                  </p>
                </div>
              ) : (
                // Group runs by area and sub-area
                areas
                  .filter(area => selectedAreas.has(area.id))
                  .map(area => {
                    const areaSubAreas = subAreas.filter(sa => sa.areaId === area.id);
                    const areaRuns = filteredRuns.filter(run => {
                      const subArea = subAreas.find(sa => sa.id === run.subAreaId);
                      return subArea && subArea.areaId === area.id;
                    }).sort((a, b) => a.runNumber - b.runNumber);

                    if (areaRuns.length === 0) return null;

                    return (
                      <Card key={area.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Mountain className="w-5 h-5 mr-2" />
                            {area.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {areaSubAreas.map(subArea => {
                              const subAreaRuns = areaRuns.filter(run => run.subAreaId === subArea.id).sort((a, b) => a.runNumber - b.runNumber);
                              if (subAreaRuns.length === 0) return null;

                              return (
                                <div key={subArea.id} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm text-muted-foreground flex items-center">
                                      <MapPin className="w-4 h-4 mr-1" />
                                      {subArea.name}
                                    </h4>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewMap(subArea.id)}
                                      className="text-xs"
                                    >
                                      View Map
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    {subAreaRuns.map(run => (
                                      <div 
                                        key={run.id} 
                                        className={`p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                                          run.status === "open" 
                                            ? "border-green-200 bg-green-50" 
                                            : run.status === "conditional" 
                                            ? "border-orange-200 bg-orange-50" 
                                            : "border-red-200 bg-red-50"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center space-x-3">
                                            <div className={`w-3 h-3 rounded-full ${
                                              run.status === "open" 
                                                ? "bg-green-500" 
                                                : run.status === "conditional" 
                                                ? "bg-orange-500" 
                                                : "bg-red-500"
                                            }`} />
                                            <div>
                                              <div className="font-medium">#{run.runNumber} {run.name}</div>
                                              <div className="text-sm text-muted-foreground">
                                                {run.aspect} • {run.averageAngle} • {run.elevationMax}-{run.elevationMin}m
                                              </div>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleViewImages(run)}
                                              className="text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                            >
                                              <Image className="w-3 h-3 mr-1" />
                                              Images
                                            </Button>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <Button
                                              size="sm"
                                              variant={run.status === "open" ? "default" : "outline"}
                                              onClick={() => handleRunStatusChange(run.id, "open")}
                                              className={`${
                                                run.status === "open" 
                                                  ? "bg-green-500 hover:bg-green-600 text-white" 
                                                  : "hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                              }`}
                                            >
                                              Open
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant={run.status === "conditional" ? "default" : "outline"}
                                              onClick={() => handleRunStatusChange(run.id, "conditional")}
                                              className={`${
                                                run.status === "conditional" 
                                                  ? "bg-orange-500 hover:bg-orange-600 text-white" 
                                                  : "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                                              }`}
                                            >
                                              Conditional
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant={run.status === "closed" ? "default" : "outline"}
                                              onClick={() => handleRunStatusChange(run.id, "closed")}
                                              className={`${
                                                run.status === "closed" 
                                                  ? "bg-red-500 hover:bg-red-600 text-white" 
                                                  : "hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                              }`}
                                            >
                                              Closed
                                            </Button>
                                          </div>
                                        </div>
                                        {run.status === "conditional" && (
                                          <div className="mt-2">
                                            <Input
                                              data-run-id={run.id}
                                              placeholder="Enter status comment..."
                                              value={statusCommentInputs[run.id] || run.statusComment || ""}
                                              onChange={(e) => {
                                                handleStatusCommentChange(run.id, e.target.value);
                                                autoSaveComment(run.id); // Trigger auto-save on change
                                              }}
                                              onBlur={() => saveComment(run.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.currentTarget.blur(); // This will trigger onBlur and save
                                                }
                                              }}
                                              className="w-full"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Map or Run Detail View */}
        <div className="w-1/2 overflow-y-auto">
          {showMap && selectedAreaForMap ? (
            <NZTopoMap
              areaId={selectedAreaForMap}
              subAreaId={selectedSubAreaForMap ?? undefined}
              onRunSelect={(runId) => {
                setSelectedRunId(runId);
                setShowMap(false); // Switch back to run detail view
              }}
              selectedRunId={selectedRunId ?? undefined}
              onClose={() => {
                setShowMap(false);
                setSelectedAreaForMap(null);
                setSelectedSubAreaForMap(null);
              }}
            />
          ) : (
            <RunDetailView 
              runId={selectedRunId} 
              focusStatusComment={focusStatusComment}
            />
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showOverrideOption ? 'Override Existing Daily Plan' : 'Confirm Daily Plan Submission'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {showOverrideOption && existingDailyPlan ? (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">⚠️ Daily Plan Already Exists</h4>
                  <p className="text-orange-700">
                    A daily plan for today already exists (ID: {existingDailyPlan.id.slice(0, 8)}...)
                  </p>
                  <p className="text-orange-700 mt-2">
                    Would you like to replace it with the current run statuses?
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">New Plan Summary:</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{greenCount}</div>
                      <div className="text-sm text-muted-foreground">Open</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{orangeCount}</div>
                      <div className="text-sm text-muted-foreground">Conditional</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{redCount}</div>
                      <div className="text-sm text-muted-foreground">Closed</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Selected Areas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedAreas).map(areaId => {
                      const area = areas.find(a => a.id === areaId);
                      return (
                        <Badge key={areaId} variant="secondary">
                          {area?.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Run Summary:</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{greenCount}</div>
                      <div className="text-sm text-muted-foreground">Open</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{orangeCount}</div>
                      <div className="text-sm text-muted-foreground">Conditional</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{redCount}</div>
                      <div className="text-sm text-muted-foreground">Closed</div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total runs: {filteredRuns.length} from {selectedAreas.size} area{selectedAreas.size !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowConfirmationModal(false);
              setShowOverrideOption(false);
              setExistingDailyPlan(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSubmitDailyPlan} 
              disabled={submitDailyPlanMutation.isPending}
              className={showOverrideOption ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              {submitDailyPlanMutation.isPending 
                ? "Submitting..." 
                : showOverrideOption 
                  ? "Replace Daily Plan" 
                  : "Submit Daily Plan"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <ImageModal
        isOpen={showImageModal}
        onClose={() => {
          setShowImageModal(false);
          setSelectedRunForImages(null);
        }}
        run={selectedRunForImages}
      />
    </div>
  );
}

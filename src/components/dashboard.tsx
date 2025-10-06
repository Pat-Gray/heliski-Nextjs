"use client";

import React, { useMemo, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { GripVertical, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { usePrint } from "@/components/print-provider";
import RunDetailView from "@/components/run-detail-view";
import RunDetailSideModal from "@/components/modals/run-detail-side-modal";
import { useDashboardState } from "@/hooks/use-dashboard-state";
import AreaSelector from "@/components/dashboard/area-selector";
import RunList from "@/components/dashboard/run-list";
import MapControls from "@/components/dashboard/map-controls";
import StatusUpdatePanel from "@/components/dashboard/status-update-panel";
import DailyPlanModal from "@/components/dashboard/daily-plan-modal";
import { apiRequest } from "@/lib/queryClient";
import type { InsertDailyPlan } from "@/lib/schemas/schema";

const NZTopoMap = dynamic(() => import("@/components/maps/nz-topo-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-muted/20">
      <div className="flex flex-col items-center space-y-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Loading map...</p>
          <p className="text-xs text-muted-foreground">Initializing map component</p>
        </div>
      </div>
    </div>
  )
});

const Dashboard = React.memo(function Dashboard() {
  const {
    // State
    selectedRunId,
    focusStatusComment,
    selectedAreas,
    showAreaSelection,
    showConfirmationModal,
    existingDailyPlan,
    showOverrideOption,
    selectedAreaForMap,
    selectedSubAreaForMap,
    showAvalanchePaths,
    showOperations,
    statusCommentInputs,
    autoOpenComment,
    hoveredRunId,
    showRunDetailModal,
    modalRunId,
    leftPanelWidth,
    isResizing,
    isLargeScreen,
    resizeRef,
    updateTimeoutsRef,
    
    // Data
    runs,
    areas,
    subAreas,
    
    // Setters
    setShowAreaSelection,
    setShowConfirmationModal,
    setExistingDailyPlan,
    setShowOverrideOption,
    setSelectedAreaForMap,
    setSelectedSubAreaForMap,
    setShowAvalanchePaths,
    setShowOperations,
    setStatusCommentInputs,
    setAutoOpenComment,
    setHoveredRunId,
    setShowRunDetailModal,
    setModalRunId,
    setLeftPanelWidth,
    setIsResizing,
    setFocusStatusComment,
    
    // Handlers
    handleAreaToggle,
    handleViewMap,
    handleViewRunDetails,
    handleMapClose,
    handleStatusCommentChange,
    handleAvalancheRiskAssessment,
    
    // Other
    toast,
    queryClient,
  } = useDashboardState();

  const { setPrintData, triggerPrint } = usePrint();

  // Filter runs based on selected areas
  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      if (selectedAreas.size === 0) return true;
      const subArea = subAreas.find(sa => sa.id === run.subAreaId);
      return subArea && selectedAreas.has(subArea.areaId);
    });
  }, [runs, selectedAreas, subAreas]);

  // Status counts
  const greenCount = filteredRuns.filter(run => run.status === "open").length;
  const orangeCount = filteredRuns.filter(run => run.status === "conditional").length;
  const redCount = filteredRuns.filter(run => run.status === "closed").length;

  // Current date
  const currentDate = new Date().toISOString().split('T')[0];

  // Run status update mutation
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
      await queryClient.cancelQueries({ queryKey: ["/api/runs"] });
      const previousRuns = queryClient.getQueryData<typeof runs>(["/api/runs"]);
      queryClient.setQueryData<typeof runs>(["/api/runs"], (old) => {
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
      return { previousRuns };
    },
    onError: (err, variables, context) => {
      if (context?.previousRuns) {
        queryClient.setQueryData(["/api/runs"], context.previousRuns);
      }
      toast({ 
        title: "Failed to update run status", 
        description: "Changes have been reverted. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const handleRunStatusChange = useCallback((runId: string, status: 'open' | 'conditional' | 'closed') => {
    if (updateTimeoutsRef.current[runId]) {
      clearTimeout(updateTimeoutsRef.current[runId]);
    }
    
    const updateData: { status: string; statusComment?: string | null } = { status };
    if (status === 'open' || status === 'closed') {
      updateData.statusComment = null;
      setStatusCommentInputs(prev => {
        const newState = { ...prev };
        delete newState[runId];
        return newState;
      });
    }
    
    updateRunStatusMutation.mutate({ runId, status, statusComment: updateData.statusComment });
    
    if (status === 'conditional') {
      setAutoOpenComment(runId);
      setTimeout(() => {
        setAutoOpenComment(null);
      }, 100);
    }
  }, [updateRunStatusMutation, setStatusCommentInputs, setAutoOpenComment]);

  const saveComment = useCallback((runId: string) => {
    setStatusCommentInputs(current => {
      const comment = current[runId] || '';
      updateRunStatusMutation.mutate({ runId, status: 'conditional', statusComment: comment });
      return current;
    });
  }, [updateRunStatusMutation, setStatusCommentInputs]);

  const autoSaveComment = useCallback((runId: string) => {
    if (updateTimeoutsRef.current[runId]) {
      clearTimeout(updateTimeoutsRef.current[runId]);
    }
    
    updateTimeoutsRef.current[runId] = setTimeout(() => {
      setStatusCommentInputs(current => {
        const comment = current[runId] || '';
        updateRunStatusMutation.mutate({ 
          runId, 
          status: 'conditional', 
          statusComment: comment 
        });
        return current;
      });
    }, 300);
  }, [updateRunStatusMutation, setStatusCommentInputs]);

  const submitDailyPlanMutation = useMutation({
    mutationFn: async (planData: InsertDailyPlan) => {
      const response = await apiRequest("POST", "/api/daily-plans", planData);
      if (!response.ok) {
        let errorMessage: string;
        
        if (response.status === 409) {
          const errorData = await response.json().catch(() => ({ error: "Duplicate daily plan" }));
          errorMessage = errorData.details || "A daily plan for this date already exists";
        } else {
          const errorText = await response.text();
          errorMessage = `Failed to submit daily plan (${response.status}): ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      
      toast({ 
        title: "Daily plan submitted successfully", 
        description: "All current run statuses and comments have been saved as a structured snapshot."
      });
      
      const printData = {
        areas,
        subAreas,
        filteredRuns,
        selectedAreas,
        currentDate: currentDate || new Date().toISOString().split('T')[0],
        greenCount,
        orangeCount,
        redCount,
      };
      setPrintData(printData);
    },
  });

  const _handleSubmitDailyPlan = useCallback(async () => {
    if (filteredRuns.length === 0) {
      toast({ 
        title: "No runs available", 
        description: "Cannot create daily plan without runs",
        variant: "destructive" 
      });
      return;
    }

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
    
    setExistingDailyPlan(null);
    setShowOverrideOption(false);
    setShowConfirmationModal(true);
  }, [filteredRuns.length, toast, setExistingDailyPlan, setShowOverrideOption, setShowConfirmationModal]);

  const handleConfirmSubmitDailyPlan = useCallback(async () => {
    setShowConfirmationModal(false);
    setShowOverrideOption(false);
    
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
    
    const statusSnapshot = filteredRuns.map(run => ({
      runId: run.id,
      status: run.status as 'open' | 'conditional' | 'closed',
      statusComment: run.statusComment || null,
    }));
    
    const currentDateStr = currentDate || new Date().toISOString().split('T')[0];
    const statusSummary = filteredRuns
      .map(run => {
        let summary = `${run.name}: ${run.status.toUpperCase()}`;
        if (run.statusComment) {
          summary += ` - ${run.statusComment}`;
        }
        return summary;
      })
      .join('\n');
    
    const planNotes = `Daily Plan Summary - ${currentDateStr}\n\nRun Status:\n${statusSummary}`;
    
    const normalizedDate = new Date();
    normalizedDate.setHours(0, 0, 0, 0);
    
    submitDailyPlanMutation.mutate({
      planDate: normalizedDate,
      runIds: filteredRuns.map(run => run.id),
      statusSnapshot,
      notes: planNotes,
    });
  }, [existingDailyPlan, showOverrideOption, filteredRuns, currentDate, submitDailyPlanMutation, toast, setShowConfirmationModal, setShowOverrideOption]);

  const handleToggleAvalanchePaths = useCallback(() => {
    console.log('🔄 Toggling avalanche paths:', !showAvalanchePaths);
    setShowAvalanchePaths(!showAvalanchePaths);
  }, [showAvalanchePaths, setShowAvalanchePaths]);

  const handleToggleOperations = useCallback(() => {
    console.log('🔄 Toggling operations:', !showOperations);
    setShowOperations(!showOperations);
  }, [showOperations, setShowOperations]);

  const handleCloseModal = useCallback(() => {
    setShowConfirmationModal(false);
    setShowOverrideOption(false);
    setExistingDailyPlan(null);
  }, [setShowConfirmationModal, setShowOverrideOption, setExistingDailyPlan]);

  const handleCloseRunDetailModal = useCallback(() => {
    setShowRunDetailModal(false);
    setModalRunId(null);
  }, [setShowRunDetailModal, setModalRunId]);

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
    <div className={`h-full flex flex-col ${isResizing ? 'select-none' : ''}`}>
      {/* Content Area - Fixed height with scrolling */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden" ref={resizeRef}>
        {/* Runs List */}
        <div 
          className="w-full lg:border-r border-b lg:border-b-0 border-border flex flex-col min-h-0"
          style={{ width: isLargeScreen ? `${leftPanelWidth}%` : '100%' }}
        >
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">
              <AreaSelector
                areas={areas}
                subAreas={subAreas}
                selectedAreas={selectedAreas}
                showAreaSelection={showAreaSelection}
                onAreaToggle={handleAreaToggle}
                onToggleAreaSelection={() => setShowAreaSelection(!showAreaSelection)}
                onApplyRiskAssessment={handleAvalancheRiskAssessment}
              />

              <RunList
                filteredRuns={filteredRuns}
                areas={areas}
                subAreas={subAreas}
                selectedAreas={selectedAreas}
                statusCommentInputs={statusCommentInputs}
                autoOpenComment={autoOpenComment}
                hoveredRunId={hoveredRunId}
                onRunStatusChange={handleRunStatusChange}
                onStatusCommentChange={handleStatusCommentChange}
                onAutoSaveComment={autoSaveComment}
                onSaveComment={saveComment}
                onViewMap={handleViewMap}
                onViewRunDetails={handleViewRunDetails}
                onHoverRun={setHoveredRunId}
              />

              <StatusUpdatePanel
                filteredRunsLength={filteredRuns.length}
                onSubmitDailyPlan={_handleSubmitDailyPlan}
                onTriggerPrint={triggerPrint}
                selectedAreasSize={selectedAreas.size}
              />
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          className="hidden lg:flex w-1 bg-border hover:bg-primary/20 cursor-col-resize items-center justify-center group transition-colors"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-muted-foreground/60 rounded-full flex items-center justify-center">
            <GripVertical className="w-3 h-3 text-muted-foreground/60 group-hover:text-muted-foreground" />
          </div>
        </div>

        {/* Map or Run Detail View */}
        <div 
          className="flex flex-col min-h-0 flex-1"
          style={{ width: isLargeScreen ? `${100 - leftPanelWidth}%` : '100%' }}
        >
          {/* Map - Only visible on xl screens and up (1280px+) */}
          <div className="hidden xl:block h-full w-full flex-1 relative">
            <MapControls
              showAvalanchePaths={showAvalanchePaths}
              showOperations={showOperations}
              onToggleAvalanchePaths={handleToggleAvalanchePaths}
              onToggleOperations={handleToggleOperations}
            />
            
            <NZTopoMap
              areaId={selectedAreaForMap}
              subAreaId={selectedSubAreaForMap}
              selectedRunId={selectedRunId}
              hoveredRunId={hoveredRunId}
              showAvalanchePaths={showAvalanchePaths}
              showOperations={showOperations}
              onClose={handleMapClose}
            />
          </div>
          {/* Run Detail View - Visible on screens below xl (below 1280px) */}
          <div className="xl:hidden h-full w-full overflow-y-auto flex-1">
            <RunDetailView 
              runId={selectedRunId} 
              focusStatusComment={focusStatusComment}
            />
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      <DailyPlanModal
        isOpen={showConfirmationModal}
        onClose={handleCloseModal}
        onSubmit={handleConfirmSubmitDailyPlan}
        showOverrideOption={showOverrideOption}
        existingDailyPlan={existingDailyPlan}
        selectedAreas={selectedAreas}
        areas={areas}
        greenCount={greenCount}
        orangeCount={orangeCount}
        redCount={redCount}
        filteredRunsLength={filteredRuns.length}
        isSubmitting={submitDailyPlanMutation.isPending}
      />

      {/* Run Detail Side Modal */}
      <RunDetailSideModal
        isOpen={showRunDetailModal}
        onClose={handleCloseRunDetailModal}
        runId={modalRunId}
        focusStatusComment={focusStatusComment}
      />
    </div>
  );
});

export default Dashboard;

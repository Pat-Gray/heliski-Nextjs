"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/hooks/use-toast";
import { apiRequest, queryFn } from "@/lib/queryClient";
import type { Run, InsertDailyPlan, Area, SubArea } from "@/lib/schemas/schema";

export function useDashboardState() {
  // State variables
  const [selectedRunId] = useState<string | null>(null);
  const [focusStatusComment, setFocusStatusComment] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [showAreaSelection, setShowAreaSelection] = useState(true);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [existingDailyPlan, setExistingDailyPlan] = useState<{ id: string } | null>(null);
  const [showOverrideOption, setShowOverrideOption] = useState(false);
  const [selectedAreaForMap, setSelectedAreaForMap] = useState<string | null>(null);
  const [selectedSubAreaForMap, setSelectedSubAreaForMap] = useState<string | null>(null);
  const [showAvalanchePaths, setShowAvalanchePaths] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [statusCommentInputs, setStatusCommentInputs] = useState<Record<string, string>>({});
  const [autoOpenComment, setAutoOpenComment] = useState<string | null>(null);
  const updateTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
  const [showRunDetailModal, setShowRunDetailModal] = useState(false);
  const [modalRunId, setModalRunId] = useState<string | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(33.33);
  const [isResizing, setIsResizing] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Data queries
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

  // Effects
  useEffect(() => {
    if (focusStatusComment) {
      const timer = setTimeout(() => {
        setFocusStatusComment(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusStatusComment]);

  useEffect(() => {
    return () => {
      Object.values(updateTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = resizeRef.current?.parentElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      const constrainedWidth = Math.min(Math.max(newLeftWidth, 20), 80);
      setLeftPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    Object.values(updateTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    updateTimeoutsRef.current = {};
  }, [selectedAreas]);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handlers
  const handleAreaToggle = useCallback((areaId: string) => {
    const newSelected = new Set(selectedAreas);
    if (newSelected.has(areaId)) {
      newSelected.delete(areaId);
      if (selectedAreaForMap === areaId) {
        if (newSelected.size > 0) {
          const remainingArea = areas.find(area => newSelected.has(area.id));
          if (remainingArea) {
            setSelectedAreaForMap(remainingArea.id);
          }
        } else {
          setSelectedAreaForMap(null);
          setSelectedSubAreaForMap(null);
        }
      }
    } else {
      newSelected.add(areaId);
      setSelectedAreaForMap(areaId);
    }
    setSelectedAreas(newSelected);
    
    const event = new CustomEvent('area-selection-changed', { detail: newSelected });
    window.dispatchEvent(event);
  }, [selectedAreas, selectedAreaForMap, areas]);

  const handleViewMap = useCallback((subAreaId: string) => {
    const subArea = subAreas.find(sa => sa.id === subAreaId);
    if (subArea) {
      setSelectedAreaForMap(subArea.areaId);
      setSelectedSubAreaForMap(subAreaId);
    }
  }, [subAreas]);

  const handleViewRunDetails = useCallback((run: Run) => {
    setModalRunId(run.id);
    setShowRunDetailModal(true);
  }, []);

  const handleMapClose = useCallback(() => {
    setSelectedAreaForMap(null);
    setSelectedSubAreaForMap(null);
  }, []);

  const handleStatusCommentChange = useCallback((runId: string, comment: string) => {
    setStatusCommentInputs(prev => ({ ...prev, [runId]: comment }));
  }, []);

  const handleAvalancheRiskAssessment = useCallback((assessment: {
    strategicMindset: string;
    primaryHazard: string;
    secondaryFactors: {
      newSnow: boolean;
      windLoading: boolean;
      temperatureRise: boolean;
      windSpeed: string;
      windDirection: string;
    };
  }) => {
    console.log("Applying avalanche risk assessment:", assessment);
  }, []);

  return {
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
  };
}

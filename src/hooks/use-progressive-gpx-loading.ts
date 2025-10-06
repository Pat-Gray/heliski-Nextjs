"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useGPXData, useBatchGPXData } from "./use-gpx-data";
import type { Run } from "@/lib/schemas/schema";

/**
 * Progressive loading system for GPX data
 * Loads GPX files in batches based on viewport and user interaction
 * Implements priority-based loading queue for optimal performance
 */

export interface Viewport {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentBatch: string[];
  isComplete: boolean;
}

export interface ProgressiveLoadingState {
  loadedRuns: Set<string>;
  loadingQueue: string[];
  progress: LoadingProgress;
  isLoading: boolean;
  error: string | null;
}

/**
 * Check if a run is within the current viewport
 */
function isInViewport(run: Run, viewport: Viewport, _tolerance: number = 0.1): boolean {
  // This is a simplified viewport check
  // In a real implementation, you'd use the run's bounds to check intersection
  // For now, we'll use a simple distance-based check
  
  if (!run.gpxPath) return false;
  
  // Default to true for now - in production, you'd check actual GPX bounds
  // against the viewport bounds
  return true;
}

/**
 * Calculate priority score for a run
 */
function calculatePriority(
  run: Run, 
  viewport: Viewport, 
  selectedRuns: Set<string>,
  recentlyViewed: Map<string, number>
): number {
  let priority = 0;
  
  // Priority 1: Runs in viewport (highest priority)
  if (isInViewport(run, viewport)) {
    priority += 1000;
  }
  
  // Priority 2: Selected runs
  if (selectedRuns.has(run.id)) {
    priority += 500;
  }
  
  // Priority 3: Recently viewed runs
  const lastViewed = recentlyViewed.get(run.id);
  if (lastViewed) {
    const timeSinceViewed = Date.now() - lastViewed;
    const hoursSinceViewed = timeSinceViewed / (1000 * 60 * 60);
    priority += Math.max(0, 100 - hoursSinceViewed * 10); // Decay over time
  }
  
  // Priority 4: Runs with GPX data (lower priority for fallback)
  if (run.gpxPath) {
    priority += 10;
  }
  
  return priority;
}

/**
 * Hook for progressive GPX loading
 */
export function useProgressiveGPXLoading(
  runs: Run[],
  viewport: Viewport,
  selectedRuns: Set<string> = new Set(),
  batchSize: number = 5
) {
  const [state, setState] = useState<ProgressiveLoadingState>({
    loadedRuns: new Set(),
    loadingQueue: [],
    progress: {
      loaded: 0,
      total: 0,
      percentage: 0,
      currentBatch: [],
      isComplete: false
    },
    isLoading: false,
    error: null
  });
  
  const recentlyViewedRef = useRef<Map<string, number>>(new Map());
  const { processBatch } = useBatchGPXData();
  
  /**
   * Prioritize runs based on viewport, selection, and recent viewing
   */
  const prioritizeRuns = useCallback((runs: Run[]): Run[] => {
    return runs
      .filter(run => !state.loadedRuns.has(run.id) && run.gpxPath)
      .sort((a, b) => {
        const priorityA = calculatePriority(a, viewport, selectedRuns, recentlyViewedRef.current);
        const priorityB = calculatePriority(b, viewport, selectedRuns, recentlyViewedRef.current);
        return priorityB - priorityA; // Higher priority first
      });
  }, [state.loadedRuns, viewport, selectedRuns]);
  
  /**
   * Load next batch of GPX files
   */
  const loadNextBatch = useCallback(async () => {
    if (state.isLoading) return;
    
    const nextBatch = prioritizeRuns(runs).slice(0, batchSize);
    if (nextBatch.length === 0) {
      setState(prev => ({
        ...prev,
        progress: { ...prev.progress, isComplete: true },
        isLoading: false
      }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: {
        ...prev.progress,
        currentBatch: nextBatch.map(run => run.id)
      }
    }));
    
    try {
      const batchForProcessing = nextBatch.map(run => ({
        id: run.id,
        gpxPath: run.gpxPath!,
        runNumber: run.runNumber,
        subAreaId: run.subAreaId
      }));
      const results = await processBatch(batchForProcessing);
      
      const newLoadedRuns = new Set(state.loadedRuns);
      let successCount = 0;
      
      results.forEach(result => {
        if (result.data) {
          newLoadedRuns.add(result.runId);
          successCount++;
        } else {
          console.warn(`Failed to load GPX for run ${result.runId}:`, result.error);
        }
      });
      
      setState(prev => ({
        ...prev,
        loadedRuns: newLoadedRuns,
        progress: {
          loaded: prev.progress.loaded + successCount,
          total: runs.length,
          percentage: Math.round(((prev.progress.loaded + successCount) / runs.length) * 100),
          currentBatch: [],
          isComplete: newLoadedRuns.size >= runs.filter(run => run.gpxPath).length
        },
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  }, [runs, state.isLoading, state.loadedRuns, prioritizeRuns, batchSize, processBatch]);
  
  /**
   * Mark a run as recently viewed
   */
  const markAsViewed = useCallback((runId: string) => {
    recentlyViewedRef.current.set(runId, Date.now());
  }, []);
  
  /**
   * Reset loading state
   */
  const resetLoading = useCallback(() => {
    setState({
      loadedRuns: new Set(),
      loadingQueue: [],
      progress: {
        loaded: 0,
        total: runs.length,
        percentage: 0,
        currentBatch: [],
        isComplete: false
      },
      isLoading: false,
      error: null
    });
  }, [runs.length]);
  
  /**
   * Auto-load when viewport changes or runs change
   */
  useEffect(() => {
    if (runs.length > 0 && !state.isLoading && !state.progress.isComplete) {
      const timeoutId = setTimeout(() => {
        loadNextBatch();
      }, 100); // Small delay to prevent rapid loading
      
      return () => clearTimeout(timeoutId);
    }
  }, [runs, viewport, selectedRuns, state.isLoading, state.progress.isComplete, loadNextBatch]);
  
  /**
   * Update progress when runs change
   */
  useEffect(() => {
    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        total: runs.length,
        percentage: runs.length > 0 ? Math.round((prev.loadedRuns.size / runs.length) * 100) : 0,
        isComplete: runs.length > 0 && prev.loadedRuns.size >= runs.filter(run => run.gpxPath).length
      }
    }));
  }, [runs]);
  
  return {
    ...state,
    loadNextBatch,
    markAsViewed,
    resetLoading,
    isRunLoaded: (runId: string) => state.loadedRuns.has(runId),
    getLoadedRuns: () => runs.filter(run => state.loadedRuns.has(run.id))
  };
}

/**
 * Hook for individual run GPX data with progressive loading
 */
export function useProgressiveGPXData(
  run: Run,
  viewport: Viewport,
  isPriority: boolean = false
) {
  const { data, isLoading, error } = useGPXData(
    run.id,
    run.gpxPath || '',
    run.runNumber,
    run.subAreaId,
    isPriority // Only load immediately if marked as priority
  );
  
  return {
    data: data?.geoJSON,
    isLoading,
    error,
    isLoaded: !!data
  };
}

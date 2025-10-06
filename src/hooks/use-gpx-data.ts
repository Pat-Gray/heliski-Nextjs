"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useCallback } from "react";
import type { FeatureCollection, LineString } from "geojson";

/**
 * Custom hook for GPX data management with React Query
 * Provides intelligent caching, background updates, and error handling
 * Uses Web Worker for parsing to prevent UI blocking
 */

export interface GPXMetadata {
  pointCount: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  trackCount: number;
  totalDistance: number;
}

export interface GPXData {
  geoJSON: FeatureCollection<LineString>;
  metadata: GPXMetadata;
}

// Worker message types
interface WorkerMessage {
  runId: string;
  geoJSON?: FeatureCollection<LineString>;
  metadata?: GPXMetadata;
  success: boolean;
  error?: string;
}

interface WorkerProgressMessage {
  type: 'progress';
  completed: number;
  total: number;
  currentRunId: string;
}

interface WorkerBatchCompleteMessage {
  type: 'batch-complete';
  results: WorkerMessage[];
  success: boolean;
}

type WorkerResponse = WorkerMessage | WorkerProgressMessage | WorkerBatchCompleteMessage;

// Worker management
const workerRefs = new Map<string, Worker>();
const workerCallbacks = new Map<string, {
  resolve: (value: GPXData) => void;
  reject: (error: Error) => void;
}>();

function getOrCreateWorker(): Worker {
  const workerId = 'gpx-parser-worker';
  
  if (!workerRefs.has(workerId)) {
    const worker = new Worker('/workers/gpx-parser.worker.js');
    
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data;
      
      if ('type' in data) {
        // Handle progress or batch complete messages
        if (data.type === 'progress') {
          console.log(`GPX Worker Progress: ${data.completed}/${data.total} - ${data.currentRunId}`);
        } else if (data.type === 'batch-complete') {
          console.log(`GPX Worker Batch Complete: ${data.results.length} results`);
        }
        return;
      }
      
      // Handle single GPX parsing result
      const { runId, geoJSON, metadata, success, error } = data;
      const callback = workerCallbacks.get(runId);
      
      if (callback) {
        workerCallbacks.delete(runId);
        
        if (success && geoJSON && metadata) {
          callback.resolve({ geoJSON, metadata });
        } else {
          callback.reject(new Error(error || 'Unknown GPX parsing error'));
        }
      }
    };
    
    worker.onerror = (error) => {
      console.error('GPX Worker Error:', error);
      // Reject all pending callbacks
      workerCallbacks.forEach(({ reject }) => {
        reject(new Error('Worker error occurred'));
      });
      workerCallbacks.clear();
    };
    
    workerRefs.set(workerId, worker);
  }
  
  return workerRefs.get(workerId)!;
}

/**
 * Parse GPX data using Web Worker
 */
async function parseGPXWithWorker(
  runId: string, 
  gpxPath: string, 
  runNumber?: number, 
  subAreaId?: string
): Promise<GPXData> {
  return new Promise((resolve, reject) => {
    const worker = getOrCreateWorker();
    
    // Store callback for this request
    workerCallbacks.set(runId, { resolve, reject });
    
    // Send parsing request to worker
    worker.postMessage({
      runId,
      gpxUrl: gpxPath,
      runNumber,
      subAreaId,
      type: 'parse-gpx'
    });
    
    // Set timeout to prevent hanging
    setTimeout(() => {
      if (workerCallbacks.has(runId)) {
        workerCallbacks.delete(runId);
        reject(new Error('GPX parsing timeout'));
      }
    }, 30000); // 30 second timeout
  });
}

/**
 * Hook for fetching and caching GPX data
 */
export function useGPXData(
  runId: string, 
  gpxPath: string, 
  runNumber?: number, 
  subAreaId?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['gpx', runId, gpxPath],
    queryFn: () => parseGPXWithWorker(runId, gpxPath, runNumber, subAreaId),
    enabled: enabled && !!gpxPath,
    staleTime: 30 * 60 * 1000, // 30 minutes - GPX data rarely changes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep in memory longer
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000) // Exponential backoff
  });
}

/**
 * Hook for batch GPX processing
 */
export function useBatchGPXData() {
  const workerRef = useRef<Worker | null>(null);
  
  const processBatch = useCallback(async (runs: Array<{
    id: string;
    gpxPath: string;
    runNumber?: number;
    subAreaId?: string;
  }>) => {
    return new Promise<Array<{ runId: string; data?: GPXData; error?: string }>>((resolve, reject) => {
      if (!workerRef.current) {
        workerRef.current = new Worker('/workers/gpx-parser.worker.js');
      }
      
      const worker = workerRef.current;
      
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const data = e.data;
        
        if ('type' in data) {
          if (data.type === 'batch-complete') {
            resolve(data.results.map(result => ({
              runId: result.runId,
              data: result.success && result.geoJSON && result.metadata 
                ? { geoJSON: result.geoJSON, metadata: result.metadata }
                : undefined,
              error: result.error
            })));
          }
          return;
        }
      };
      
      worker.onerror = (error) => {
        reject(error);
      };
      
      // Send batch processing request
      worker.postMessage({
        runs,
        type: 'batch-parse'
      });
    });
  }, []);
  
  return { processBatch };
}

/**
 * Cleanup function to terminate workers
 */
export function cleanupGPXWorkers() {
  workerRefs.forEach(worker => {
    worker.terminate();
  });
  workerRefs.clear();
  workerCallbacks.clear();
}

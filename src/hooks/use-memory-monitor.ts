"use client";

import { useState, useEffect, useCallback } from 'react';
import { getMemoryManager, type MemoryStats } from '@/utils/memory-manager';

/**
 * Hook for monitoring memory usage
 * Provides real-time memory statistics and warnings
 */
export function useMemoryMonitor(updateInterval: number = 5000) {
  const [stats, setStats] = useState<MemoryStats>({
    totalItems: 0,
    totalSizeMB: 0,
    maxSizeMB: 100,
    hitRate: 0,
    missRate: 0,
    evictedCount: 0,
    averageAccessTime: 0
  });
  
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const memoryManager = getMemoryManager();

  // Update memory statistics
  const updateStats = useCallback(() => {
    const newStats = memoryManager.getStats();
    setStats(newStats);
    setLastUpdate(new Date());
    
    // Check for warnings
    const usagePercentage = (newStats.totalSizeMB / newStats.maxSizeMB) * 100;
    setIsWarning(usagePercentage >= 80);
    setIsCritical(usagePercentage >= 90);
  }, [memoryManager]);

  // Update stats periodically
  useEffect(() => {
    updateStats();
    
    const interval = setInterval(updateStats, updateInterval);
    return () => clearInterval(interval);
  }, [updateStats, updateInterval]);

  // Auto-cleanup when memory usage is critical
  useEffect(() => {
    if (isCritical) {
      console.warn('🚨 Critical memory usage detected, triggering cleanup');
      memoryManager.cleanup();
      updateStats();
    }
  }, [isCritical, memoryManager, updateStats]);

  // Manual cleanup function
  const triggerCleanup = useCallback(() => {
    memoryManager.cleanup();
    updateStats();
  }, [memoryManager, updateStats]);

  // Clear all cache
  const clearAllCache = useCallback(() => {
    memoryManager.clearCache();
    updateStats();
  }, [memoryManager, updateStats]);

  // Update memory limit
  const updateMemoryLimit = useCallback((newLimit: number) => {
    memoryManager.updateMemoryLimit(newLimit);
    updateStats();
  }, [memoryManager, updateStats]);

  return {
    stats,
    isWarning,
    isCritical,
    lastUpdate,
    triggerCleanup,
    clearAllCache,
    updateMemoryLimit,
    updateStats
  };
}

/**
 * Hook for memory usage display component
 */
export function useMemoryDisplay() {
  const {
    stats,
    isWarning,
    isCritical,
    lastUpdate,
    triggerCleanup,
    clearAllCache
  } = useMemoryMonitor();

  const getUsageColor = () => {
    if (isCritical) return 'text-red-600';
    if (isWarning) return 'text-orange-600';
    return 'text-green-600';
  };

  const getUsageBarColor = () => {
    if (isCritical) return 'bg-red-500';
    if (isWarning) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatSize = (sizeMB: number) => {
    if (sizeMB < 1) return `${(sizeMB * 1024).toFixed(0)}KB`;
    return `${sizeMB.toFixed(1)}MB`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return {
    stats,
    isWarning,
    isCritical,
    lastUpdate,
    triggerCleanup,
    clearAllCache,
    getUsageColor,
    getUsageBarColor,
    formatSize,
    formatPercentage
  };
}

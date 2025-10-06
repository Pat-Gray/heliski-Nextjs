/**
 * Memory management system for GPX data
 * Implements LRU cache with size limits and intelligent eviction
 */

export interface CachedGPXData {
  geoJSON: Record<string, unknown>; // FeatureCollection<LineString>
  metadata: {
    pointCount: number;
    bounds: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
    trackCount: number;
    totalDistance: number;
  };
  sizeMB: number;
  lastAccessed: number;
  accessCount: number;
  priority: number;
}

export interface MemoryStats {
  totalItems: number;
  totalSizeMB: number;
  maxSizeMB: number;
  hitRate: number;
  missRate: number;
  evictedCount: number;
  averageAccessTime: number;
}

/**
 * GPX Memory Manager
 * Manages memory usage for GPX data with intelligent eviction strategies
 */
export class GPXMemoryManager {
  private cache = new Map<string, CachedGPXData>();
  private maxMemoryMB = 100; // Maximum memory usage in MB
  private currentMemoryMB = 0;
  private hits = 0;
  private misses = 0;
  private evictedCount = 0;
  private accessTimes: number[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxMemoryMB: number = 100) {
    this.maxMemoryMB = maxMemoryMB;
    this.startCleanupInterval();
  }

  /**
   * Add GPX data to cache with memory tracking
   */
  addToCache(
    runId: string, 
    geoJSON: Record<string, unknown>, 
    metadata: CachedGPXData['metadata'],
    priority: number = 1
  ): void {
    const sizeMB = this.calculateSize(geoJSON);
    
    // Evict old data if we're over memory limit
    while (this.currentMemoryMB + sizeMB > this.maxMemoryMB && this.cache.size > 0) {
      this.evictOldest();
    }
    
    // Evict LRU if cache is getting too large
    while (this.cache.size > 0 && this.currentMemoryMB + sizeMB > this.maxMemoryMB) {
      this.evictLRU();
    }
    
    const cachedData: CachedGPXData = {
      geoJSON,
      metadata,
      sizeMB,
      lastAccessed: Date.now(),
      accessCount: 1,
      priority
    };
    
    this.cache.set(runId, cachedData);
    this.currentMemoryMB += sizeMB;
    
    console.log(`📦 Cached GPX for run ${runId}: ${sizeMB.toFixed(2)}MB (Total: ${this.currentMemoryMB.toFixed(2)}MB)`);
  }

  /**
   * Get GPX data from cache
   */
  getFromCache(runId: string): CachedGPXData | null {
    const cached = this.cache.get(runId);
    
    if (cached) {
      this.hits++;
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.accessTimes.push(Date.now());
      return cached;
    }
    
    this.misses++;
    return null;
  }

  /**
   * Check if data is cached
   */
  hasCached(runId: string): boolean {
    return this.cache.has(runId);
  }

  /**
   * Remove specific item from cache
   */
  removeFromCache(runId: string): boolean {
    const cached = this.cache.get(runId);
    if (cached) {
      this.currentMemoryMB -= cached.sizeMB;
      this.cache.delete(runId);
      console.log(`🗑️ Removed GPX cache for run ${runId}: ${cached.sizeMB.toFixed(2)}MB`);
      return true;
    }
    return false;
  }

  /**
   * Evict least recently used data
   */
  private evictLRU(): void {
    let lruKey = '';
    let lruTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < lruTime) {
        lruTime = value.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.evictItem(lruKey);
    }
  }

  /**
   * Evict oldest data by timestamp
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.evictItem(oldestKey);
    }
  }

  /**
   * Evict item with lowest priority
   */
  private evictLowestPriority(): void {
    let lowestPriorityKey = '';
    let lowestPriority = Infinity;
    
    for (const [key, value] of this.cache.entries()) {
      if (value.priority < lowestPriority) {
        lowestPriority = value.priority;
        lowestPriorityKey = key;
      }
    }
    
    if (lowestPriorityKey) {
      this.evictItem(lowestPriorityKey);
    }
  }

  /**
   * Evict a specific item
   */
  private evictItem(runId: string): void {
    const cached = this.cache.get(runId);
    if (cached) {
      this.currentMemoryMB -= cached.sizeMB;
      this.cache.delete(runId);
      this.evictedCount++;
      console.log(`🗑️ Evicted GPX cache for run ${runId}: ${cached.sizeMB.toFixed(2)}MB`);
    }
  }

  /**
   * Calculate approximate size of GeoJSON data in MB
   */
  private calculateSize(geoJSON: Record<string, unknown>): number {
    try {
      const jsonString = JSON.stringify(geoJSON);
      const bytes = new Blob([jsonString]).size;
      return bytes / (1024 * 1024); // Convert to MB
    } catch (error) {
      console.warn('Failed to calculate GeoJSON size:', error);
      return 1; // Default estimate
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.currentMemoryMB = 0;
    this.evictedCount = 0;
    console.log('🗑️ Cleared all GPX cache');
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.misses / totalRequests : 0;
    
    // Calculate average access time
    let averageAccessTime = 0;
    if (this.accessTimes.length > 0) {
      const now = Date.now();
      const recentTimes = this.accessTimes.filter(time => now - time < 60000); // Last minute
      if (recentTimes.length > 0) {
        averageAccessTime = recentTimes.reduce((sum, time) => sum + (now - time), 0) / recentTimes.length;
      }
    }
    
    return {
      totalItems: this.cache.size,
      totalSizeMB: this.currentMemoryMB,
      maxSizeMB: this.maxMemoryMB,
      hitRate,
      missRate,
      evictedCount: this.evictedCount,
      averageAccessTime
    };
  }

  /**
   * Update memory limit
   */
  updateMemoryLimit(maxMemoryMB: number): void {
    this.maxMemoryMB = maxMemoryMB;
    
    // Evict items if we're over the new limit
    while (this.currentMemoryMB > this.maxMemoryMB && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // Cleanup every 30 seconds
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Cleanup old and unused data
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const toEvict: string[] = [];
    
    for (const [key, value] of this.cache.entries()) {
      // Evict very old data
      if (now - value.lastAccessed > maxAge) {
        toEvict.push(key);
      }
    }
    
    // Evict oldest items if we're over 80% of memory limit
    if (this.currentMemoryMB > this.maxMemoryMB * 0.8) {
      const sortedByAccess = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toEvictCount = Math.ceil(this.cache.size * 0.2); // Evict 20%
      for (let i = 0; i < toEvictCount && i < sortedByAccess.length; i++) {
        toEvict.push(sortedByAccess[i][0]);
      }
    }
    
    toEvict.forEach(key => this.evictItem(key));
    
    if (toEvict.length > 0) {
      console.log(`🧹 Cleaned up ${toEvict.length} GPX cache entries`);
    }
  }

  /**
   * Get cache keys for debugging
   */
  getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get detailed cache information
   */
  getCacheDetails(): Array<{ runId: string; sizeMB: number; lastAccessed: number; accessCount: number; priority: number }> {
    return Array.from(this.cache.entries()).map(([runId, data]) => ({
      runId,
      sizeMB: data.sizeMB,
      lastAccessed: data.lastAccessed,
      accessCount: data.accessCount,
      priority: data.priority
    }));
  }

  /**
   * Destroy the memory manager
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.clearCache();
  }
}

// Global memory manager instance
let globalMemoryManager: GPXMemoryManager | null = null;

/**
 * Get or create global memory manager instance
 */
export function getMemoryManager(): GPXMemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new GPXMemoryManager();
  }
  return globalMemoryManager;
}

/**
 * Cleanup global memory manager
 */
export function cleanupMemoryManager(): void {
  if (globalMemoryManager) {
    globalMemoryManager.destroy();
    globalMemoryManager = null;
  }
}

/**
 * Advanced tile caching system for LINZ basemap tiles
 * Implements LRU cache with intelligent preloading and memory management
 */

export interface CachedTile {
  url: string;
  timestamp: number;
  size: number;
  z: number;
  x: number;
  y: number;
  accessCount: number;
  lastAccessed: number;
}

export interface TileCacheStats {
  totalTiles: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageAccessTime: number;
}

/**
 * Tile Cache Manager for LINZ basemap tiles
 * Provides intelligent caching, preloading, and memory management
 */
export class TileCacheManager {
  private cache = new Map<string, CachedTile>();
  private maxCacheSize = 1000; // Maximum tiles in cache
  private maxMemoryMB = 100; // Maximum memory usage in MB
  private currentMemoryMB = 0;
  private hits = 0;
  private misses = 0;
  private preloadQueue: string[] = [];
  private isPreloading = false;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_LINZ_API_KEY || 'c01k5mkf2a6g80h6va1rny04y0m';
  }

  /**
   * Get tile with caching
   * Checks cache first, then fetches and caches if needed
   */
  async getTile(z: number, x: number, y: number): Promise<string> {
    const tileKey = `${z}/${x}/${y}`;
    const cached = this.cache.get(tileKey);
    
    // Return cached tile if available and not expired
    if (cached && !this.isExpired(cached)) {
      this.hits++;
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return cached.url;
    }
    
    this.misses++;
    
    // Fetch new tile
    const tileUrl = this.buildTileUrl(z, x, y);
    
    try {
      const response = await fetch(tileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch tile: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Cache the tile
      this.cacheTile(tileKey, {
        url,
        timestamp: Date.now(),
        size: blob.size,
        z, x, y,
        accessCount: 1,
        lastAccessed: Date.now()
      });
      
      return url;
    } catch (error) {
      console.error(`Failed to fetch tile ${tileKey}:`, error);
      throw error;
    }
  }

  /**
   * Preload tiles around current viewport
   * Improves user experience by loading adjacent tiles
   */
  async preloadTiles(centerZ: number, centerX: number, centerY: number, radius: number = 1) {
    if (this.isPreloading) return;
    
    this.isPreloading = true;
    
    try {
      const tilesToPreload = this.getAdjacentTiles(centerZ, centerX, centerY, radius);
      
      // Add to preload queue
      tilesToPreload.forEach(({ z, x, y }) => {
        const tileKey = `${z}/${x}/${y}`;
        if (!this.cache.has(tileKey) && !this.preloadQueue.includes(tileKey)) {
          this.preloadQueue.push(tileKey);
        }
      });
      
      // Process preload queue
      await this.processPreloadQueue();
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Process preload queue in batches
   */
  private async processPreloadQueue() {
    const batchSize = 5;
    const batches = [];
    
    for (let i = 0; i < this.preloadQueue.length; i += batchSize) {
      batches.push(this.preloadQueue.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const promises = batch.map(tileKey => {
        const [z, x, y] = tileKey.split('/').map(Number);
        return this.getTile(z, x, y).catch(error => {
          console.warn(`Failed to preload tile ${tileKey}:`, error);
        });
      });
      
      await Promise.allSettled(promises);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.preloadQueue = [];
  }

  /**
   * Get adjacent tiles for preloading
   */
  private getAdjacentTiles(z: number, x: number, y: number, radius: number = 1) {
    const tiles = [];
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip center tile
        
        const newX = x + dx;
        const newY = y + dy;
        
        // Check bounds
        if (newX >= 0 && newX < Math.pow(2, z) && newY >= 0 && newY < Math.pow(2, z)) {
          tiles.push({ z, x: newX, y: newY });
        }
      }
    }
    
    return tiles;
  }

  /**
   * Cache a tile with memory management
   */
  private cacheTile(tileKey: string, tile: CachedTile) {
    // Evict old tiles if we're over memory limit
    while (this.currentMemoryMB + (tile.size / 1024 / 1024) > this.maxMemoryMB && this.cache.size > 0) {
      this.evictOldest();
    }
    
    // Evict least recently used if cache is full
    while (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }
    
    this.cache.set(tileKey, tile);
    this.currentMemoryMB += tile.size / 1024 / 1024;
  }

  /**
   * Evict oldest tile by timestamp
   */
  private evictOldest() {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, tile] of this.cache.entries()) {
      if (tile.timestamp < oldestTime) {
        oldestTime = tile.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.evictTile(oldestKey);
    }
  }

  /**
   * Evict least recently used tile
   */
  private evictLRU() {
    let lruKey = '';
    let lruTime = Date.now();
    
    for (const [key, tile] of this.cache.entries()) {
      if (tile.lastAccessed < lruTime) {
        lruTime = tile.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.evictTile(lruKey);
    }
  }

  /**
   * Evict a specific tile
   */
  private evictTile(tileKey: string) {
    const tile = this.cache.get(tileKey);
    if (tile) {
      URL.revokeObjectURL(tile.url);
      this.currentMemoryMB -= tile.size / 1024 / 1024;
      this.cache.delete(tileKey);
    }
  }

  /**
   * Check if tile is expired
   */
  private isExpired(tile: CachedTile): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - tile.timestamp > maxAge;
  }

  /**
   * Build optimized LINZ tile URL with caching headers
   */
  private buildTileUrl(z: number, x: number, y: number): string {
    const baseUrl = 'https://basemaps.linz.govt.nz/v1/tiles/topo-raster/WebMercatorQuad';
    
    // Add cache-busting parameter for development
    const cacheBuster = process.env.NODE_ENV === 'development' ? `&_t=${Date.now()}` : '';
    
    return `${baseUrl}/${z}/${x}/${y}.webp?api=${this.apiKey}${cacheBuster}`;
  }

  /**
   * Clear all cached tiles
   */
  clearCache() {
    this.cache.forEach(tile => {
      URL.revokeObjectURL(tile.url);
    });
    this.cache.clear();
    this.currentMemoryMB = 0;
    this.preloadQueue = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): TileCacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.misses / totalRequests : 0;
    
    return {
      totalTiles: this.cache.size,
      totalSize: this.currentMemoryMB,
      hitRate,
      missRate,
      averageAccessTime: 0 // Could be implemented with timing
    };
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: { maxCacheSize?: number; maxMemoryMB?: number }) {
    if (config.maxCacheSize !== undefined) {
      this.maxCacheSize = config.maxCacheSize;
    }
    if (config.maxMemoryMB !== undefined) {
      this.maxMemoryMB = config.maxMemoryMB;
    }
  }

  /**
   * Cleanup expired tiles
   */
  cleanupExpired() {
    const expiredKeys: string[] = [];
    
    this.cache.forEach((tile, key) => {
      if (this.isExpired(tile)) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => this.evictTile(key));
  }
}

// Global tile cache instance
let globalTileCache: TileCacheManager | null = null;

/**
 * Get or create global tile cache instance
 */
export function getTileCache(): TileCacheManager {
  if (!globalTileCache) {
    globalTileCache = new TileCacheManager();
  }
  return globalTileCache;
}

/**
 * Cleanup global tile cache
 */
export function cleanupTileCache() {
  if (globalTileCache) {
    globalTileCache.clearCache();
    globalTileCache = null;
  }
}

/**
 * Service Worker for aggressive tile caching
 * Caches LINZ tiles in browser cache for offline access and improved performance
 */

const CACHE_NAME = 'linz-tiles-v1';
const TILE_CACHE_PATTERN = /basemaps\.linz\.govt\.nz.*\.webp/;
const MAX_CACHE_SIZE = 500; // Maximum number of tiles to cache
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Install event - set up cache
self.addEventListener('install', (event) => {
  console.log('🗺️ Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🗺️ Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle tile requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle tile requests
  if (TILE_CACHE_PATTERN.test(url.href)) {
    event.respondWith(handleTileRequest(event.request));
  }
});

/**
 * Handle tile requests with caching strategy
 */
async function handleTileRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try cache first
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cached response is still valid
      const cacheTime = cachedResponse.headers.get('sw-cache-time');
      if (cacheTime && Date.now() - parseInt(cacheTime) < CACHE_EXPIRY) {
        console.log('🎯 Cache hit for:', request.url);
        return cachedResponse;
      } else {
        // Cache expired, remove it
        await cache.delete(request);
      }
    }
    
    // Cache miss or expired - fetch from network
    console.log('🌐 Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response for caching
      const responseToCache = networkResponse.clone();
      
      // Add cache timestamp header
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      // Cache the response
      await cache.put(request, cachedResponse);
      
      // Clean up old entries if cache is getting too large
      await cleanupCache(cache);
      
      return networkResponse;
    } else {
      console.warn('❌ Failed to fetch tile:', request.url, networkResponse.status);
      return networkResponse;
    }
    
  } catch (error) {
    console.error('❌ Error handling tile request:', error);
    
    // Try to return cached response even if expired
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('🔄 Returning expired cache for:', request.url);
      return cachedResponse;
    }
    
    // Return error response
    return new Response('Tile fetch failed', { status: 500 });
  }
}

/**
 * Clean up old cache entries
 */
async function cleanupCache(cache) {
  const requests = await cache.keys();
  
  if (requests.length > MAX_CACHE_SIZE) {
    console.log(`🧹 Cache cleanup: ${requests.length} entries, max is ${MAX_CACHE_SIZE}`);
    
    // Sort by cache time (oldest first)
    const requestsWithTime = await Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        const cacheTime = response?.headers.get('sw-cache-time');
        return {
          request,
          cacheTime: cacheTime ? parseInt(cacheTime) : 0
        };
      })
    );
    
    requestsWithTime.sort((a, b) => a.cacheTime - b.cacheTime);
    
    // Remove oldest entries
    const toRemove = requestsWithTime.slice(0, requests.length - MAX_CACHE_SIZE);
    await Promise.all(
      toRemove.map(({ request }) => cache.delete(request))
    );
    
    console.log(`🗑️ Removed ${toRemove.length} old cache entries`);
  }
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CLEAR_CACHE':
      clearCache().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_STATS':
      getCacheStats().then((stats) => {
        event.ports[0].postMessage({ success: true, stats });
      });
      break;
      
    case 'PRELOAD_TILES':
      preloadTiles(data.tiles).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
});

/**
 * Clear all cached tiles
 */
async function clearCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  await Promise.all(
    requests.map(request => cache.delete(request))
  );
  
  console.log(`🗑️ Cleared ${requests.length} cached tiles`);
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  let totalSize = 0;
  let expiredCount = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        totalSize += parseInt(contentLength);
      }
      
      const cacheTime = response.headers.get('sw-cache-time');
      if (cacheTime && Date.now() - parseInt(cacheTime) > CACHE_EXPIRY) {
        expiredCount++;
      }
    }
  }
  
  return {
    totalTiles: requests.length,
    totalSize: totalSize,
    expiredTiles: expiredCount,
    maxSize: MAX_CACHE_SIZE
  };
}

/**
 * Preload tiles
 */
async function preloadTiles(tiles) {
  const cache = await caches.open(CACHE_NAME);
  
  for (const tileUrl of tiles) {
    try {
      const response = await fetch(tileUrl);
      if (response.ok) {
        const responseToCache = response.clone();
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cache-time', Date.now().toString());
        
        const cachedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        });
        
        await cache.put(tileUrl, cachedResponse);
        console.log('✅ Preloaded tile:', tileUrl);
      }
    } catch (error) {
      console.warn('❌ Failed to preload tile:', tileUrl, error);
    }
  }
}

console.log('🗺️ Tile caching service worker loaded');

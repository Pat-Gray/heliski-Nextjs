import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl/mapbox';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useRunsForArea } from '@/contexts/hooks/use-runs-for-area';
import { parseGPXToGeoJSON } from '@/utils/gpx-parser';
import { Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface NZTopoMapProps {
  areaId: string;
  subAreaId?: string;
  selectedRunId?: string;
  hoveredRunId?: string;
  onClose?: () => void;
}

interface RunData {
  id: string;
  name: string;
  runNumber: number;
  status: 'open' | 'conditional' | 'closed';
  gpxPath: string;
  subAreaId: string;
  gpxData?: FeatureCollection<LineString>;
}

const STATUS_COLORS = {
  open: '#22c55e',
  conditional: '#f59e0b',
  closed: '#ef4444'
};

const STATUS_OPACITY = {
  normal: 0.8,
  highlighted: 1.0
};

// Calculate bounds from GPX data
function calculateGPXBounds(runs: RunData[]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let hasData = false;

  runs.forEach(run => {
    if (run.gpxData && run.gpxData.features) {
      run.gpxData.features.forEach(feature => {
        if (feature.geometry.type === 'LineString') {
          const coordinates = feature.geometry.coordinates as number[][];
          coordinates.forEach(coord => {
            const [lon, lat] = coord;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            hasData = true;
          });
        }
      });
    }
  });

  if (!hasData) return null;

  return {
    minLat,
    maxLat,
    minLon,
    maxLon
  };
}

// Calculate bounds for a specific sub-area
function calculateSubAreaBounds(runs: RunData[], targetSubAreaId: string) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let hasData = false;

  runs.forEach(run => {
    if (run.subAreaId === targetSubAreaId && run.gpxData && run.gpxData.features) {
      run.gpxData.features.forEach(feature => {
        if (feature.geometry.type === 'LineString') {
          const coordinates = feature.geometry.coordinates as number[][];
          coordinates.forEach(coord => {
            const [lon, lat] = coord;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            hasData = true;
          });
        }
      });
    }
  });

  if (!hasData) return null;

  return {
    minLat,
    maxLat,
    minLon,
    maxLon
  };
}

export default function NZTopoMap({ 
  areaId, 
  subAreaId, 
  selectedRunId,
  hoveredRunId,
  onClose,
}: NZTopoMapProps) {
  const mapRef = useRef<MapRef>(null);
  const gpxCache = useRef<Record<string, FeatureCollection<LineString>>>({});
  const [viewState, setViewState] = useState({
    longitude: 174.0,
    latitude: -41.0,
    zoom: 8, // Start with a wider view
    bearing: 0,
    pitch: 0
  });
  const [highlightedRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useNZTopo, setUseNZTopo] = useState(true);
  const [, setTileLoadError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch ALL runs for the area (not filtered by subAreaId)
  const { data: runsData, isLoading, error: fetchError } = useRunsForArea(areaId);

  // Process runs data with GPX caching and memoization
  useEffect(() => {
    if (!runsData || !Array.isArray(runsData)) return;

    const processRuns = async () => {
      setLoading(true);
      setError(null);

      try {
        // Process runs in parallel for better performance
        const runPromises = runsData.map(async (run) => {
          if (!run) return null;

          const cacheKey = `${run.gpxPath || ''}-${run.subAreaId || ''}-${run.runNumber || 0}`;
          
          let gpxData: FeatureCollection<LineString>;
          
          // Check cache first
          if (gpxCache.current[cacheKey]) {
            gpxData = gpxCache.current[cacheKey];
          } else {
            // Fetch and cache GPX data
            gpxData = await parseGPXToGeoJSON(run.gpxPath || '', run.subAreaId, run.runNumber);
            gpxCache.current[cacheKey] = gpxData;
          }

          return {
            id: run.id || '',
            name: run.name || '',
            runNumber: run.runNumber || 0,
            status: (run.status as 'open' | 'conditional' | 'closed') || 'open',
            gpxPath: run.gpxPath || '',
            subAreaId: run.subAreaId || '',
            gpxData
          } as RunData;
        });

        const results = await Promise.all(runPromises);
        const processedRuns = results.filter((run): run is RunData => run !== null);

        setRuns(processedRuns);
        
        // Initial overview zoom - show ALL GPX files
        if (processedRuns.length > 0 && !hasInitialized) {
          const bounds = calculateGPXBounds(processedRuns);
          if (bounds) {
            setViewState(prev => ({
              ...prev,
              longitude: (bounds.minLon + bounds.maxLon) / 2,
              latitude: (bounds.minLat + bounds.maxLat) / 2,
              zoom: 8 // Wide overview
            }));
            setHasInitialized(true);
          }
        }
      } catch (err) {
        setError('Failed to process run data');
        console.error('Error processing runs:', err);
      } finally {
        setLoading(false);
      }
    };

    processRuns();
  }, [runsData, hasInitialized]);

  // Cleanup GPX cache on unmount
  useEffect(() => {
    const cache = gpxCache.current;
    return () => {
      // Clear all cache entries
      Object.keys(cache).forEach(key => {
        delete cache[key];
      });
    };
  }, []);

  // Handle sub-area zoom when subAreaId changes
  useEffect(() => {
    if (!subAreaId || !mapRef.current || runs.length === 0) return;

    const bounds = calculateSubAreaBounds(runs, subAreaId);
    if (bounds) {
      mapRef.current.fitBounds(
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat]
        ],
        {
          padding: 50,
          maxZoom: 13,
          duration: 1
        }
      );
    }
  }, [subAreaId, runs]);

  // Filter runs with GPX data for rendering (NO FILTERING - show all runs)
  const runsWithData = runs.filter(run => run.gpxData);

  const handleMapLoad = useCallback(() => {
    // Initial overview zoom when map loads
    if (runs.length > 0 && !hasInitialized) {
      const bounds = calculateGPXBounds(runs);
      if (bounds) {
        mapRef.current?.fitBounds(
          [
            [bounds.minLon, bounds.minLat],
            [bounds.maxLon, bounds.maxLat]
          ],
          {
            padding: 100,
            maxZoom: 8,
            duration: 1000
          }
        );
      }
    }
  }, [runs, hasInitialized]);

  const handleNZTopoSourceLoad = useCallback(() => {
    setTileLoadError(null);
  }, []);

  const handleNZTopoSourceError = useCallback((error: unknown) => {
    console.error('NZ Topo source error:', error);
    setTileLoadError('Failed to load NZ Topo tiles - falling back to Mapbox');
    setTimeout(() => {
      setUseNZTopo(false);
    }, 2000);
  }, []);

  const handleMapError = useCallback((evt: unknown) => {
    console.error('Map error:', evt);
    
    if (evt && typeof evt === 'object' && 'error' in evt) {
      const error = (evt as { error: { message?: string } }).error;
      if (error && error.message && error.message.includes('Failed to load chunk')) {
        setMapError('Map failed to load due to a chunk loading error. Please refresh the page or clear your browser cache.');
        return;
      }
    }
    
    setMapError('Map failed to load. Please check your internet connection and try again.');
  }, []);

  const handleMapMove = useCallback((evt: { viewState: typeof viewState }) => {
    setViewState(evt.viewState);
  }, []);

  // Check for Mapbox access token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="flex flex-col items-center space-y-4 text-center p-6">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-sm font-medium">Mapbox access token not configured</p>
            <p className="text-xs text-muted-foreground mb-2">
              Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment
            </p>
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <p>Create a <code>.env.local</code> file in your project root with:</p>
              <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here</code>
            </div>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Map
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="flex flex-col items-center space-y-4 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No runs found</p>
            <p className="text-xs text-muted-foreground">No runs available for this area</p>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Map
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (fetchError || error || mapError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-sm font-medium">Failed to load map</p>
            <p className="text-xs text-muted-foreground">{error || mapError || fetchError?.message || 'Unknown error occurred'}</p>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Map
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-[400px] sm:min-h-[500px]">
      <div className="h-full w-full">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={handleMapMove}
          onError={handleMapError}
          onLoad={handleMapLoad}
          mapboxAccessToken={mapboxToken}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/outdoors-v12"
        >
          {/* NZ Topo 50 Base Layer */}
          {useNZTopo && (
            <Source
              id="nz-topo-source"
              type="raster"
              tiles={[
                `https://basemaps.linz.govt.nz/v1/tiles/topo-raster/WebMercatorQuad/{z}/{x}/{y}.webp?api=c01k5mkf2a6g80h6va1rny04y0m`,
              ]}
              tileSize={256}
              attribution="© LINZ CC BY 4.0"
              onError={handleNZTopoSourceError}
              onLoad={handleNZTopoSourceLoad}
              minzoom={0}
  maxzoom={18}
  bounds={[166.0, -48.0, 180.0, -34.0]} // NZ bounds to limit tile requests
            >
              <Layer
                id="nz-topo-layer"
                type="raster"
                paint={{
                  'raster-opacity': 1,
                  'raster-fade-duration': 0 
                }}
              />
            </Source>
          )}

          {/* GPX Track Layers - ALL RUNS VISIBLE */}
          {runsWithData.map(run => {
            if (!run.gpxData) return null;

            const isHighlighted = highlightedRunId === run.id || selectedRunId === run.id || hoveredRunId === run.id;
            const layerId = `run-${run.id}-track`;

            return (
              <Source 
                key={`${run.id}-${run.status}`} 
                id={`run-${run.id}-source`} 
                type="geojson" 
                data={run.gpxData}
              >
                <Layer
                  id={layerId}
                  type="line"
                  paint={{
                    'line-color': STATUS_COLORS[run.status],
                    'line-width': isHighlighted ? 5 : 3,
                    'line-opacity': isHighlighted ? STATUS_OPACITY.highlighted : STATUS_OPACITY.normal
                  }}
                  layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                  }}
                />
              </Source>
            );
          })}

          {/* Run Number Labels - ALL RUNS VISIBLE */}
          {runsWithData.map(run => {
            if (!run.gpxData || !run.gpxData.features || run.gpxData.features.length === 0) return null;

            const firstFeature = run.gpxData.features[0];
            if (!firstFeature.geometry || firstFeature.geometry.type !== 'LineString') return null;

            const coordinates = firstFeature.geometry.coordinates as number[][];
            if (coordinates.length === 0) return null;

            const startPoint = coordinates[0];
            const labelData: FeatureCollection<Point> = {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: {
                  runId: run.id,
                  runNumber: run.runNumber,
                  status: run.status
                },
                geometry: {
                  type: 'Point',
                  coordinates: startPoint
                }
              }]
            };

            return (
              <Source 
                key={`label-${run.id}-${run.status}`} 
                id={`run-${run.id}-label-source`} 
                type="geojson" 
                data={labelData}
              >
                <Layer
                  id={`run-${run.id}-label`}
                  type="symbol"
                  layout={{
                    'text-field': run.runNumber.toString(),
                    'text-size': 14,
                    'text-offset': [0, -1.5],
                    'text-anchor': 'center',
                    'text-allow-overlap': true
                  }}
                  paint={{
                    'text-color': '#ffffff',
                    'text-halo-color': STATUS_COLORS[run.status],
                    'text-halo-width': 2
                  }}
                />
              </Source>
            );
          })}
        </Map>
      </div>
    </div>
  );
}
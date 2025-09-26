import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl/mapbox';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useRunsForArea } from '@/hooks/use-runs-for-area';
import { parseGPXToGeoJSON } from '@/utils/gpx-parser';
import { Loader2, MapPin, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Run } from '@/lib/schemas/schema';

interface NZTopoMapProps {
  areaId: string;
  subAreaId?: string;
  onRunSelect?: (runId: string) => void;
  selectedRunId?: string;
  onClose?: () => void;
}

interface RunData {
  id: string;
  name: string;
  runNumber: number;
  status: 'open' | 'conditional' | 'closed';
  gpxPath: string;
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

export default function NZTopoMap({ 
  areaId, 
  subAreaId, 
  onRunSelect, 
  selectedRunId,
  onClose,
}: NZTopoMapProps) {
  const mapRef = useRef<MapRef>(null);
  const prevRunsDataRef = useRef<Run[]>([]);
  const [viewState, setViewState] = useState({
    longitude: 174.0,
    latitude: -41.0,
    zoom: 6,
    bearing: 0,
    pitch: 0
  });
  const [highlightedRunId, setHighlightedRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [useNZTopo, setUseNZTopo] = useState(true);
  const [, setTileLoadError] = useState<string | null>(null);
  const [hasZoomed, setHasZoomed] = useState(false);

  const { data: runsData, isLoading, error: fetchError } = useRunsForArea(areaId, subAreaId);

  // Debug logging
  useEffect(() => {
    console.log('NZTopoMap - areaId:', areaId, 'subAreaId:', subAreaId);
    console.log('NZTopoMap - runsData:', runsData);
  }, [areaId, subAreaId, runsData]);

  // Reset zoom flag when subAreaId changes
  useEffect(() => {
    setHasZoomed(false);
  }, [subAreaId]);

  // Process runs data and parse GPX files (only when runs structure changes, not status updates)
  useEffect(() => {
    if (!runsData || !Array.isArray(runsData)) return;

    // Check if runs structure has actually changed (not just status updates)
    const hasStructureChanged = 
      prevRunsDataRef.current.length !== runsData.length ||
      prevRunsDataRef.current.some((prevRun, index) => {
        const currentRun = runsData[index];
        return !currentRun || 
               prevRun.id !== currentRun.id || 
               prevRun.gpxPath !== currentRun.gpxPath ||
               prevRun.name !== currentRun.name ||
               prevRun.runNumber !== currentRun.runNumber;
      });

    if (!hasStructureChanged) {
      // Only update statuses, don't reload the map
      setRuns(prevRuns => 
        prevRuns.map(prevRun => {
          const updatedRun = runsData.find(run => run.id === prevRun.id);
          if (updatedRun) {
            return {
              ...prevRun,
              status: (updatedRun.status as 'open' | 'conditional' | 'closed') || prevRun.status
            };
          }
          return prevRun;
        })
      );
      return;
    }

    // Structure has changed, process runs
    const processRuns = async () => {
      setLoading(true);
      setError(null);

      try {
        const processedRuns: RunData[] = [];

        for (const run of runsData) {
          if (run) {
            // Fetch actual GPX data from the database path
            console.log('Processing run:', {
              id: run.id,
              name: run.name,
              runNumber: run.runNumber,
              gpxPath: run.gpxPath,
              subAreaId: run.subAreaId
            });
            const gpxData = await parseGPXToGeoJSON(run.gpxPath || '', subAreaId, run.runNumber);
            
            processedRuns.push({
              id: run.id || '',
              name: run.name || '',
              runNumber: run.runNumber || 0,
              status: (run.status as 'open' | 'conditional' | 'closed') || 'open',
              gpxPath: run.gpxPath || '',
              gpxData
            });
          }
        }

        console.log('Processed runs for map:', processedRuns.length, 'runs with GPX data');

        setRuns(processedRuns);
        prevRunsDataRef.current = [...runsData];
        
        // Auto-zoom to GPX bounds only on initial load, not on status updates
        if (processedRuns.length > 0 && !hasZoomed) {
          const bounds = calculateGPXBounds(processedRuns);
          if (bounds) {
            console.log('Setting up zoom for bounds:', bounds);
            // Store bounds for later use when map is ready
            setViewState(prev => ({
              ...prev,
              longitude: (bounds.minLon + bounds.maxLon) / 2,
              latitude: (bounds.minLat + bounds.maxLat) / 2,
              zoom: 10
            }));
            setHasZoomed(true);
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
  }, [runsData, subAreaId, hasZoomed]);


  // Filter runs with GPX data for rendering
  const runsWithData = runs.filter(run => run.gpxData);

  // Handle map click events
  const handleMapClick = useCallback((event: { features?: unknown[] }) => {
    if (!mapRef.current) return;

    const features = event.features;
    if (features && features.length > 0) {
      const feature = features[0] as { properties?: { runId?: string } };
      const runId = feature.properties?.runId;
      
      if (runId && typeof runId === 'string') {
        setHighlightedRunId(runId);
        onRunSelect?.(runId);
      }
    }
  }, [onRunSelect]);

  // Handle mouse enter/leave for hover effects
  const handleMouseEnter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = 'pointer';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = '';
    }
  }, []);

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  }, []);

  // Memoized onLoad handlers to prevent infinite re-renders
  const handleMapLoad = useCallback(() => {
    console.log('Map loaded successfully');
    
    // Fit bounds to GPX data when map loads
    if (runs.length > 0) {
      const bounds = calculateGPXBounds(runs);
      if (bounds && mapRef.current) {
        console.log('Fitting bounds on map load:', bounds);
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitBounds(
              [
                [bounds.minLon, bounds.minLat],
                [bounds.maxLon, bounds.maxLat]
              ],
              {
                padding: 50,
                maxZoom: 13
              }
            );
          }
        }, 1000); // Increased timeout to ensure map is fully ready
      }
    }
  }, [runs]);

  const handleNZTopoSourceLoad = useCallback(() => {
    console.log('NZ Topo source loaded successfully');
    setTileLoadError(null);
  }, []);

  const handleNZTopoSourceError = useCallback((error: unknown) => {
    console.error('NZ Topo source error:', error);
    setTileLoadError('Failed to load NZ Topo tiles - falling back to Mapbox');
    // Fallback to Mapbox style
    setTimeout(() => {
      setUseNZTopo(false);
    }, 2000);
  }, []);

  const handleMapError = useCallback((evt: unknown) => {
    console.error('Map error:', evt);
    
    // Handle specific Mapbox GL JS chunk loading errors
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

  // Update map styles when runs change (optimized for status updates)
  useEffect(() => {
    if (!mapRef.current || runs.length === 0) return;

    const updateMapStyles = () => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      runs.forEach(run => {
        if (run.gpxData) {
          const layerId = `run-${run.id}-track`;
          const isHighlighted = highlightedRunId === run.id || selectedRunId === run.id;
          
          try {
            if (map.getLayer(layerId)) {
              // Only update if the layer exists
              map.setPaintProperty(layerId, 'line-color', STATUS_COLORS[run.status]);
              map.setPaintProperty(layerId, 'line-width', isHighlighted ? 5 : 3);
              map.setPaintProperty(layerId, 'line-opacity', isHighlighted ? STATUS_OPACITY.highlighted : STATUS_OPACITY.normal);
            }
          } catch (error) {
            console.warn('Failed to update map styles:', error);
          }
        }
      });
    };

    // Use requestAnimationFrame for smoother updates
    const rafId = requestAnimationFrame(updateMapStyles);

    return () => cancelAnimationFrame(rafId);
  }, [runs, highlightedRunId, selectedRunId]);

  // Handle map style load to ensure layers are available
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleStyleLoad = () => {
      // Re-apply styles when map style loads
      const updateMapStyles = () => {
        runsWithData.forEach(run => {
          if (run.gpxData) {
            const layerId = `run-${run.id}-track`;
            const isHighlighted = highlightedRunId === run.id || selectedRunId === run.id;
            
            try {
              if (map.getLayer(layerId)) {
                map.setPaintProperty(layerId, 'line-color', STATUS_COLORS[run.status]);
                map.setPaintProperty(layerId, 'line-width', isHighlighted ? 5 : 3);
                map.setPaintProperty(layerId, 'line-opacity', isHighlighted ? STATUS_OPACITY.highlighted : STATUS_OPACITY.normal);
              }
            } catch (error) {
              console.warn('Failed to update map styles on style load:', error);
            }
          }
        });
      };

      requestAnimationFrame(updateMapStyles);
    };
    
    map.on('style.load', handleStyleLoad);
    
    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [runsWithData, highlightedRunId, selectedRunId]);

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
    <div className="relative h-full w-full">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-md"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Container */}
      <div className="h-full w-full">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={handleMapMove}
          onClick={handleMapClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onError={handleMapError}
          onLoad={handleMapLoad}
          mapboxAccessToken={mapboxToken}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/outdoors-v12"
          interactiveLayerIds={runsWithData.map(run => `run-${run.id}-track`)}
        >
            {/* NZ Topo 50 Base Layer - Rendered First */}
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
              >
                <Layer
                  id="nz-topo-layer"
                  type="raster"
                  paint={{
                    'raster-opacity': 1
                  }}
                />
              </Source>
            )}

            {/* GPX Track Layers */}
        {runsWithData.map(run => {
          if (!run.gpxData) return null;

          const isHighlighted = highlightedRunId === run.id || selectedRunId === run.id;
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

        {/* Run Number Labels - positioned at the start of each track */}
        {runsWithData.map(run => {
          if (!run.gpxData || !run.gpxData.features || run.gpxData.features.length === 0) return null;

          // Create a point feature at the start of the track for the label
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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Source, Layer, MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useRunsForArea } from '@/contexts/hooks/use-runs-for-area';
import { parseGPXToGeoJSON } from '@/utils/gpx-parser';
import { Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface AvalancheImage {
  id: string;
  title: string;
  backendMediaId?: string;
  parentId?: string;
  description?: string;
  comment?: string;
  notes?: string;
  details?: string;
  markerColor?: string;
  markerSize?: string;
  markerSymbol?: string;
  created?: number;
  updated?: number;
  creator?: string;
  downloadUrl?: string;
}

interface AvalancheFeature {
  id: string;
  title: string;
  coordinates: number[][];
  properties: Record<string, unknown>;
  pointCount: number;
  groupId?: string;
  hasImages: boolean;
  geometryType: string;
  class: string;
  images?: AvalancheImage[];
}

interface NZTopoMapProps {
  areaId: string;
  subAreaId?: string;
  selectedRunId?: string;
  hoveredRunId?: string;
  onClose?: () => void;
  // New props for avalanche features
  showAvalanchePaths?: boolean;
  avalancheFeatures?: AvalancheFeature[];
  selectedFeatureId?: string | null;
  hoveredFeatureId?: string | null;
  onFeatureSelect?: (featureId: string | null) => void;
  onFeatureHover?: (featureId: string | null) => void;
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
  showAvalanchePaths = false,
  avalancheFeatures: propAvalancheFeatures = [],
  selectedFeatureId: _selectedFeatureId,
  hoveredFeatureId: _hoveredFeatureId,
  onFeatureSelect: _onFeatureSelect,
  onFeatureHover: _onFeatureHover,
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
  const [isHoveringAvalanche, setIsHoveringAvalanche] = useState(false);
  const [avalancheFeatures, setAvalancheFeatures] = useState<AvalancheFeature[]>(propAvalancheFeatures);
  const [_avalancheLoading, setAvalancheLoading] = useState(false);
  const [_avalancheError, setAvalancheError] = useState<string | null>(null);

  // Fetch ALL runs for the area (not filtered by subAreaId) - skip for avalanche paths
  const { data: runsData, isLoading, error: fetchError } = useRunsForArea(
    areaId === 'avalanche-paths' ? '' : areaId
  );

  // Fetch avalanche features when showAvalanchePaths is true
  useEffect(() => {
    if (showAvalanchePaths && avalancheFeatures.length === 0) {
      console.log('🔄 Fetching avalanche features...');
      setAvalancheLoading(true);
      setAvalancheError(null);
      
      fetch('/api/avi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body - will use environment variable
      })
      .then(response => response.json())
      .then(data => {
        console.log('📡 Avalanche API response:', data);
        if (data.success && data.avalancheFeatures) {
          console.log('✅ Setting avalanche features:', data.avalancheFeatures);
          
          // Log each feature's ID and image status
          data.avalancheFeatures.forEach((feature: AvalancheFeature, index: number) => {
            console.log(`📡 Feature ${index + 1}:`, {
              id: feature.id,
              title: feature.title,
              hasImages: feature.hasImages,
              imageCount: feature.images?.length || 0
            });
          });
          
          setAvalancheFeatures(data.avalancheFeatures);
        } else {
          console.error('❌ Failed to fetch avalanche features:', data.error);
          setAvalancheError(data.error || 'Failed to fetch avalanche features');
        }
      })
      .catch(error => {
        console.error('❌ Error fetching avalanche features:', error);
        setAvalancheError(error.message);
      })
      .finally(() => {
        setAvalancheLoading(false);
      });
    } else if (!showAvalanchePaths) {
      console.log('🔄 Clearing avalanche features');
      setAvalancheFeatures([]);
    }
  }, [showAvalanchePaths, avalancheFeatures.length]);

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

  // Convert avalanche features to GeoJSON for rendering
  const avalancheGeoJSON = React.useMemo(() => {
    console.log('🔄 Converting avalanche features to GeoJSON:', avalancheFeatures);
    if (!avalancheFeatures || avalancheFeatures.length === 0) {
      console.log('❌ No avalanche features to convert');
      return null;
    }

    const features = avalancheFeatures.map(feature => {
      console.log(`🗺️ Converting feature to GeoJSON:`, {
        id: feature.id,
        title: feature.title,
        geometryType: feature.geometryType,
        hasImages: feature.hasImages,
        imageCount: feature.images?.length || 0
      });
      
      if (feature.geometryType === 'LineString' && feature.coordinates.length > 0) {
        const geoFeature = {
          type: 'Feature' as const,
          id: feature.id,
          properties: {
            ...feature.properties,
            title: feature.title,
            hasImages: feature.hasImages,
            class: feature.class
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: feature.coordinates
          }
        };
        console.log(`🗺️ Created LineString feature:`, geoFeature);
        return geoFeature;
      } else if (feature.geometryType === 'Point' && feature.coordinates.length > 0) {
        const geoFeature = {
          type: 'Feature' as const,
          id: feature.id,
          properties: {
            ...feature.properties,
            title: feature.title,
            hasImages: feature.hasImages,
            class: feature.class
          },
          geometry: {
            type: 'Point' as const,
            coordinates: feature.coordinates[0]
          }
        };
        console.log(`🗺️ Created Point feature:`, geoFeature);
        return geoFeature;
      } else if (feature.geometryType === 'Polygon' && feature.coordinates.length > 0) {
        const geoFeature = {
          type: 'Feature' as const,
          id: feature.id,
          properties: {
            ...feature.properties,
            title: feature.title,
            hasImages: feature.hasImages,
            class: feature.class
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [feature.coordinates] as number[][][]
          }
        };
        console.log(`🗺️ Created Polygon feature:`, geoFeature);
        return geoFeature;
      }
      console.log(`🗺️ Skipping feature (no valid geometry):`, feature);
      return null;
    }).filter((feature): feature is NonNullable<typeof feature> => feature !== null);

    const result = {
      type: 'FeatureCollection' as const,
      features
    };
    console.log('✅ Generated avalanche GeoJSON:', result);
    return result;
  }, [avalancheFeatures]);

  // Handle clicks on avalanche features
  const handleAvalancheFeatureClick = useCallback((event: MapMouseEvent) => {
    console.log('🖱️ Map clicked, showAvalanchePaths:', showAvalanchePaths);
    console.log('🖱️ Click event:', event);
    console.log('🖱️ Click features:', event.features);
    
    if (!showAvalanchePaths) {
      console.log('❌ Avalanche paths not shown, ignoring click');
      return;
    }
    
    if (!mapRef.current) {
      console.log('❌ Map ref not available');
      return;
    }
    
    // Query features at the clicked location
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: ['avalanche-lines', 'avalanche-points', 'avalanche-polygons', 'avalanche-polygon-outlines']
    });
    
    console.log('🖱️ Queried features at click point:', features);
    
    if (features && features.length > 0) {
      console.log('🖱️ Found features on click:', features.length);
      
      // Log all features to see what we're getting
      features.forEach((f, index) => {
        console.log(`🖱️ Feature ${index}:`, {
          id: f.id,
          layerId: f.layer?.id,
          properties: f.properties
        });
      });
      
      // Filter for avalanche features only
      const avalancheFeature = features.find((f) => 
        f.layer?.id?.startsWith('avalanche-') && 
        (f.layer?.id === 'avalanche-lines' || f.layer?.id === 'avalanche-points' || f.layer?.id === 'avalanche-polygons')
      );
      
      if (avalancheFeature) {
        console.log('🏔️ ===========================================');
        console.log('🏔️ AVALANCHE FEATURE CLICKED!');
        console.log('🏔️ ===========================================');
        console.log('🏔️ Looking for associated images...');
        console.log('🏔️ Found avalanche feature!', avalancheFeature);
        const featureId = avalancheFeature.id;
        const featureTitle = avalancheFeature.properties?.title || 'Unknown Feature';
        
        console.log('🏔️ Clicked avalanche feature:', {
          id: featureId,
          title: featureTitle,
          properties: avalancheFeature.properties
        });
        
        // Find the full feature data from avalancheFeatures
        const fullFeature = avalancheFeatures.find(f => f.id === featureId);
        if (fullFeature) {
          console.log('🏔️ Full feature data:', fullFeature);
          
          // Check if this feature has images
          if (fullFeature.hasImages && fullFeature.images && fullFeature.images.length > 0) {
            console.log('📸 ===========================================');
            console.log('📸 AVALANCHE FEATURE IMAGE INFORMATION');
            console.log('📸 ===========================================');
            console.log(`📸 Feature: ${fullFeature.title} (${fullFeature.id})`);
            console.log(`📸 Total Images: ${fullFeature.images.length}`);
            console.log('📸 ===========================================');
            
            // Log each image with its details
            fullFeature.images.forEach((image, index) => {
              console.log(`📸 IMAGE ${index + 1}:`);
              console.log(`📸   ID: ${image.id}`);
              console.log(`📸   Title: ${image.title}`);
              console.log(`📸   Backend Media ID: ${image.backendMediaId}`);
              console.log(`📸   Download URL: ${image.downloadUrl}`);
              console.log(`📸   Description: ${image.description || 'No description'}`);
              console.log(`📸   Comment: ${image.comment || 'No comment'}`);
              console.log(`📸   Notes: ${image.notes || 'No notes'}`);
              console.log(`📸   Details: ${image.details || 'No details'}`);
              console.log(`📸   Creator: ${image.creator || 'Unknown'}`);
              console.log(`📸   Created: ${image.created ? new Date(image.created).toLocaleString() : 'Unknown'}`);
              console.log(`📸   Updated: ${image.updated ? new Date(image.updated).toLocaleString() : 'Unknown'}`);
              console.log(`📸   Marker Color: ${image.markerColor || 'Default'}`);
              console.log(`📸   Marker Size: ${image.markerSize || 'Default'}`);
              console.log(`📸   Marker Symbol: ${image.markerSymbol || 'Default'}`);
              console.log('📸 -------------------------------------------');
            });
            
            console.log('📸 ===========================================');
            console.log('📸 END OF IMAGE INFORMATION');
            console.log('📸 ===========================================');
          } else {
            console.log('📸 ===========================================');
            console.log('📸 NO IMAGES ASSOCIATED WITH THIS FEATURE');
            console.log(`📸 Feature: ${fullFeature.title} (${fullFeature.id})`);
            console.log('📸 ===========================================');
          }
        } else {
          console.log('❌ Could not find full feature data for ID:', featureId);
        }
      } else {
        console.log('❌ No avalanche feature found in clicked features');
      }
    } else {
      console.log('❌ No features found on click');
    }
  }, [avalancheFeatures, showAvalanchePaths]);

  // Handle mouse enter on avalanche features
  const handleAvalancheFeatureMouseEnter = useCallback((event: MapMouseEvent) => {
    console.log('🖱️ Mouse enter, showAvalanchePaths:', showAvalanchePaths);
    if (!showAvalanchePaths) return;
    
    if (!mapRef.current) return;
    
    // Query features at the mouse location
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: ['avalanche-lines', 'avalanche-points', 'avalanche-polygons', 'avalanche-polygon-outlines']
    });
    
    console.log('🖱️ Mouse enter features:', features);
    if (features && features.length > 0) {
      const avalancheFeature = features.find((f) => 
        f.layer?.id?.startsWith('avalanche-') && 
        (f.layer?.id === 'avalanche-lines' || f.layer?.id === 'avalanche-points' || f.layer?.id === 'avalanche-polygons')
      );
      
      if (avalancheFeature) {
        console.log('🖱️ Hovering over avalanche feature');
        setIsHoveringAvalanche(true);
        if (mapRef.current) {
          mapRef.current.getCanvas().style.cursor = 'pointer';
        }
      }
    }
  }, [showAvalanchePaths]);

  // Handle mouse leave on avalanche features
  const handleAvalancheFeatureMouseLeave = useCallback((event: MapMouseEvent) => {
    if (!showAvalanchePaths) return;
    
    if (!mapRef.current) return;
    
    // Query features at the mouse location
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: ['avalanche-lines', 'avalanche-points', 'avalanche-polygons', 'avalanche-polygon-outlines']
    });
    
    if (features && features.length === 0) {
      console.log('🖱️ Mouse left avalanche feature area');
      setIsHoveringAvalanche(false);
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor = 'grab';
      }
    }
  }, [showAvalanchePaths]);

  const handleMapLoad = useCallback(() => {
    // Initial overview zoom when map loads
    if (areaId === 'avalanche-paths' && avalancheFeatures.length > 0 && !hasInitialized) {
      // Calculate bounds from avalanche features
      let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
      let hasData = false;

      avalancheFeatures.forEach(feature => {
        console.log('🔍 Processing avalanche feature for bounds:', feature.title, feature.coordinates);
        if (feature.coordinates && feature.coordinates.length > 0) {
          feature.coordinates.forEach(coord => {
            console.log('🔍 Processing coordinate:', coord);
            if (Array.isArray(coord) && coord.length >= 2) {
              const [lon, lat] = coord;
              console.log('🔍 Extracted lon/lat:', lon, lat);
              if (!isNaN(lon) && !isNaN(lat)) {
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLon = Math.min(minLon, lon);
                maxLon = Math.max(maxLon, lon);
                hasData = true;
              } else {
                console.warn('⚠️ Invalid coordinates:', lon, lat);
              }
            }
          });
        }
      });

      if (hasData && mapRef.current) {
        console.log('🗺️ Setting map bounds:', { minLon, minLat, maxLon, maxLat });
        mapRef.current.fitBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat]
          ],
          {
            padding: 100,
            maxZoom: 8,
            duration: 1000
          }
        );
        setHasInitialized(true);
      } else {
        console.warn('⚠️ No valid coordinates found for avalanche features, using default view');
        // Set a default view for New Zealand if no valid coordinates
        if (mapRef.current) {
          mapRef.current.setCenter([174.0, -41.0]);
          mapRef.current.setZoom(6);
          setHasInitialized(true);
        }
      }
    } else if (runs.length > 0 && !hasInitialized) {
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
  }, [runs, hasInitialized, areaId, avalancheFeatures]);

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

  if ((isLoading || loading) && areaId !== 'avalanche-paths') {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (runs.length === 0 && areaId !== 'avalanche-paths') {
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
          onClick={showAvalanchePaths ? handleAvalancheFeatureClick : (_event) => {
            console.log('🖱️ Map clicked (no avalanche paths)');
          }}
          onMouseEnter={showAvalanchePaths ? handleAvalancheFeatureMouseEnter : undefined}
          onMouseLeave={showAvalanchePaths ? handleAvalancheFeatureMouseLeave : undefined}
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

          {/* Avalanche Features */}
          {showAvalanchePaths && avalancheGeoJSON && (() => {
            console.log('🗺️ Rendering avalanche features on map:', avalancheGeoJSON);
            return true;
          })() && (
            <Source 
              id="avalanche-features-source" 
              type="geojson" 
              data={avalancheGeoJSON}
            >
              {/* LineString features (paths) */}
              <Layer
                id="avalanche-lines"
                type="line"
                filter={['==', ['geometry-type'], 'LineString']}
                paint={{
                  'line-color': '#ff6b6b',
                  'line-width': isHoveringAvalanche ? 4 : 3,
                  'line-opacity': isHoveringAvalanche ? 1.0 : 0.8
                }}
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round'
                }}
              />
              
              {/* Point features (markers) */}
              <Layer
                id="avalanche-points"
                type="circle"
                filter={['==', ['geometry-type'], 'Point']}
                paint={{
                  'circle-color': '#ff6b6b',
                  'circle-radius': isHoveringAvalanche ? 8 : 6,
                  'circle-opacity': isHoveringAvalanche ? 1.0 : 0.8,
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': isHoveringAvalanche ? 3 : 2
                }}
              />
              
              {/* Polygon features (areas) */}
              <Layer
                id="avalanche-polygons"
                type="fill"
                filter={['==', ['geometry-type'], 'Polygon']}
                paint={{
                  'fill-color': '#ff6b6b',
                  'fill-opacity': isHoveringAvalanche ? 0.5 : 0.3
                }}
              />
              
              {/* Polygon outlines */}
              <Layer
                id="avalanche-polygon-outlines"
                type="line"
                filter={['==', ['geometry-type'], 'Polygon']}
                paint={{
                  'line-color': '#ff6b6b',
                  'line-width': isHoveringAvalanche ? 3 : 2,
                  'line-opacity': isHoveringAvalanche ? 1.0 : 0.8
                }}
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round'
                }}
              />
              
              {/* Feature labels */}
              <Layer
                id="avalanche-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'title'],
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 12,
                  'text-anchor': 'top',
                  'text-offset': [0, 1]
                }}
                paint={{
                  'text-color': '#ffffff',
                  'text-halo-color': '#000000',
                  'text-halo-width': 2
                }}
              />
            </Source>
          )}
        </Map>
      </div>
    </div>
  );
}
import type { FeatureCollection, LineString } from 'geojson';

export interface GPXPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface GPXTrack {
  name?: string;
  points: GPXPoint[];
  color?: string;
  runNumber?: number;
}

export interface ParsedGPX {
  tracks: GPXTrack[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export function parseGPX(gpxContent: string): ParsedGPX {
  try {
    // Parsing GPX content
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`GPX parsing error: ${parseError.textContent}`);
    }
    
    const tracks: GPXTrack[] = [];
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

  // Parse tracks
  const trackElements = doc.querySelectorAll('trk');
  trackElements.forEach((trackElement, index) => {
    const trackName = trackElement.querySelector('name')?.textContent || `Track ${index + 1}`;
    const points: GPXPoint[] = [];

    const trackPoints = trackElement.querySelectorAll('trkpt');
    trackPoints.forEach(pointElement => {
      const lat = parseFloat(pointElement.getAttribute('lat') || '0');
      const lon = parseFloat(pointElement.getAttribute('lon') || '0');
      const eleElement = pointElement.querySelector('ele');
      const timeElement = pointElement.querySelector('time');
      
      const point: GPXPoint = {
        lat,
        lon,
        ele: eleElement ? parseFloat(eleElement.textContent || '0') : undefined,
        time: timeElement?.textContent
      };

      points.push(point);

      // Update bounds
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    });

    if (points.length > 0) {
      tracks.push({
        name: trackName,
        points,
        color: getTrackColor(index),
        runNumber: index + 1
      });
    }
  });

  // Parse routes if no tracks found
  if (tracks.length === 0) {
    const routeElements = doc.querySelectorAll('rte');
    routeElements.forEach((routeElement, index) => {
      const routeName = routeElement.querySelector('name')?.textContent || `Route ${index + 1}`;
      const points: GPXPoint[] = [];

      const routePoints = routeElement.querySelectorAll('rtept');
      routePoints.forEach(pointElement => {
        const lat = parseFloat(pointElement.getAttribute('lat') || '0');
        const lon = parseFloat(pointElement.getAttribute('lon') || '0');
        const eleElement = pointElement.querySelector('ele');
        const timeElement = pointElement.querySelector('time');
        
        const point: GPXPoint = {
          lat,
          lon,
          ele: eleElement ? parseFloat(eleElement.textContent || '0') : undefined,
          time: timeElement?.textContent
        };

        points.push(point);

        // Update bounds
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      });

      if (points.length > 0) {
        tracks.push({
          name: routeName,
          points,
          color: getTrackColor(index),
          runNumber: index + 1
        });
      }
    });
  }

    // GPX parsing completed
    return {
      tracks,
      bounds: {
        minLat: minLat === Infinity ? 0 : minLat,
        maxLat: maxLat === -Infinity ? 0 : maxLat,
        minLon: minLon === Infinity ? 0 : minLon,
        maxLon: maxLon === -Infinity ? 0 : maxLon
      }
    };
  } catch (error) {
    console.error('Error parsing GPX:', {
      error: error instanceof Error ? error.message : String(error),
      contentLength: gpxContent.length,
      contentPreview: gpxContent.substring(0, 200)
    });
    throw error;
  }
}

export function getTrackColor(index: number): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#84cc16', // lime
    '#f59e0b', // amber
  ];
  return colors[index % colors.length];
}

export async function fetchGPXFile(url: string): Promise<string | null> {
  try {
    // Fetching GPX file
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.warn(`Failed to fetch GPX file: ${response.status} ${response.statusText}. Response: ${errorText}`);
      // Return null instead of throwing to trigger fallback
      return null;
    }
    
    const text = await response.text();
    // GPX file fetched successfully
    return text;
  } catch (error) {
    console.warn('Error fetching GPX file, using fallback:', {
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    // Return null instead of throwing to trigger fallback
    return null;
  }
}

export function calculateDistance(point1: GPXPoint, point2: GPXPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lon - point1.lon) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

export function calculateTrackStats(track: GPXTrack): {
  totalDistance: number;
  elevationGain: number;
  elevationLoss: number;
  maxElevation: number;
  minElevation: number;
} {
  let totalDistance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxElevation = -Infinity;
  let minElevation = Infinity;

  for (let i = 0; i < track.points.length; i++) {
    const point = track.points[i];
    
    // Update elevation stats
    if (point.ele !== undefined) {
      maxElevation = Math.max(maxElevation, point.ele);
      minElevation = Math.min(minElevation, point.ele);
      
      // Calculate elevation change
      if (i > 0 && track.points[i-1]?.ele !== undefined) {
        const elevationChange = point.ele - (track.points[i-1]?.ele || 0);
        if (elevationChange > 0) {
          elevationGain += elevationChange;
        } else {
          elevationLoss += Math.abs(elevationChange);
        }
      }
    }

    // Calculate distance
    if (i > 0) {
      totalDistance += calculateDistance(track.points[i-1], point);
    }
  }

  return {
    totalDistance,
    elevationGain,
    elevationLoss,
    maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
    minElevation: minElevation === Infinity ? 0 : minElevation
  };
}

// Convert GPX tracks to GeoJSON format for map display
export function tracksToGeoJSON(tracks: GPXTrack[], runId: string, runNumber: number): FeatureCollection<LineString> {
  const features = tracks.map((track, trackIndex) => {
    const coordinates = track.points.map(point => [point.lon, point.lat, point.ele || 0]);
    
    return {
      type: 'Feature' as const,
      properties: {
        runId,
        runNumber,
        trackIndex,
        name: track.name || `Track ${trackIndex + 1}`,
        color: track.color,
        pointCount: track.points.length
      },
      geometry: {
        type: 'LineString' as const,
        coordinates
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

// Main function to parse GPX file and convert to GeoJSON
export async function parseGPXToGeoJSON(
  gpxPath: string, 
  subAreaId?: string, 
  runNumber?: number
): Promise<FeatureCollection<LineString>> {
  try {
    let gpxContent: string;
    
    // Try to fetch the actual GPX file if path is provided
    if (gpxPath && gpxPath.trim() !== '') {
      const fetchedContent = await fetchGPXFile(gpxPath);
      
      if (fetchedContent) {
        gpxContent = fetchedContent;
      } else {
        gpxContent = generateSampleGPX(subAreaId, runNumber);
      }
    } else {
      gpxContent = generateSampleGPX(subAreaId, runNumber);
    }

    const parsedGPX = parseGPX(gpxContent);
    const runId = `run-${runNumber || 1}`;
    
    const result = tracksToGeoJSON(parsedGPX.tracks, runId, runNumber || 1);
    
    return result;
  } catch (error) {
    console.error('Error parsing GPX to GeoJSON:', {
      gpxPath,
      subAreaId,
      runNumber,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return sample data on error
    return generateSampleGeoJSON(subAreaId, runNumber);
  }
}

// Generate sample GPX data for testing
function generateSampleGPX(subAreaId?: string, runNumber?: number): string {
  const baseLat = -44.0;
  const baseLon = 168.0;
  const variation = (runNumber || 1) * 0.01;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Heli-Ski App">
  <trk>
    <name>Run ${runNumber || 1}</name>
    <trkseg>
      <trkpt lat="${baseLat + variation}" lon="${baseLon + variation}">
        <ele>1200</ele>
      </trkpt>
      <trkpt lat="${baseLat + variation + 0.005}" lon="${baseLon + variation + 0.005}">
        <ele>1150</ele>
      </trkpt>
      <trkpt lat="${baseLat + variation + 0.01}" lon="${baseLon + variation + 0.01}">
        <ele>1100</ele>
      </trkpt>
      <trkpt lat="${baseLat + variation + 0.015}" lon="${baseLon + variation + 0.015}">
        <ele>1050</ele>
      </trkpt>
      <trkpt lat="${baseLat + variation + 0.02}" lon="${baseLon + variation + 0.02}">
        <ele>1000</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
}

// Generate sample GeoJSON for fallback
function generateSampleGeoJSON(subAreaId?: string, runNumber?: number): FeatureCollection<LineString> {
  const baseLat = -44.0;
  const baseLon = 168.0;
  const variation = (runNumber || 1) * 0.01;
  
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        runId: `run-${runNumber || 1}`,
        runNumber: runNumber || 1,
        trackIndex: 0,
        name: `Run ${runNumber || 1}`,
        color: getTrackColor((runNumber || 1) - 1),
        pointCount: 5
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [baseLon + variation, baseLat + variation, 1200],
          [baseLon + variation + 0.005, baseLat + variation + 0.005, 1150],
          [baseLon + variation + 0.01, baseLat + variation + 0.01, 1100],
          [baseLon + variation + 0.015, baseLat + variation + 0.015, 1050],
          [baseLon + variation + 0.02, baseLat + variation + 0.02, 1000]
        ]
      }
    }]
  };
}
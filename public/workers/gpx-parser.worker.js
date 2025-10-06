/**
 * Web Worker for GPX parsing to prevent UI blocking
 * Handles parsing of large GPX files without freezing the main thread
 * Supports batch processing and progress reporting
 */

// Simple XML parser for Web Worker (DOMParser not available in workers)
function parseXML(xmlString) {
  try {
    // Simple regex-based XML parser for GPX files
    const cleanXML = xmlString.replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    
    function parseElement(xml) {
      const elements = [];
      const elementRegex = /<(\w+)([^>]*)>(.*?)<\/\1>/gs;
      const selfClosingRegex = /<(\w+)([^>]*)\/>/gs;
      
      let match;
      
      // Parse self-closing elements first
      while ((match = selfClosingRegex.exec(xml)) !== null) {
        const [, tagName, attributes] = match;
        const attrs = parseAttributes(attributes);
        elements.push({
          tagName,
          attributes: attrs,
          textContent: '',
          children: [],
          querySelector: function(selector) {
            return this.children.find(child => child.tagName === selector) || null;
          },
          querySelectorAll: function(selector) {
            return this.children.filter(child => child.tagName === selector);
          },
          getAttribute: function(name) {
            return this.attributes[name] || null;
          }
        });
      }
      
      // Parse regular elements
      while ((match = elementRegex.exec(xml)) !== null) {
        const [, tagName, attributes, content] = match;
        const attrs = parseAttributes(attributes);
        const children = parseElement(content);
        
        elements.push({
          tagName,
          attributes: attrs,
          textContent: content.replace(/<[^>]*>/g, '').trim(),
          children,
          querySelector: function(selector) {
            return this.children.find(child => child.tagName === selector) || null;
          },
          querySelectorAll: function(selector) {
            return this.children.filter(child => child.tagName === selector);
          },
          getAttribute: function(name) {
            return this.attributes[name] || null;
          }
        });
      }
      
      return elements;
    }
    
    function parseAttributes(attrString) {
      const attrs = {};
      const attrRegex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = attrRegex.exec(attrString)) !== null) {
        attrs[match[1]] = match[2];
      }
      return attrs;
    }
    
    const elements = parseElement(cleanXML);
    return elements[0] || null; // Return root element
  } catch (error) {
    console.error('XML parsing error:', error);
    throw new Error(`XML parsing failed: ${error.message}`);
  }
}

// GPX parsing functions (moved from gpx-parser.ts)
function parseGPX(gpxContent) {
  try {
    const doc = parseXML(gpxContent);
    
    if (!doc) {
      throw new Error('Invalid GPX content - could not parse XML');
    }
    
    const tracks = [];
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    // Parse tracks
    const trackElements = doc.querySelectorAll('trk');
    trackElements.forEach((trackElement, index) => {
      const trackName = trackElement.querySelector('name')?.textContent || `Track ${index + 1}`;
      const points = [];

      const trackPoints = trackElement.querySelectorAll('trkpt');
      trackPoints.forEach(pointElement => {
        const lat = parseFloat(pointElement.getAttribute('lat') || '0');
        const lon = parseFloat(pointElement.getAttribute('lon') || '0');
        const eleElement = pointElement.querySelector('ele');
        const timeElement = pointElement.querySelector('time');
        
        const point = {
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
        const points = [];

        const routePoints = routeElement.querySelectorAll('rtept');
        routePoints.forEach(pointElement => {
          const lat = parseFloat(pointElement.getAttribute('lat') || '0');
          const lon = parseFloat(pointElement.getAttribute('lon') || '0');
          const eleElement = pointElement.querySelector('ele');
          const timeElement = pointElement.querySelector('time');
          
          const point = {
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
    console.error('Error parsing GPX in worker:', {
      error: error instanceof Error ? error.message : String(error),
      contentLength: gpxContent.length,
      contentPreview: gpxContent.substring(0, 200)
    });
    throw error;
  }
}

function getTrackColor(index) {
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

function calculateDistance(point1, point2) {
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

function calculateTrackStats(track) {
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

function tracksToGeoJSON(tracks, runId, runNumber) {
  const features = tracks.map((track, trackIndex) => {
    const coordinates = track.points.map(point => [point.lon, point.lat, point.ele || 0]);
    
    return {
      type: 'Feature',
      properties: {
        runId,
        runNumber,
        trackIndex,
        name: track.name || `Track ${trackIndex + 1}`,
        color: track.color,
        pointCount: track.points.length
      },
      geometry: {
        type: 'LineString',
        coordinates
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

function generateSampleGPX(subAreaId, runNumber) {
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

function generateSampleGeoJSON(subAreaId, runNumber) {
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
        type: 'LineString',
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

// Main worker message handler
self.onmessage = async function(e) {
  const { runId, gpxUrl, runNumber, subAreaId, type } = e.data;
  
  try {
    if (type === 'parse-gpx') {
      // Single GPX parsing
      let gpxContent;
      
      if (gpxUrl && gpxUrl.trim() !== '') {
        // Fetch GPX content
        const response = await fetch(gpxUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch GPX: ${response.status} ${response.statusText}`);
        }
        gpxContent = await response.text();
      } else {
        gpxContent = generateSampleGPX(subAreaId, runNumber);
      }

      // Parse GPX
      const parsedGPX = parseGPX(gpxContent);
      const geoJSON = tracksToGeoJSON(parsedGPX.tracks, runId, runNumber);
      
      // Calculate metadata
      const metadata = {
        pointCount: parsedGPX.tracks.reduce((sum, track) => sum + track.points.length, 0),
        bounds: parsedGPX.bounds,
        trackCount: parsedGPX.tracks.length,
        totalDistance: parsedGPX.tracks.reduce((sum, track) => sum + calculateTrackStats(track).totalDistance, 0)
      };

      // Send result back to main thread
      self.postMessage({
        runId,
        geoJSON,
        metadata,
        success: true
      });
    } else if (type === 'batch-parse') {
      // Batch GPX parsing
      const { runs } = e.data;
      const results = [];
      
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        
        try {
          let gpxContent;
          
          if (run.gpxPath && run.gpxPath.trim() !== '') {
            const response = await fetch(run.gpxPath);
            if (!response.ok) {
              throw new Error(`Failed to fetch GPX: ${response.status}`);
            }
            gpxContent = await response.text();
          } else {
            gpxContent = generateSampleGPX(run.subAreaId, run.runNumber);
          }

          const parsedGPX = parseGPX(gpxContent);
          const geoJSON = tracksToGeoJSON(parsedGPX.tracks, run.id, run.runNumber);
          
          const metadata = {
            pointCount: parsedGPX.tracks.reduce((sum, track) => sum + track.points.length, 0),
            bounds: parsedGPX.bounds,
            trackCount: parsedGPX.tracks.length,
            totalDistance: parsedGPX.tracks.reduce((sum, track) => sum + calculateTrackStats(track).totalDistance, 0)
          };

          results.push({
            runId: run.id,
            geoJSON,
            metadata,
            success: true
          });

          // Send progress update
          self.postMessage({
            type: 'progress',
            completed: i + 1,
            total: runs.length,
            currentRunId: run.id
          });
        } catch (error) {
          results.push({
            runId: run.id,
            error: error.message,
            success: false
          });
        }
      }

      // Send final results
      self.postMessage({
        type: 'batch-complete',
        results,
        success: true
      });
    }
  } catch (error) {
    self.postMessage({
      runId,
      error: error.message,
      success: false
    });
  }
};

/**
 * Convert GeoJSON LineString or MultiLineString to GPX format
 */

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][];
  };
  properties?: {
    name?: string;
    description?: string;
        [key: string]: unknown;
  };
}

export interface GPXOptions {
  name?: string;
  description?: string;
  author?: string;
  link?: string;
  time?: Date;
}

/**
 * Convert GeoJSON coordinates to GPX track points
 */
function coordinatesToTrackPoints(coordinates: number[][]): string {
  return coordinates
    .map(([lon, lat, ele = 0]) => {
      const eleStr = ele > 0 ? `    <ele>${ele.toFixed(2)}</ele>` : '';
      return `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${eleStr}
    </trkpt>`;
    })
    .join('\n');
}

/**
 * Convert GeoJSON LineString to GPX track
 */
function lineStringToGPX(coordinates: number[][], options: GPXOptions = {}): string {
  const trackPoints = coordinatesToTrackPoints(coordinates);
  const name = options.name || 'Track';
  const description = options.description || '';
  
  return `  <trk>
    <name>${name}</name>
    ${description ? `<desc>${description}</desc>` : ''}
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>`;
}

/**
 * Convert GeoJSON MultiLineString to GPX tracks
 */
function multiLineStringToGPX(coordinates: number[][][], options: GPXOptions = {}): string {
  const name = options.name || 'Track';
  const description = options.description || '';
  
  
  const trackSegments = coordinates
    .map((segment) => {
      const trackPoints = coordinatesToTrackPoints(segment);
      return `    <trkseg>
${trackPoints}
    </trkseg>`;
    })
    .join('\n');

  return `  <trk>
    <name>${name}</name>
    ${description ? `<desc>${description}</desc>` : ''}
${trackSegments}
  </trk>`;
}

/**
 * Convert GeoJSON Feature to GPX format
 */
export function geojsonToGPX(feature: GeoJSONFeature, options: GPXOptions = {}): string {
  const { geometry, properties } = feature;
  const name = options.name || properties?.name || 'Track';
  const description = options.description || properties?.description || '';
  const author = options.author || 'CalTopo Integration';
  const link = options.link || 'https://caltopo.com';
  const time = options.time || new Date();
  
  let tracks = '';
  
  if (geometry.type === 'LineString') {
    tracks = lineStringToGPX(geometry.coordinates, { name, description, time });
  } else if (geometry.type === 'MultiLineString') {
    tracks = multiLineStringToGPX(geometry.coordinates as unknown as number[][][], { name, description, time });
  } else {
    throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${author}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    ${description ? `<desc>${description}</desc>` : ''}
    <author>
      <name>${author}</name>
      <link href="${link}"/>
    </author>
    <time>${time.toISOString()}</time>
  </metadata>
${tracks}
</gpx>`;
}

/**
 * Extract GPX track from full map GPX by feature name
 */
export function extractGPXTrackByFeatureName(
  fullGPX: string, 
  featureName: string
): string | null {
  // Simple regex-based extraction - could be improved with proper XML parsing
  const trackRegex = new RegExp(
    `<trk>\\s*<name>${featureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</name>.*?</trk>`,
    's'
  );
  
  const match = fullGPX.match(trackRegex);
  if (!match) {
    return null;
  }

  // Wrap in full GPX structure
  const trackContent = match[0];
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CalTopo Integration" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${featureName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${trackContent}
</gpx>`;

  return gpxHeader;
}

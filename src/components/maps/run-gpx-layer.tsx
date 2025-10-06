"use client";

import React from 'react';
import { Source, Layer } from 'react-map-gl/mapbox';
import type { FeatureCollection, Point } from 'geojson';
import { useProgressiveGPXData } from '@/hooks/use-progressive-gpx-loading';

interface RunData {
  id: string;
  name: string;
  subAreaId: string;
  runNumber: number;
  runDescription?: string | null;
  runNotes?: string | null;
  aspect: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  elevationMax: number;
  elevationMin: number;
  status: 'open' | 'conditional' | 'closed';
  statusComment?: string | null;
  gpxPath?: string | null;
  runPhoto?: string | null;
  avalanchePhoto?: string | null;
  additionalPhotos: string[] | null;
  caltopoMapId?: string | null;
  caltopoFeatureId?: string | null;
  gpxUpdatedAt?: Date | null;
  lastUpdated: Date;
  createdAt: Date;
  gpxData?: FeatureCollection;
}

interface RunGPXLayerProps {
  run: RunData;
  viewport: {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
  };
  isHighlighted: boolean;
  isPriority?: boolean;
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

/**
 * Individual run GPX layer component
 * Handles loading and rendering of GPX data for a single run
 */
export const RunGPXLayer: React.FC<RunGPXLayerProps> = ({
  run,
  viewport,
  isHighlighted,
  isPriority = false
}) => {
  const { data: gpxData, isLoading, error } = useProgressiveGPXData(
    run,
    viewport,
    isPriority
  );

  // Show loading state instead of returning null
  if (isLoading) {
    // Return a minimal loading indicator (invisible but keeps component mounted)
    return (
      <div style={{ display: 'none' }}>
        Loading GPX for {run.name}...
      </div>
    );
  }

  // Don't render if no GPX data available
  if (!gpxData) {
    return null;
  }

  if (error) {
    console.warn(`Failed to load GPX for run ${run.id}:`, error);
    return null;
  }

  const layerId = `run-${run.id}-track`;

  return (
    <>
      {/* GPX Track Layer */}
      <Source 
        key={`${run.id}-${run.status}`} 
        id={`run-${run.id}-source`} 
        type="geojson" 
        data={gpxData}
      >
        <Layer
          id={layerId}
          type="line"
          paint={{
            'line-color': STATUS_COLORS[run.status as keyof typeof STATUS_COLORS],
            'line-width': isHighlighted ? 5 : 3,
            'line-opacity': isHighlighted ? STATUS_OPACITY.highlighted : STATUS_OPACITY.normal
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round'
          }}
        />
      </Source>

      {/* Run Number Label */}
      {gpxData.features && gpxData.features.length > 0 && (() => {
        const firstFeature = gpxData.features[0];
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
                'text-halo-color': STATUS_COLORS[run.status as keyof typeof STATUS_COLORS],
                'text-halo-width': 2
              }}
            />
          </Source>
        );
      })()}
    </>
  );
};

export default RunGPXLayer;

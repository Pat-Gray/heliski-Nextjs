"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryFn } from '@/lib/queryClient';
import RunStatusUpdate from './run-status-update';
import ImageModal from './image-modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image, Mountain, AlertTriangle, MapPin } from 'lucide-react';
import type { Run } from '@/lib/schemas/schema';

interface RunDetailViewProps {
  runId: string | null;
  focusStatusComment: boolean;
  onBack: () => void;
  onStatusChange?: (runId: string, newStatus: 'open' | 'conditional' | 'closed') => void;
}


export default function RunDetailView({ runId, onBack, onStatusChange }: RunDetailViewProps) {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Fetch all runs to find the selected one
  const { data: runs, isLoading } = useQuery({
    queryKey: ['/api/runs'],
    queryFn: () => queryFn('/api/runs'),
  });

  useEffect(() => {
    if (runs && runId) {
      const run = runs.find((r: Run) => r.id === runId);
      setSelectedRun(run);
    }
  }, [runs, runId]);

  if (!runId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-muted-foreground">No run selected</h3>
          <p className="text-sm text-muted-foreground">Select a run to view details</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (!selectedRun) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-muted-foreground">Run not found</h3>
          <p className="text-sm text-muted-foreground">The selected run could not be found</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'conditional': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = (runId: string, newStatus: 'open' | 'conditional' | 'closed') => {
    // Update local state immediately for seamless UI update
    setSelectedRun((prev: Run | null) => prev ? ({ ...prev, status: newStatus as 'open' | 'conditional' | 'closed' }) : null);
    onStatusChange?.(runId, newStatus);
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-4">
        <button 
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center"
        >
          ← Back to runs
        </button>
      </div>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{selectedRun.name}</h2>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(selectedRun.status)}>
              {selectedRun.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Run #{selectedRun.runNumber}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Aspect</label>
                <p className="text-sm">{selectedRun.aspect || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Average Angle</label>
                <p className="text-sm">{selectedRun.averageAngle || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Elevation Range</label>
                <p className="text-sm">
                  {selectedRun.elevationMin && selectedRun.elevationMax 
                    ? `${selectedRun.elevationMin}m - ${selectedRun.elevationMax}m`
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Sub-Area</label>
                <p className="text-sm">{selectedRun.subAreaId || 'N/A'}</p>
              </div>
            </div>
            
            {selectedRun.runDescription && (
              <div>
                <label className="text-sm font-medium text-gray-500">Run Description</label>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedRun.runDescription}
                </p>
              </div>
            )}

            {selectedRun.runNotes && (
              <div>
                <label className="text-sm font-medium text-gray-500">Run Notes</label>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedRun.runNotes}
                </p>
              </div>
            )}

            {selectedRun.statusComment && (
              <div>
                <label className="text-sm font-medium text-gray-500">Status Comment</label>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedRun.statusComment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <RunStatusUpdate
              runId={selectedRun.id}
              currentStatus={selectedRun.status as 'open' | 'conditional' | 'closed'}
              currentComment={selectedRun.statusComment || undefined}
              onStatusChange={handleStatusChange}
            />
          </CardContent>
        </Card>

        {/* Images Section */}
        {(selectedRun.runPhoto || selectedRun.avalanchePhoto || (selectedRun.additionalPhotos && selectedRun.additionalPhotos.length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Images & Media</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageModal(true)}
                  className="flex items-center gap-2"
                >
                  <Image className="h-4 w-4" />
                  View All Images
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Run Photo */}
                {selectedRun.runPhoto && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                      <Mountain className="h-4 w-4" />
                      <span>Run Photo</span>
                    </div>
                    <div className="h-48 border rounded-lg overflow-hidden">
                      <img
                        src={selectedRun.runPhoto}
                        alt="Run photo"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setShowImageModal(true)}
                      />
                    </div>
                  </div>
                )}

                {/* Avalanche Photo */}
                {selectedRun.avalanchePhoto && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Avalanche Path</span>
                    </div>
                    <div className="h-48 border rounded-lg overflow-hidden">
                      <img
                        src={selectedRun.avalanchePhoto}
                        alt="Avalanche photo"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setShowImageModal(true)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Photos Preview */}
              {selectedRun.additionalPhotos && selectedRun.additionalPhotos.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                    <Image className="h-4 w-4" />
                    <span>Additional Photos ({selectedRun.additionalPhotos.length})</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedRun.additionalPhotos.slice(0, 4).map((photo, index) => (
                      <div key={index} className="h-20 border rounded-lg overflow-hidden">
                        <img
                          src={photo}
                          alt={`Additional photo ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                          onClick={() => setShowImageModal(true)}
                        />
                      </div>
                    ))}
                    {selectedRun.additionalPhotos.length > 4 && (
                      <div className="h-20 border rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
                        +{selectedRun.additionalPhotos.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GPX Track */}
              {selectedRun.gpxPath && (
                <div className="mt-4">
                  <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>GPX Track Available</span>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      GPX track data is available for this run. View the map to see the track.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Image Modal */}
        <ImageModal
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
          run={selectedRun}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryFn } from '@/lib/queryClient';
import RunStatusUpdate from './run-status-update';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RunDetailViewProps {
  runId: string | null;
  focusStatusComment: boolean;
  onBack: () => void;
  onStatusChange?: (runId: string, newStatus: 'open' | 'conditional' | 'closed') => void;
}

interface Run {
  id: string;
  name: string;
  runNumber: number;
  status: 'open' | 'conditional' | 'closed';
  statusComment?: string | null;
  aspect?: string;
  averageAngle?: string;
  elevationMin?: number;
  elevationMax?: number;
  gpxPath?: string;
  runPhoto?: string;
  avalanchePhoto?: string;
  additionalPhotos?: string[];
  subAreaId?: string;
}

export default function RunDetailView({ runId, onBack, onStatusChange }: RunDetailViewProps) {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);

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
    setSelectedRun((prev: Run | null) => prev ? ({ ...prev, status: newStatus }) : null);
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
              currentStatus={selectedRun.status}
              currentComment={selectedRun.statusComment || undefined}
              onStatusChange={handleStatusChange}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

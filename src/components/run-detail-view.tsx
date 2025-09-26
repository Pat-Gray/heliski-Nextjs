"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryFn } from '@/lib/queryClient';
import ImageModal from './image-modal';
import NZTopoMap from './nz-topo-map';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mountain, AlertTriangle, MapPin, Edit2, Save, X, Eye, Plus } from 'lucide-react';
import Image from 'next/image';
import type { Run, SubArea } from '@/lib/schemas/schema';

interface RunDetailViewProps {
  runId: string | null;
  focusStatusComment: boolean;
  onStatusChange?: (runId: string, newStatus: 'open' | 'conditional' | 'closed') => void;
}


export default function RunDetailView({ runId }: RunDetailViewProps) {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [editingField, setEditingField] = useState<'description' | 'notes' | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const queryClient = useQueryClient();

  // Fetch all runs and sub-areas to find the selected one
  const { data: runs, isLoading } = useQuery({
    queryKey: ['/api/runs'],
    queryFn: () => queryFn('/api/runs'),
  });

  const { data: subAreas = [] } = useQuery({
    queryKey: ['/api/sub-areas'],
    queryFn: () => queryFn('/api/sub-areas'),
  });

  // Update run mutation
  const updateRunMutation = useMutation({
    mutationFn: async ({ runId, updates }: { runId: string; updates: Partial<Run> }) => {
      const response = await fetch(`/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update run');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
      setEditingField(null);
    },
  });

  useEffect(() => {
    if (runs && runId) {
      const run = runs.find((r: Run) => r.id === runId);
      setSelectedRun(run);
      if (run) {
        setEditDescription(run.runDescription || '');
        setEditNotes(run.runNotes || '');
      }
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

  const handleEdit = (field: 'description' | 'notes') => {
    setEditingField(field);
  };

  const handleSave = () => {
    if (!selectedRun || !editingField) return;
    
    const updates: Partial<Run> = {};
    if (editingField === 'description') {
      updates.runDescription = editDescription;
    } else if (editingField === 'notes') {
      updates.runNotes = editNotes;
    }
    
    updateRunMutation.mutate({ runId: selectedRun.id, updates });
  };

  const handleCancel = () => {
    setEditingField(null);
    if (selectedRun) {
      setEditDescription(selectedRun.runDescription || '');
      setEditNotes(selectedRun.runNotes || '');
    }
  };

  // Get sub-area name
  const getSubAreaName = (subAreaId: string) => {
    return subAreas.find((subArea: SubArea) => subArea.id === subAreaId)?.name || subAreaId;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
        
          {selectedRun.gpxPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMap(!showMap)}
              className="flex items-center gap-2"
            >
              <MapPin className="h-4 w-4" />
              {showMap ? 'Hide Map' : 'View Map'}
            </Button>
          )}
      </div>
      
        {/* Run Title and Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{selectedRun.name}</h2>
            <span className="text-sm text-muted-foreground">#{selectedRun.runNumber}</span>
            <Badge className={getStatusColor(selectedRun.status)}>
              {selectedRun.status}
            </Badge>
          </div>
        </div>

        {/* Run Information Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Sub-Area:</span>
            <span className="ml-1 font-medium">{getSubAreaName(selectedRun.subAreaId || '') || 'N/A'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Aspect:</span>
            <span className="ml-1 font-medium">{selectedRun.aspect || 'N/A'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Angle:</span>
            <span className="ml-1 font-medium">{selectedRun.averageAngle || 'N/A'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Elevation:</span>
            <span className="ml-1 font-medium">
              {selectedRun.elevationMin && selectedRun.elevationMax 
                ? `${selectedRun.elevationMin}m - ${selectedRun.elevationMax}m`
                : 'N/A'
              }
            </span>
          </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {showMap && selectedRun.gpxPath ? (
          <div className="h-full">
            <NZTopoMap
              areaId={selectedRun.subAreaId || ''}
              subAreaId={selectedRun.subAreaId || ''}
              selectedRunId={selectedRun.id}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-4">

            {/* Run Description and Notes - Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Run Description */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Run Description</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit('description')}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingField === 'description' ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Enter run description..."
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={updateRunMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 min-h-[20px]">
                      {selectedRun.runDescription || 'No description provided'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Run Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Run Notes</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit('notes')}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingField === 'notes' ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Enter run notes..."
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={updateRunMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
              </div>
                  ) : (
                    <p className="text-sm text-gray-700 min-h-[20px]">
                      {selectedRun.runNotes || 'No notes provided'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Status Information (Read-only) */}
            {selectedRun.statusComment && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Status Comment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded-md">
                  {selectedRun.statusComment}
                </p>
                </CardContent>
              </Card>
            )}

            {/* Images Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Images & Media</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImageModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Main Photos */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Run Photo */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          <Mountain className="h-3 w-3" />
                          <span>Run Photo</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                try {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  formData.append('runId', selectedRun.id);
                                  formData.append('fieldName', 'runPhoto');
                                  
                                  const response = await fetch('/api/upload', {
                                    method: 'POST',
                                    body: formData,
                                  });
                                  
                                  if (response.ok) {
                                    const { url } = await response.json();
                                    const updateResponse = await fetch(`/api/runs/${selectedRun.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ runPhoto: url }),
                                    });
                                    if (updateResponse.ok) {
                                      queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
                                    }
                                  }
                                } catch (error) {
                                  console.error('Failed to upload run photo:', error);
                                }
                              }
                            };
                            input.click();
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="h-24 border rounded-lg overflow-hidden">
                        {selectedRun.runPhoto ? (
                          <Image
                            src={selectedRun.runPhoto}
                            alt="Run photo"
                            width={200}
                            height={96}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setShowImageModal(true)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Avalanche Photo */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Avalanche Path</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                try {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  formData.append('runId', selectedRun.id);
                                  formData.append('fieldName', 'avalanchePhoto');
                                  
                                  const response = await fetch('/api/upload', {
                                    method: 'POST',
                                    body: formData,
                                  });
                                  
                                  if (response.ok) {
                                    const { url } = await response.json();
                                    const updateResponse = await fetch(`/api/runs/${selectedRun.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ avalanchePhoto: url }),
                                    });
                                    if (updateResponse.ok) {
                                      queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
                                    }
                                  }
                                } catch (error) {
                                  console.error('Failed to upload avalanche photo:', error);
                                }
                              }
                            };
                            input.click();
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="h-24 border rounded-lg overflow-hidden">
                        {selectedRun.avalanchePhoto ? (
                          <Image
                            src={selectedRun.avalanchePhoto}
                            alt="Avalanche photo"
                            width={200}
                            height={96}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setShowImageModal(true)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Photos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Mountain className="h-3 w-3" />
                        <span>Additional Photos ({selectedRun.additionalPhotos?.length || 0})</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              try {
                                const formData = new FormData();
                                formData.append('file', file);
                                formData.append('runId', selectedRun.id);
                                formData.append('fieldName', 'additionalPhotos');
                                
                                const response = await fetch('/api/upload', {
                                  method: 'POST',
                                  body: formData,
                                });
                                
                                if (response.ok) {
                                  const { url } = await response.json();
                                  const updatedPhotos = [...(selectedRun.additionalPhotos || []), url];
                                  const updateResponse = await fetch(`/api/runs/${selectedRun.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ additionalPhotos: updatedPhotos }),
                                  });
                                  if (updateResponse.ok) {
                                    queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
                                  }
                                }
                              } catch (error) {
                                console.error('Failed to add additional photo:', error);
                              }
                            }
                          };
                          input.click();
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {selectedRun.additionalPhotos?.slice(0, 4).map((photo, index) => (
                        <div key={index} className="h-16 border rounded overflow-hidden relative group">
                          <Image
                            src={photo}
                            alt={`Additional photo ${index + 1}`}
                            width={80}
                            height={64}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setShowImageModal(true)}
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const updatedPhotos = selectedRun.additionalPhotos?.filter((_, i) => i !== index) || [];
                                const response = await fetch(`/api/runs/${selectedRun.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ additionalPhotos: updatedPhotos }),
                                });
                                if (response.ok) {
                                  queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
                                }
                              } catch (error) {
                                console.error('Failed to remove photo:', error);
                              }
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(!selectedRun.additionalPhotos || selectedRun.additionalPhotos.length === 0) && (
                        <div className="col-span-full text-center py-4 text-gray-400 text-xs">
                          No additional photos
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        run={selectedRun}
      />
    </div>
  );
}

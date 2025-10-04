"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryFn } from '@/lib/queryClient';
import NZTopoMap from './maps/nz-topo-map';
import FullscreenImageViewer from './viewers/fullscreen-image-viewer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mountain, MapPin, Edit2, Save, X, Plus, Upload } from 'lucide-react';
import Image from 'next/image';
import type { Run, SubArea } from '@/lib/schemas/schema';
import GpxUpdateButton from './gpx-update-button';


interface RunDetailViewProps {
  runId: string | null;
  focusStatusComment: boolean;
  onStatusChange?: (runId: string, newStatus: 'open' | 'conditional' | 'closed') => void;
}


export default function RunDetailView({ runId }: RunDetailViewProps) {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [editingField, setEditingField] = useState<'description' | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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
        // Debug: Log when run data changes
        console.log('🔄 Run detail view updated:', {
          runId: run.id,
          runName: run.name,
          runNotes: run.runNotes?.slice(0, 100) + '...',
          hasCalTopoMapId: !!run.caltopoMapId,
          hasCalTopoFeatureId: !!run.caltopoFeatureId
        });
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
      case 'open': return 'bg-green-500 text-white';
      case 'conditional': return 'bg-orange-500 text-white';
      case 'closed': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleEdit = (field: 'description') => {
    setEditingField(field);
  };

  const handleSave = () => {
    if (!selectedRun || !editingField) return;
    
    const updates: Partial<Run> = {};
    if (editingField === 'description') {
      updates.runDescription = editDescription;
    }
    
    // Save locally
    updateRunMutation.mutate({ runId: selectedRun.id, updates });
  };

  const handleCancel = () => {
    setEditingField(null);
    if (selectedRun) {
      setEditDescription(selectedRun.runDescription || '');
    }
  };


  // Get sub-area name
  const getSubAreaName = (subAreaId: string) => {
    return subAreas.find((subArea: SubArea) => subArea.id === subAreaId)?.name || subAreaId;
  };

  // Get all images for the selected run
  const getAllImages = (run: Run): string[] => {
    const images: string[] = [];
    
    // Add main run photo
    if (run.runPhoto) images.push(run.runPhoto);
    
    // Add avalanche photo
    if (run.avalanchePhoto) images.push(run.avalanchePhoto);
    
    // Add CalTopo photos - all are now simple string URLs
    if (run.additionalPhotos) {
      run.additionalPhotos.forEach(photo => {
        if (typeof photo === 'string') {
          images.push(photo);
        }
      });
    }
    return images;
  };

  // Handle image click
  const handleImageClick = (imageUrl: string) => {
    if (!selectedRun) return;
    const images = getAllImages(selectedRun);
    const index = images.indexOf(imageUrl);
    if (index !== -1) {
      setSelectedImageIndex(index);
      setShowImageViewer(true);
    }
  };

  // File upload handler
  const handleFileUpload = async (file: File, fieldName: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('runId', selectedRun.id);
      formData.append('fieldName', fieldName);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const { url } = await response.json();
        const updateResponse = await fetch(`/api/runs/${selectedRun.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [fieldName]: url }),
        });
        if (updateResponse.ok) {
          queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
        }
      }
    } catch (error) {
      console.error(`Failed to upload ${fieldName}:`, error);
    }
  };

  // Additional photos upload handler
  const handleAdditionalPhotoUpload = async (file: File) => {
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
          
          // Sync images to CalTopo if run is linked
          if (selectedRun.caltopoMapId && selectedRun.caltopoFeatureId) {
            try {
              const syncResponse = await fetch('/api/caltopo/sync-images-to-caltopo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ runId: selectedRun.id })
              });
              
              if (syncResponse.ok) {
                const syncResult = await syncResponse.json();
                console.log('✅ Images synced to CalTopo:', syncResult);
              } else {
                console.error('❌ Failed to sync images to CalTopo');
              }
            } catch (syncError) {
              console.error('❌ Error syncing images to CalTopo:', syncError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to add additional photo:', error);
    }
  };

  // Remove additional photo handler
  const handleRemovePhoto = async (index: number) => {
    try {
      const updatedPhotos = selectedRun.additionalPhotos?.filter((_, i) => i !== index) || [];
      const response = await fetch(`/api/runs/${selectedRun.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalPhotos: updatedPhotos }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
        
        // Sync images to CalTopo if run is linked
        if (selectedRun.caltopoMapId && selectedRun.caltopoFeatureId) {
          try {
            const syncResponse = await fetch('/api/caltopo/sync-images-to-caltopo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ runId: selectedRun.id })
            });
            
            if (syncResponse.ok) {
              const syncResult = await syncResponse.json();
              console.log('✅ Images synced to CalTopo:', syncResult);
            } else {
              console.error('❌ Failed to sync images to CalTopo');
            }
          } catch (syncError) {
            console.error('❌ Error syncing images to CalTopo:', syncError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to remove photo:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-white shadow-sm">
        <div className="flex flex-col space-y-3">
          {/* Run Title and Status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-bold truncate">{selectedRun.name}</h2>
              <span className="text-sm text-muted-foreground">#{selectedRun.runNumber}</span>
              <Badge className={getStatusColor(selectedRun.status)}>
                {capitalizeFirstLetter(selectedRun.status)}
              </Badge>
            </div>
          </div>

          {/* Run Details */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-medium">Sub-Area:</span>
              <span className="font-medium">{getSubAreaName(selectedRun.subAreaId || '') || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-medium">Aspect:</span>
              <span className="font-medium">{selectedRun.aspect || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-medium">Elevation:</span>
              <span className="font-medium">
                {selectedRun.elevationMin && selectedRun.elevationMax 
                  ? `${selectedRun.elevationMin}m - ${selectedRun.elevationMax}m`
                  : 'N/A'
                }
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <GpxUpdateButton 
              runId={selectedRun.id} 
              currentGpxPath={selectedRun.gpxPath ?? null}
            />
            {(selectedRun.gpxPath || (selectedRun.caltopoMapId && selectedRun.caltopoFeatureId)) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                {showMap ? 'Hide Map' : 'View Map'}
                {selectedRun.caltopoMapId && selectedRun.caltopoFeatureId && !selectedRun.gpxPath && (
                  <span className="ml-1 text-xs text-blue-600">• CalTopo</span>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.gpx';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      await handleFileUpload(file, 'gpxPath');
                    }
                  };
                  input.click();
                }}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload GPX
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {showMap ? (
          <div className="h-full">
            <NZTopoMap
              areaId={selectedRun.subAreaId ?? ''}
              subAreaId={selectedRun.subAreaId ?? ''}
              selectedRunId={selectedRun.id ?? ''}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Run Description and Notes - Two Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Run Description */}
                <Card className="h-fit">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Run Description</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit('description')}
                        className="h-8 w-8 p-0"
                        aria-label="Edit description"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingField === 'description' ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Enter run description..."
                          className="min-h-[100px] resize-none"
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
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {selectedRun.runDescription || 'No description provided'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* CalTopo Comment - Read Only */}
                <Card className="h-fit">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">CalTopo Comment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {selectedRun.runNotes || 'No CalTopo comment'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Images Section */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                   
                   
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Run Photo - Takes up 2/3 of the space */}
                    <div className="lg:col-span-2">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mountain className="h-4 w-4" />
                          <span className="font-medium">Main Run Photo</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                await handleFileUpload(file, 'runPhoto');
                              }
                            };
                            input.click();
                          }}
                          className="flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          {selectedRun.runPhoto ? 'Change' : 'Add Photo'}
                        </Button>
                      </div>
                      <div className="h-[400px] border rounded-lg overflow-hidden bg-gray-50">
                        {selectedRun.runPhoto ? (
                          <Image
                            src={selectedRun.runPhoto}
                            alt="Run photo"
                            width={600}
                            height={400}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => selectedRun.runPhoto && handleImageClick(selectedRun.runPhoto)}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <Mountain className="h-12 w-12 mb-2" />
                            <p className="text-sm">No main photo</p>
                            <p className="text-xs">Click &quot;Add Photo&quot; to upload</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CalTopo Photos Gallery */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mountain className="h-4 w-4" />
                          <span className="font-medium">CalTopo Photos ({selectedRun.additionalPhotos?.length || 0})</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                await handleAdditionalPhotoUpload(file);
                              }
                            };
                            input.click();
                          }}
                          aria-label="Add CalTopo photo"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                        {selectedRun.additionalPhotos && selectedRun.additionalPhotos.length > 0 ? (
                          selectedRun.additionalPhotos.map((photo, index) => {
                            const imageUrl = typeof photo === 'string' ? photo : '';
                            const imageTitle = `Additional photo ${index + 1}`;
                            
                            return (
                              <div key={index} className="relative group">
                                <div className="h-[160px] border rounded-lg overflow-hidden">
                                  <Image
                                    src={imageUrl}
                                    alt={imageTitle}
                                    width={200}
                                    height={160}
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => handleImageClick(imageUrl)}
                                  />
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePhoto(index);
                                  }}
                                  aria-label={`Remove ${imageTitle}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-32 border rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            No CalTopo photos
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Image Viewer */}
      {selectedRun && (
        <FullscreenImageViewer
          images={getAllImages(selectedRun)}
          initialIndex={selectedImageIndex}
          isOpen={showImageViewer}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Run {
  id: string;
  name: string;
  gpx_path: string | null;
  gpx_metadata: Record<string, unknown> | null;
  gpx_point_count: number | null;
  gpx_updated_at: string | null;
}

interface BatchResult {
  success: boolean;
  processed: number;
  failed: number;
  total: number;
  results: Array<{
    runId: string;
    success: boolean;
    error?: string;
  }>;
  errors?: string[];
}

/**
 * Admin tool for GPX metadata backfill
 * Provides UI to trigger batch metadata processing with progress tracking
 */
export default function GPXMetadataAdminPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [lastResult, setLastResult] = useState<BatchResult | null>(null);
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  
  const queryClient = useQueryClient();

  // Fetch runs that need metadata processing
  const { data: runs = [], isLoading: runsLoading, refetch: refetchRuns } = useQuery<Run[]>({
    queryKey: ['/api/runs'],
    queryFn: () => apiRequest('GET', '/api/runs').then(res => res.json()),
  });

  // Filter runs that need metadata processing
  const runsNeedingMetadata = runs.filter(run => 
    run.gpx_path && !run.gpx_metadata
  );

  const runsWithMetadata = runs.filter(run => 
    run.gpx_path && run.gpx_metadata
  );

  // Batch processing mutation
  const processBatchMutation = useMutation({
    mutationFn: async (runIds: string[]) => {
      const response = await apiRequest('POST', '/api/runs/batch-gpx-metadata', {
        runIds,
        batchSize: 10
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process batch');
      }
      
      return response.json();
    },
    onSuccess: (result: BatchResult) => {
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
    },
    onError: (error) => {
      console.error('Batch processing error:', error);
    }
  });

  // Process all runs that need metadata
  const handleProcessAll = async () => {
    if (runsNeedingMetadata.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentBatch(0);
    setLastResult(null);

    const batchSize = 10;
    const totalBatches = Math.ceil(runsNeedingMetadata.length / batchSize);
    setTotalBatches(totalBatches);

    const runIds = runsNeedingMetadata.map(run => run.id);
    const batches = [];
    
    for (let i = 0; i < runIds.length; i += batchSize) {
      batches.push(runIds.slice(i, i + batchSize));
    }

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < batches.length; i++) {
      setCurrentBatch(i + 1);
      
      try {
        const result = await processBatchMutation.mutateAsync(batches[i]);
        processed += result.processed;
        failed += result.failed;
        
        setProgress(Math.round(((i + 1) / batches.length) * 100));
        
        // Small delay between batches
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error);
        failed += batches[i].length;
      }
    }

    setLastResult({
      success: true,
      processed,
      failed,
      total: runIds.length,
      results: []
    });

    setIsProcessing(false);
    refetchRuns();
  };

  // Process selected runs only
  const handleProcessSelected = async () => {
    if (selectedRuns.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setLastResult(null);

    try {
      const result = await processBatchMutation.mutateAsync(selectedRuns);
      setLastResult(result);
      setProgress(100);
    } catch (error) {
      console.error('Selected batch processing error:', error);
    } finally {
      setIsProcessing(false);
      refetchRuns();
    }
  };

  // Export results
  const handleExportResults = () => {
    if (!lastResult) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        processed: lastResult.processed,
        failed: lastResult.failed,
        total: lastResult.total
      },
      results: lastResult.results,
      errors: lastResult.errors
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpx-metadata-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle run selection
  const toggleRunSelection = (runId: string) => {
    setSelectedRuns(prev => 
      prev.includes(runId) 
        ? prev.filter(id => id !== runId)
        : [...prev, runId]
    );
  };

  // Select all runs needing metadata
  const selectAllNeedingMetadata = () => {
    setSelectedRuns(runsNeedingMetadata.map(run => run.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedRuns([]);
  };

  if (runsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading runs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">GPX Metadata Management</h1>
          <p className="text-muted-foreground">
            Process and manage GPX metadata for performance optimization
          </p>
        </div>
        <Button
          onClick={() => refetchRuns()}
          variant="outline"
          disabled={isProcessing}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
            <p className="text-xs text-muted-foreground">
              {runs.filter(r => r.gpx_path).length} with GPX data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Needs Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{runsNeedingMetadata.length}</div>
            <p className="text-xs text-muted-foreground">
              Missing metadata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{runsWithMetadata.length}</div>
            <p className="text-xs text-muted-foreground">
              With metadata
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Processing Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Processing</CardTitle>
          <CardDescription>
            Process GPX metadata in batches to improve performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing batch {currentBatch} of {totalBatches}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleProcessAll}
              disabled={isProcessing || runsNeedingMetadata.length === 0}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Process All ({runsNeedingMetadata.length})
            </Button>

            <Button
              onClick={handleProcessSelected}
              disabled={isProcessing || selectedRuns.length === 0}
              variant="outline"
            >
              Process Selected ({selectedRuns.length})
            </Button>

            {lastResult && (
              <Button
                onClick={handleExportResults}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            )}
          </div>

          {runsNeedingMetadata.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={selectAllNeedingMetadata}
                variant="outline"
                size="sm"
              >
                Select All Needing Processing
              </Button>
              <Button
                onClick={clearSelection}
                variant="outline"
                size="sm"
              >
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{lastResult.processed}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{lastResult.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{lastResult.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>

            {lastResult.errors && lastResult.errors.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Errors encountered:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {lastResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {lastResult.errors.length > 5 && (
                      <li>... and {lastResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Runs Status</CardTitle>
          <CardDescription>
            View and select runs for metadata processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {runs.filter(r => r.gpx_path).map(run => {
              const hasMetadata = !!run.gpx_metadata;
              const isSelected = selectedRuns.includes(run.id);
              
              return (
                <div
                  key={run.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleRunSelection(run.id)}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRunSelection(run.id)}
                      className="rounded"
                    />
                    <div>
                      <div className="font-medium">{run.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {run.gpx_point_count ? `${run.gpx_point_count} points` : 'No metadata'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasMetadata ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Processed
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Needs Processing
                      </Badge>
                    )}
                    {run.gpx_updated_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.gpx_updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

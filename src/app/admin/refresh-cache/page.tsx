"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/contexts/hooks/use-toast";

interface RefreshResult {
  success: boolean;
  refreshed: number;
  skipped: number;
  failed: number;
  errors: Array<{ runId: string; error: string }>;
  message: string;
}

export default function RefreshCachePage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastResult(null);

    try {
      const response = await fetch('/api/caltopo/refresh-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setLastResult(result);

      if (result.success) {
        toast({
          title: "Cache refresh completed",
          description: result.message,
        });
      } else {
        toast({
          title: "Cache refresh failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: unknown) {
      console.error('Refresh failed:', error);
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cache Refresh</h1>
          <p className="text-muted-foreground">
            Manually refresh cached GPX files from CalTopo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh Cache'}
          </Button>
        </div>
      </div>


      {/* Results */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              Refresh Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {lastResult.refreshed}
                </div>
                <div className="text-sm text-muted-foreground">Refreshed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {lastResult.skipped}
                </div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {lastResult.failed}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <p className="text-sm">{lastResult.message}</p>
            </div>

            {lastResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Errors:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {lastResult.errors.map((error, index) => (
                    <div key={index} className="text-xs text-red-600 p-2 bg-red-50 rounded">
                      <strong>{error.runId.substring(0, 8)}...</strong>: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• This tool checks all CalTopo-linked runs for changes</p>
          <p>• It compares the last update timestamp with CalTopo&apos;s &quot;since&quot; endpoint</p>
          <p>• Only runs with detected changes will be refreshed</p>
          <p>• GPX files are cached in Supabase Storage for fast dashboard rendering</p>
          <p>• This can be automated with a cron job calling <code>/api/cron/refresh-gpx</code></p>
        </CardContent>
      </Card>
    </div>
  );
}

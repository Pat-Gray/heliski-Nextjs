import { useQuery } from '@tanstack/react-query';

interface GPXUrlResponse {
  success: boolean;
  gpxUrl?: string;
  cached: boolean;
  error?: string;
}

export function useGPXUrl(runId: string | null) {
  return useQuery<GPXUrlResponse>({
    queryKey: ['/api/caltopo/gpx-url', runId],
    queryFn: async () => {
      if (!runId) {
        throw new Error('No run ID provided');
      }

      const response = await fetch('/api/caltopo/gpx-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch GPX URL: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!runId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
}

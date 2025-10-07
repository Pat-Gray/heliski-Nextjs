import { useQuery } from '@tanstack/react-query';
import type { Run } from '@/lib/schemas/schema';
import { queryFn } from '@/lib/queryClient';

export function useRunsForArea(areaId: string, subAreaId?: string) {
  return useQuery<Run[]>({
    queryKey: ['/api/runs/by-area', areaId, subAreaId],
    queryFn: async () => {
      if (!areaId) return [];
      
      // Fetch runs for specific area from API
      const response = await fetch(`/api/runs/by-area?areaId=${areaId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch runs for area');
      }
      
      const data = await response.json();
      let runs = data.runs || [];
      
      // If subAreaId is specified, filter by sub-area
      if (subAreaId) {
        runs = runs.filter((run: Run) => run.subAreaId === subAreaId);
      }
      
      return runs;
    },
    enabled: !!areaId,
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache for area-specific data
  });
}
import { useQuery } from '@tanstack/react-query';
import type { Run } from '@/lib/schemas/schema';
import { queryFn } from '@/lib/queryClient';

export function useRunsForArea(areaId: string, subAreaId?: string) {
  return useQuery<Run[]>({
    queryKey: ['/api/runs'],
    queryFn: () => queryFn('/api/runs'),
    select: (data: Run[]) => {
      // Filter runs by sub-area if specified, otherwise by area
      let filteredRuns = data;
      
      if (subAreaId) {
        // Filter to only show runs from the specific sub-area
        filteredRuns = data.filter((run: Run) => run.subAreaId === subAreaId);
      } else {
        // If no sub-area specified, show all runs (for area view)
        filteredRuns = data;
      }

      return filteredRuns;
    },
    enabled: !!areaId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
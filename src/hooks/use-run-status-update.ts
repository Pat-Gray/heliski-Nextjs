import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryFn } from '@/lib/queryClient';

interface UpdateRunStatusParams {
  runId: string;
  status: 'open' | 'conditional' | 'closed';
  statusComment?: string;
}

export function useRunStatusUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId, status, statusComment }: UpdateRunStatusParams) => {
      const response = await fetch(`/api/runs/${runId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status, 
          statusComment: statusComment || null 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update run status');
      }

      return response.json();
    },
    onMutate: async ({ runId, status, statusComment }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/runs'] });

      // Snapshot the previous value
      const previousRuns = queryClient.getQueryData(['/api/runs']);

      // Optimistically update the cache
      queryClient.setQueryData(['/api/runs'], (old: any) => {
        if (!old) return old;
        return old.map((run: any) => 
          run.id === runId 
            ? { ...run, status, statusComment: statusComment || run.statusComment }
            : run
        );
      });

      // Return a context object with the snapshotted value
      return { previousRuns };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousRuns) {
        queryClient.setQueryData(['/api/runs'], context.previousRuns);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: ['/api/runs'] });
    },
  });
}

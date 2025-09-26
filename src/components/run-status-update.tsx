'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRunStatusUpdate } from '@/hooks/use-run-status-update';
import { Loader2 } from 'lucide-react';

interface RunStatusUpdateProps {
  runId: string;
  currentStatus: 'open' | 'conditional' | 'closed';
  currentComment?: string;
  onStatusChange?: (runId: string, newStatus: 'open' | 'conditional' | 'closed') => void;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'text-green-600' },
  { value: 'conditional', label: 'Conditional', color: 'text-yellow-600' },
  { value: 'closed', label: 'Closed', color: 'text-red-600' },
];

export default function RunStatusUpdate({ 
  runId, 
  currentStatus, 
  currentComment,
  onStatusChange 
}: RunStatusUpdateProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [comment, setComment] = useState(currentComment || '');
  
  const updateStatusMutation = useRunStatusUpdate();

  const handleStatusUpdate = async () => {
    if (selectedStatus === currentStatus) return;

    try {
      await updateStatusMutation.mutateAsync({
        runId,
        status: selectedStatus,
        statusComment: comment || undefined,
      });
      
      onStatusChange?.(runId, selectedStatus);
    } catch (error) {
      console.error('Failed to update run status:', error);
      // Reset to current status on error
      setSelectedStatus(currentStatus);
    }
  };

  const selectedOption = STATUS_OPTIONS.find(option => option.value === selectedStatus);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Run Status
        </label>
        <Select value={selectedStatus} onValueChange={(value: 'open' | 'conditional' | 'closed') => setSelectedStatus(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className={option.color}>{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Status Comment (Optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment about the run status..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
      </div>

      <Button
        onClick={handleStatusUpdate}
        disabled={updateStatusMutation.isPending || selectedStatus === currentStatus}
        className="w-full"
      >
        {updateStatusMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          'Update Status'
        )}
      </Button>

      {selectedStatus !== currentStatus && (
        <p className="text-sm text-gray-500 text-center">
          Status will change from <span className="font-medium">{currentStatus}</span> to{' '}
          <span className={`font-medium ${selectedOption?.color}`}>{selectedOption?.label}</span>
        </p>
      )}
    </div>
  );
}

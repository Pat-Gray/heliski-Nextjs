"use client";

import { useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import RunDetailView from "../run-detail-view";

interface RunDetailSideModalProps {
  isOpen: boolean;
  onClose: () => void;
  runId: string | null;
  focusStatusComment?: boolean;
}

export default function RunDetailSideModal({ 
  isOpen, 
  onClose, 
  runId, 
  focusStatusComment = false
}: RunDetailSideModalProps) {

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-full h-full p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
            <h2 className="text-lg font-semibold">Run Details</h2>
           
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <RunDetailView 
              runId={runId} 
              focusStatusComment={focusStatusComment}
            />
          </div>
        </div>
      </DialogContent>

    </Dialog>
  );
}

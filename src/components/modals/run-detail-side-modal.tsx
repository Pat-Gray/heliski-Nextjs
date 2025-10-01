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
      <DialogContent className="max-w-7xl max-h-[90vh] w-full h-full p-1 overflow-hidden mx-4 sm:mx-0">
        
          
            <RunDetailView 
              runId={runId} 
              focusStatusComment={focusStatusComment}
            />
          
        
      </DialogContent>

    </Dialog>
  );
}

"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Area } from "@/lib/schemas/schema";

interface DailyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  showOverrideOption: boolean;
  existingDailyPlan: { id: string } | null;
  selectedAreas: Set<string>;
  areas: Area[];
  greenCount: number;
  orangeCount: number;
  redCount: number;
  filteredRunsLength: number;
  isSubmitting: boolean;
}

export default function DailyPlanModal({
  isOpen,
  onClose,
  onSubmit,
  showOverrideOption,
  existingDailyPlan,
  selectedAreas,
  areas,
  greenCount,
  orangeCount,
  redCount,
  filteredRunsLength,
  isSubmitting,
}: DailyPlanModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showOverrideOption ? 'Override Existing Daily Plan' : 'Confirm Daily Plan Submission'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {showOverrideOption && existingDailyPlan ? (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-800 mb-2">⚠️ Daily Plan Already Exists</h4>
                <p className="text-orange-700">
                  A daily plan for today already exists (ID: {existingDailyPlan.id.slice(0, 8)}...)
                </p>
                <p className="text-orange-700 mt-2">
                  Would you like to replace it with the current run statuses?
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">New Plan Summary:</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{greenCount}</div>
                    <div className="text-sm text-muted-foreground">Open</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{orangeCount}</div>
                    <div className="text-sm text-muted-foreground">Conditional</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{redCount}</div>
                    <div className="text-sm text-muted-foreground">Closed</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Selected Areas:</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedAreas).map(areaId => {
                    const area = areas.find(a => a.id === areaId);
                    return (
                      <Badge key={areaId} variant="secondary">
                        {area?.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Run Summary:</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{greenCount}</div>
                    <div className="text-sm text-muted-foreground">Open</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{orangeCount}</div>
                    <div className="text-sm text-muted-foreground">Conditional</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{redCount}</div>
                    <div className="text-sm text-muted-foreground">Closed</div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total runs: {filteredRunsLength} from {selectedAreas.size} area{selectedAreas.size !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={isSubmitting}
            className={showOverrideOption ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {isSubmitting 
              ? "Submitting..." 
              : showOverrideOption 
                ? "Replace Daily Plan" 
                : "Submit Daily Plan"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

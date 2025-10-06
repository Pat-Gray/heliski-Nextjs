"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Printer } from "lucide-react";

interface StatusUpdatePanelProps {
  filteredRunsLength: number;
  onSubmitDailyPlan: () => void;
  onTriggerPrint: () => void;
  selectedAreasSize: number;
}

export default function StatusUpdatePanel({
  filteredRunsLength,
  onSubmitDailyPlan,
  onTriggerPrint,
  selectedAreasSize,
}: StatusUpdatePanelProps) {
  if (selectedAreasSize === 0) {
    return null;
  }

  return (
    <div className="flex items-center m-4 space-x-4">
      <Button 
        onClick={onSubmitDailyPlan}
        disabled={filteredRunsLength === 0}
        data-testid="button-submit-daily-plan"
        size="sm"
        title={filteredRunsLength === 0 ? "Select runs first" : "Submit daily plan"}
      >
        <Plus className="w-4 h-4 mr-2" />
        Submit Daily Plan
      </Button>
      <Button 
        onClick={onTriggerPrint}
        variant="outline"
        size="sm"
      >
        <Printer className="h-4 w-4 mr-2" />
        Print Plan
      </Button>
    </div>
  );
}

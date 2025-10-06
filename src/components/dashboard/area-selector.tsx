"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mountain, CheckCircle } from "lucide-react";
import DashboardFilters from "@/components/dashboard-filters";
import type { Area, SubArea } from "@/lib/schemas/schema";

interface AreaSelectorProps {
  areas: Area[];
  subAreas: SubArea[];
  selectedAreas: Set<string>;
  showAreaSelection: boolean;
  onAreaToggle: (areaId: string) => void;
  onToggleAreaSelection: () => void;
  onApplyRiskAssessment: (assessment: {
    strategicMindset: string;
    primaryHazard: string;
    secondaryFactors: {
      newSnow: boolean;
      windLoading: boolean;
      temperatureRise: boolean;
      windSpeed: string;
      windDirection: string;
    };
  }) => void;
}

export default function AreaSelector({
  areas,
  subAreas,
  selectedAreas,
  showAreaSelection,
  onAreaToggle,
  onToggleAreaSelection,
  onApplyRiskAssessment,
}: AreaSelectorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Button 
            onClick={onToggleAreaSelection}
            variant="outline"
          >
            <Mountain className="w-4 h-4 mr-2" />
            {showAreaSelection ? "Hide Areas" : "Show Areas"}
          </Button>
          {selectedAreas.size > 0 && (
            <DashboardFilters onApplyRiskAssessment={onApplyRiskAssessment} />
          )}
        </div>
      </div>

      {/* Area Selection Grid */}
      {showAreaSelection && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
          {areas.map(area => (
            <Card 
              key={area.id} 
              className={`cursor-pointer transition-all ${
                selectedAreas.has(area.id) 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:shadow-md'
              }`}
              onClick={() => onAreaToggle(area.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <h4 className="font-medium">{area.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {subAreas.filter(sa => sa.areaId === area.id).length} sub-areas
                      </p>
                    </div>
                  </div>
                  {selectedAreas.has(area.id) && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

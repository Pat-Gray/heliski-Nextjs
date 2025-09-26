"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Printer } from "lucide-react";
import Navigation from "@/components/navigation";
import { usePrint } from "@/components/print-provider";
import type { DailyPlan, Run, Area, SubArea } from "@/lib/schemas/schema";
import { queryFn } from "@/lib/queryClient";

export default function DailyPlans() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { setPrintData, triggerPrint } = usePrint();

  const { data: dailyPlans = [], isLoading: dailyPlansLoading } = useQuery<DailyPlan[]>({
    queryKey: ["/api/daily-plans"],
    queryFn: () => queryFn("/api/daily-plans"),
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: () => queryFn("/api/runs"),
  });

  const { data: areas = [], isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    queryFn: () => queryFn("/api/areas"),
  });

  const { data: subAreas = [], isLoading: subAreasLoading } = useQuery<SubArea[]>({
    queryKey: ["/api/sub-areas"],
    queryFn: () => queryFn("/api/sub-areas"),
  });

  const isLoading = dailyPlansLoading || runsLoading || areasLoading || subAreasLoading;

  const getAngleLabel = (angle: string) => {
    switch (angle) {
      case 'gentle': return 'Gentle (≤25°)';
      case 'moderate': return 'Moderate (26-35°)';
      case 'steep': return 'Steep (36-45°)';
      case 'very_steep': return 'Very Steep (>45°)';
      default: return angle;
    }
  };

  const selectedPlan = selectedDate 
    ? dailyPlans.find(plan => 
        new Date(plan.planDate).toDateString() === selectedDate.toDateString()
      )
    : null;

  const selectedRuns = selectedPlan && selectedPlan.runIds
    ? runs.filter(run => selectedPlan.runIds.includes(run.id))
    : [];

  // Group runs by area and sub-area
  const groupedRuns = selectedRuns.reduce((acc, run) => {
    const subArea = subAreas.find(sa => sa.id === run.subAreaId);
    if (!subArea) return acc;
    
    const area = areas.find(a => a.id === subArea.areaId);
    if (!area) return acc;
    
    if (!acc[area.id]) {
      acc[area.id] = {
        area,
        subAreas: {}
      };
    }
    
    if (!acc[area.id].subAreas[subArea.id]) {
      acc[area.id].subAreas[subArea.id] = {
        subArea,
        runs: []
      };
    }
    
    acc[area.id].subAreas[subArea.id].runs.push(run);
    return acc;
  }, {} as Record<string, { area: Area; subAreas: Record<string, { subArea: SubArea; runs: Run[] }> }>);

  const getStatusCounts = (runIds: string[] | undefined) => {
    if (!runIds || !Array.isArray(runIds)) {
      return {
        open: 0,
        conditional: 0,
        closed: 0,
      };
    }
    
    const planRuns = runs.filter(run => runIds.includes(run.id));
    return {
      open: planRuns.filter(run => run.status === "open").length,
      conditional: planRuns.filter(run => run.status === "conditional").length,
      closed: planRuns.filter(run => run.status === "closed").length,
    };
  };


  const handlePrintPlan = () => {
    if (!selectedPlan) return;
    
    // Get the areas that are included in this plan
    const planAreas = areas.filter(area => {
      const areaSubAreas = subAreas.filter(sa => sa.areaId === area.id);
      return areaSubAreas.some(sa => selectedRuns.some(run => run.subAreaId === sa.id));
    });
    
    // Get the selected areas set for the print component
    const selectedAreasSet = new Set(planAreas.map(area => area.id));
    
    // Set print data and trigger print
    setPrintData({
      areas: planAreas,
      subAreas,
      filteredRuns: selectedRuns,
      selectedAreas: selectedAreasSet,
      currentDate: selectedDate?.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) || new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      greenCount: getStatusCounts(selectedPlan.runIds).open,
      orangeCount: getStatusCounts(selectedPlan.runIds).conditional,
      redCount: getStatusCounts(selectedPlan.runIds).closed,
    });
    
    // Trigger print with a small delay
    setTimeout(() => {
      triggerPrint();
    }, 100);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Daily Plans</h1>
              <p className="text-sm text-muted-foreground">Plan Management</p>
            </div>
          </div>
        </div>

        <Navigation />
        
        {/* Daily Plans List */}
        <div className="flex-1 p-4 border-t border-border">
          <h3 className="font-semibold text-sm text-muted-foreground mb-3">Recent Plans</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {dailyPlans
              .sort((a, b) => new Date(b.planDate).getTime() - new Date(a.planDate).getTime())
              .slice(0, 10)
              .map((plan) => {
                const planDate = new Date(plan.planDate);
                const isSelected = selectedDate && planDate.toDateString() === selectedDate.toDateString();
                const counts = getStatusCounts(plan.runIds);
                
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedDate(planDate)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {planDate.toLocaleDateString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {plan.runIds?.length || 0} runs
                      </span>
                    </div>
                    <div className="flex space-x-2 text-xs">
                      <span className="text-green-600">{counts.open}O</span>
                      <span className="text-orange-600">{counts.conditional}C</span>
                      <span className="text-red-600">{counts.closed}X</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-card border-b border-border px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Daily Planning</h2>
          </div>
        </header>

        <main className="flex-1 p-6 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading daily plans...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Calendar */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                  data-testid="calendar-date-picker"
                />
                
               
              </CardContent>
            </Card>

            {/* Plan Details */}
            <Card className="flex flex-col h-full">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                <CardTitle>
                  Plan Details
                  {selectedDate && (
                    <span className="text-base font-normal text-muted-foreground ml-2">
                      - {selectedDate.toLocaleDateString()}
                    </span>
                  )}
                </CardTitle>
                  {selectedPlan && (
                    <Button
                      onClick={handlePrintPlan}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Print Plan</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                {selectedPlan ? (
                  <div className="flex flex-col h-full">
                    <div className="flex-shrink-0 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Selected Runs ({selectedRuns.length})</h3>
                        <div className="flex space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-green-700 font-medium">{getStatusCounts(selectedPlan.runIds).open} Open</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span className="text-orange-700 font-medium">{getStatusCounts(selectedPlan.runIds).conditional} Conditional</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-red-700 font-medium">{getStatusCounts(selectedPlan.runIds).closed} Closed</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2">
                      <div className="space-y-6">
                        {Object.values(groupedRuns).map(({ area, subAreas }) => (
                          <div key={area.id} className="space-y-4">
                            {/* Area Header */}
                            <div className="border-l-4 border-blue-500 pl-4">
                              <h4 className="text-lg font-semibold text-gray-900">{area.name}</h4>
                            </div>
                            
                            {/* Sub-areas */}
                            {Object.values(subAreas).map(({ subArea, runs: subAreaRuns }) => (
                              <div key={subArea.id} className="ml-4 space-y-3">
                                {/* Sub-area Header */}
                                <div className="border-l-2 border-gray-300 pl-3">
                                  <h5 className="text-md font-medium text-gray-700">{subArea.name}</h5>
                                </div>
                                
                                {/* Runs in this sub-area */}
                                <div className="space-y-2">
                                  {subAreaRuns
                                    .sort((a, b) => a.runNumber - b.runNumber)
                                    .map((run) => (
                          <div 
                            key={run.id} 
                                      className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                            data-testid={`selected-run-${run.id}`}
                          >
                                      <div className="flex items-center space-x-3">
                                        <div>
                                          <div className="font-medium">#{run.runNumber} {run.name}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {run.aspect} • {getAngleLabel(run.averageAngle)} • {run.elevationMax}-{run.elevationMin}m
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Badge 
                                          className={
                                            run.status === "open" ? "bg-green-500 hover:bg-green-600" :
                                            run.status === "conditional" ? "bg-orange-500 hover:bg-orange-600" :
                                            "bg-red-500 hover:bg-red-600"
                                          }
                                        >
                                          {run.status === "open" ? "Open" :
                                           run.status === "conditional" ? "Conditional" : "Closed"}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      {selectedDate 
                        ? "No plan exists for this date" 
                        : "Select a date to view plan details"
                      }
                    </p>
                   
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}

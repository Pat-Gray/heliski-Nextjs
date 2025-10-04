"use client";

import { useState, useMemo, useCallback, memo } from "react";
import ProtectedRoute from "@/components/auth/protected-route";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Printer, ChevronDown, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, AlertCircle } from "lucide-react";
import { usePrint } from "@/components/print-provider";
import type { DailyPlan, Run, Area, SubArea } from "@/lib/schemas/schema";
import { queryFn } from "@/lib/queryClient";

// Memoized components for better performance
const StatusBadge = memo(({ status }: { status: string }) => {
  const statusConfig = {
    open: { 
      className: "bg-green-500 hover:bg-green-600 text-white", 
      label: "Open" 
    },
    conditional: { 
      className: "bg-orange-500 hover:bg-orange-600 text-white", 
      label: "Conditional" 
    },
    closed: { 
      className: "bg-red-500 hover:bg-red-600 text-white", 
      label: "Closed" 
    }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.closed;

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
});

StatusBadge.displayName = "StatusBadge";

const RunCard = memo(({ run }: { run: Run }) => (
  <div 
    key={run.id} 
    className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
    data-testid={`selected-run-${run.id}`}
  >
    <div className="flex items-center space-x-3 flex-1 min-w-0">
      <div className="flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 truncate">
          #{run.runNumber} {run.name}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <MapPin className="w-3 h-3" />
          <span>{run.aspect}</span>
          <span>•</span>
          <span>{run.elevationMax}-{run.elevationMin}m</span>
        </div>
      </div>
    </div>
    <div className="flex items-center space-x-2 flex-shrink-0">
      {run.statusComment && (
        <div className="text-sm text-muted-foreground max-w-32 truncate" title={run.statusComment}>
          {run.statusComment}
        </div>
      )}
      <StatusBadge status={run.status} />
    </div>
  </div>
));

RunCard.displayName = "RunCard";

const SubAreaSection = memo(({ 
  subArea, 
  runs, 
  isCollapsed, 
  onToggle 
}: { 
  subArea: SubArea; 
  runs: Run[]; 
  isCollapsed: boolean; 
  onToggle: () => void;
}) => (
  <div className="ml-4 space-y-3">
    <div className="border-l-2 border-gray-300 pl-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left hover:bg-gray-50 p-2 -m-2 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        aria-expanded={!isCollapsed}
        aria-controls={`subarea-${subArea.id}`}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
        <h5 className="text-md font-medium text-gray-700">{subArea.name}</h5>
        <span className="text-sm text-gray-500">({runs.length})</span>
      </button>
    </div>
    
    {!isCollapsed && (
      <div id={`subarea-${subArea.id}`} className="space-y-2">
        {runs
          .sort((a, b) => a.runNumber - b.runNumber)
          .map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
      </div>
    )}
  </div>
));

SubAreaSection.displayName = "SubAreaSection";

const AreaSection = memo(({ 
  area, 
  subAreas, 
  isCollapsed, 
  onToggle,
  collapsedSubAreas,
  toggleSubArea
}: { 
  area: Area; 
  subAreas: Record<string, { subArea: SubArea; runs: Run[] }>; 
  isCollapsed: boolean; 
  onToggle: () => void;
  collapsedSubAreas: Set<string>;
  toggleSubArea: (id: string) => void;
}) => {
  const totalRuns = Object.values(subAreas).reduce((sum, { runs }) => sum + runs.length, 0);
  
  return (
    <div className="space-y-4">
      <div className="border-l-4 border-blue-500 pl-4">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 w-full text-left hover:bg-gray-50 p-2 -m-2 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          aria-expanded={!isCollapsed}
          aria-controls={`area-${area.id}`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
          <h4 className="text-lg font-semibold text-gray-900">{area.name}</h4>
          <span className="text-sm text-gray-500">({totalRuns} runs)</span>
        </button>
      </div>
      
      {!isCollapsed && (
        <div id={`area-${area.id}`} className="space-y-4">
          {Object.values(subAreas).map(({ subArea, runs }) => (
            <SubAreaSection
              key={subArea.id}
              subArea={subArea}
              runs={runs}
              isCollapsed={collapsedSubAreas.has(subArea.id)}
              onToggle={() => toggleSubArea(subArea.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

AreaSection.displayName = "AreaSection";

const LoadingSpinner = memo(() => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading daily plans...</p>
    </div>
  </div>
));

LoadingSpinner.displayName = "LoadingSpinner";

const EmptyState = memo(({ selectedDate }: { selectedDate: Date | undefined }) => (
  <div className="text-center py-12">
    <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground mb-4">
      {selectedDate 
        ? "No plan exists for this date" 
        : "Select a date to view plan details"
      }
    </p>
    {selectedDate && (
      <p className="text-sm text-muted-foreground">
        Try selecting a different date or create a new plan.
      </p>
    )}
  </div>
));

EmptyState.displayName = "EmptyState";

export default function DailyPlans() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [collapsedSubAreas, setCollapsedSubAreas] = useState<Set<string>>(new Set());
  const { setPrintData, triggerPrint } = usePrint();

  // Memoized toggle functions for better performance
  const toggleArea = useCallback((areaId: string) => {
    setCollapsedAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(areaId)) {
        newSet.delete(areaId);
      } else {
        newSet.add(areaId);
      }
      return newSet;
    });
  }, []);

  const toggleSubArea = useCallback((subAreaId: string) => {
    setCollapsedSubAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subAreaId)) {
        newSet.delete(subAreaId);
      } else {
        newSet.add(subAreaId);
      }
      return newSet;
    });
  }, []);

  // Optimized data fetching with stale time for better performance
  const { data: dailyPlans = [], isLoading: dailyPlansLoading } = useQuery<DailyPlan[]>({
    queryKey: ["/api/daily-plans"],
    queryFn: () => queryFn("/api/daily-plans"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: () => queryFn("/api/runs"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: areas = [], isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    queryFn: () => queryFn("/api/areas"),
    staleTime: 10 * 60 * 1000, // 10 minutes - areas change less frequently
    refetchOnWindowFocus: false,
  });

  const { data: subAreas = [], isLoading: subAreasLoading } = useQuery<SubArea[]>({
    queryKey: ["/api/sub-areas"],
    queryFn: () => queryFn("/api/sub-areas"),
    staleTime: 10 * 60 * 1000, // 10 minutes - sub-areas change less frequently
    refetchOnWindowFocus: false,
  });

  const isLoading = dailyPlansLoading || runsLoading || areasLoading || subAreasLoading;


  // Memoized computations for better performance
  const selectedPlan = useMemo(() => {
    if (!selectedDate) return null;
    return dailyPlans.find(plan => 
      new Date(plan.planDate).toDateString() === selectedDate.toDateString()
    ) || null;
  }, [selectedDate, dailyPlans]);

  const selectedRuns = useMemo(() => {
    if (!selectedPlan?.runIds) return [];
    return runs.filter(run => selectedPlan.runIds.includes(run.id));
  }, [selectedPlan, runs]);

  // Memoized grouping of runs by area and sub-area
  const groupedRuns = useMemo(() => {
    if (!selectedRuns.length) return {};
    
    return selectedRuns.reduce((acc, run) => {
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
  }, [selectedRuns, subAreas, areas]);

  // Memoized status counts
  const statusCounts = useMemo(() => {
    if (!selectedPlan?.runIds || !Array.isArray(selectedPlan.runIds)) {
      return { open: 0, conditional: 0, closed: 0 };
    }
    
    const planRuns = runs.filter(run => selectedPlan.runIds.includes(run.id));
    return {
      open: planRuns.filter(run => run.status === "open").length,
      conditional: planRuns.filter(run => run.status === "conditional").length,
      closed: planRuns.filter(run => run.status === "closed").length,
    };
  }, [selectedPlan, runs]);

  // Memoized print data preparation
  const printData = useMemo(() => {
    if (!selectedPlan) return null;
    
    const planAreas = areas.filter(area => {
      const areaSubAreas = subAreas.filter(sa => sa.areaId === area.id);
      return areaSubAreas.some(sa => selectedRuns.some(run => run.subAreaId === sa.id));
    });
    
    return {
      areas: planAreas,
      subAreas,
      filteredRuns: selectedRuns,
      selectedAreas: new Set(planAreas.map(area => area.id)),
      currentDate: selectedDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      greenCount: statusCounts.open,
      orangeCount: statusCounts.conditional,
      redCount: statusCounts.closed,
    };
  }, [selectedPlan, areas, subAreas, selectedRuns, selectedDate, statusCounts]);


  // Optimized print handler
  const handlePrintPlan = useCallback(() => {
    if (!printData) return;
    
    setPrintData(printData);
    
    // Trigger print with a small delay to ensure content is rendered
    setTimeout(() => {
      triggerPrint();
    }, 100);
  }, [printData, setPrintData, triggerPrint]);

  return (
    <ProtectedRoute>
      <div className="h-full flex flex-col">
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden p-4 lg:p-6 gap-6">
            {/* Calendar Sidebar */}
            <div className="lg:w-80 flex-shrink-0">
              <Card className="h-fit sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Select Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border-0"
                    data-testid="calendar-date-picker"
                  />
                  
                  {/* Quick stats for selected date */}
                  {selectedPlan && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Plan Summary
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Total Runs:</span>
                          <span className="font-medium">{selectedRuns.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Areas:</span>
                          <span className="font-medium">{Object.keys(groupedRuns).length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 flex flex-col">
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-shrink-0 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Plan Details
                        {selectedDate && (
                          <span className="text-base font-normal text-muted-foreground">
                            - {selectedDate.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </span>
                        )}
                      </CardTitle>
                    </div>
                    {selectedPlan && (
                      <Button
                        onClick={handlePrintPlan}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Plan</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : selectedPlan ? (
                    <div className="flex flex-col h-full">
                      {/* Status Summary */}
                      <div className="flex-shrink-0 p-6 border-b bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Selected Runs ({selectedRuns.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <div>
                              <div className="text-green-700 font-semibold text-lg">{statusCounts.open}</div>
                              <div className="text-green-600 text-sm">Open</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <div>
                              <div className="text-orange-700 font-semibold text-lg">{statusCounts.conditional}</div>
                              <div className="text-orange-600 text-sm">Conditional</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div>
                              <div className="text-red-700 font-semibold text-lg">{statusCounts.closed}</div>
                              <div className="text-red-600 text-sm">Closed</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Scrollable Content */}
                      <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6 space-y-6 pb-12">
                          {Object.values(groupedRuns).map(({ area, subAreas }) => (
                            <AreaSection
                              key={area.id}
                              area={area}
                              subAreas={subAreas}
                              isCollapsed={collapsedAreas.has(area.id)}
                              onToggle={() => toggleArea(area.id)}
                              collapsedSubAreas={collapsedSubAreas}
                              toggleSubArea={toggleSubArea}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState selectedDate={selectedDate} />
                  )}
                </CardContent>
              </Card>
            </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

"use client";

import { useState} from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mountain,
  Search,
  Database,
  ChevronRight
} from "lucide-react";
import AreaFormModal from "@/components/modals/area-form-modal";
import SubAreaFormModal from "@/components/modals/subarea-form-modal";
import RunFormModal from "@/components/modals/run-form-modal";
import RunDetailView from "@/components/run-detail-view";
import type { Area, SubArea, Run } from "@/lib/schemas/schema";
import { queryFn } from "@/lib/queryClient";

export default function RunDataManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedSubArea, setSelectedSubArea] = useState<string>("");
  
  // Navigation state
  const [navigationStack, setNavigationStack] = useState<Array<{
    type: 'area' | 'subarea' | 'run';
    id: string;
    name: string;
  }>>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);


  // Navigation functions
  const navigateToArea = (area: Area) => {
    setNavigationStack([{ type: 'area', id: area.id, name: area.name }]);
    setSelectedArea(area.id);
    setSelectedSubArea("");
    setSelectedRunId(null);
  };

  const navigateToSubArea = (subArea: SubArea) => {
    const area = areas.find(a => a.id === subArea.areaId);
    setNavigationStack([
      { type: 'area', id: area!.id, name: area!.name },
      { type: 'subarea', id: subArea.id, name: subArea.name }
    ]);
    setSelectedArea(subArea.areaId);
    setSelectedSubArea(subArea.id);
    setSelectedRunId(null);
  };


  const resetNavigation = () => {
    setNavigationStack([]);
    setSelectedArea("");
    setSelectedSubArea("");
    setSelectedRunId(null);
  };

  // Fetch all data
  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    queryFn: () => queryFn("/api/areas"),
  });

  const { data: subAreas = [] } = useQuery<SubArea[]>({
    queryKey: ["/api/sub-areas"],
    queryFn: () => queryFn("/api/sub-areas"),
  });

  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: () => queryFn("/api/runs"),
  });




  // Filter data based on search and selections
  const filteredAreas = areas.filter(area => 
    area.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubAreas = subAreas.filter(subArea => {
    const matchesSearch = subArea.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArea = !selectedArea || subArea.areaId === selectedArea;
    return matchesSearch && matchesArea;
  });

  const filteredRuns = runs.filter(run => {
    const matchesSearch = run.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.statusComment?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubArea = !selectedSubArea || run.subAreaId === selectedSubArea;
    const matchesArea = !selectedArea || subAreas.find(sa => sa.id === run.subAreaId)?.areaId === selectedArea;
    
    return matchesSearch && matchesSubArea && matchesArea;
  }).sort((a, b) => a.runNumber - b.runNumber);

  // Status helpers for run cards
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500';
      case 'conditional': return 'bg-orange-500';
      case 'closed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'conditional': return 'Conditional';
      case 'closed': return 'Closed';
      default: return 'Unknown';
    }
  };

  const getAngleLabel = (angle: string) => {
    switch (angle) {
      case 'gentle': return 'Gentle (≤25°)';
      case 'moderate': return 'Moderate (26-35°)';
      case 'steep': return 'Steep (36-45°)';
      case 'very_steep': return 'Very Steep (>45°)';
      default: return angle;
    }
  };


  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 lg:px-6 py-4 flex-shrink-0">
        <h2 className="text-xl lg:text-2xl font-bold text-foreground">Run Data Management</h2>
        <p className="text-sm lg:text-base text-muted-foreground">Manage areas, sub-areas, and ski runs</p>
      </header>

      {/* Navigation Breadcrumb */}
      {navigationStack.length > 0 && (
        <div className="bg-card border-b border-border px-4 lg:px-6 py-3 flex-shrink-0">
          <div className="flex items-center space-x-2 overflow-x-auto">
            <Button variant="ghost" size="sm" onClick={resetNavigation}>
              <Database className="w-4 h-4 mr-1" />
              Areas
            </Button>
            {navigationStack.map((item, index) => (
              <div key={item.id} className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (index < navigationStack.length - 1) {
                      const newStack = navigationStack.slice(0, index + 1);
                      setNavigationStack(newStack);
                      const lastItem = newStack[newStack.length - 1];
                      if (lastItem.type === 'area') {
                        setSelectedArea(lastItem.id);
                        setSelectedSubArea("");
                        setSelectedRunId(null);
                      } else if (lastItem.type === 'subarea') {
                        setSelectedSubArea(lastItem.id);
                        setSelectedRunId(null);
                      }
                    }
                  }}
                >
                  {item.name}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search areas, sub-areas, or runs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Panel */}
        <div className="w-full lg:w-1/3 border-r-0 lg:border-r border-b lg:border-b-0 border-border overflow-y-auto">
          <div className="p-4 lg:p-6">
            {/* Areas */}
            {!selectedArea && !selectedSubArea && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Areas</h3>
                  <AreaFormModal />
                </div>
                <div className="space-y-3">
                  {filteredAreas.map(area => (
                    <Card 
                      key={area.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigateToArea(area)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{area.name}</h4>
                          </div>
                          <Badge variant="secondary">
                            {subAreas.filter(sa => sa.areaId === area.id).length} sub-areas
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Areas */}
            {selectedArea && !selectedSubArea && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Sub-Areas in {areas.find(a => a.id === selectedArea)?.name}
                  </h3>
                  <SubAreaFormModal preselectedAreaId={selectedArea} />
                </div>
                <div className="space-y-3">
                  {filteredSubAreas.map(subArea => (
                    <Card 
                      key={subArea.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigateToSubArea(subArea)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{subArea.name}</h4>
                          </div>
                          <Badge variant="secondary">
                            {runs.filter(r => r.subAreaId === subArea.id).length} runs
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Runs */}
            {selectedSubArea && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Runs in {subAreas.find(sa => sa.id === selectedSubArea)?.name}
                  </h3>
                  <RunFormModal preselectedSubAreaId={selectedSubArea} />
                </div>
                <div className="space-y-3">
                  {filteredRuns.map(run => (
                    <Card 
                      key={run.id} 
                      className={`cursor-pointer hover:shadow-md transition-all ${
                        selectedRunId === run.id ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(run.status)}`} />
                            <div>
                              <h4 className="font-medium">#{run.runNumber} {run.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {run.aspect} • {getAngleLabel(run.averageAngle)} • {run.elevationMax}-{run.elevationMin}m
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(run.status)}>
                              {getStatusLabel(run.status)}
                            </Badge>
                            
                          </div>
                        </div>
                        {run.statusComment && (
                          <p className="text-xs text-muted-foreground italic">
                            &ldquo;{run.statusComment}&rdquo;
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-full lg:flex-1 overflow-hidden">
          {selectedRunId ? (
            <RunDetailView
              runId={selectedRunId}
              focusStatusComment={false}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Mountain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Select a Run</h3>
                <p className="text-muted-foreground">Choose a run from the list on the left to view its details and GPX track</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
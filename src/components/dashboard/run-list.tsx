"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusCommentAutocomplete } from "@/components/ui/status-comment-autocomplete";
import { Mountain, MapPin } from "lucide-react";
import type { Run, Area, SubArea } from "@/lib/schemas/schema";
// import VirtualRunList from "./virtual-run-list";

interface RunListProps {
  filteredRuns: Run[];
  areas: Area[];
  subAreas: SubArea[];
  selectedAreas: Set<string>;
  statusCommentInputs: Record<string, string>;
  autoOpenComment: string | null;
  hoveredRunId: string | null;
  onRunStatusChange: (runId: string, status: 'open' | 'conditional' | 'closed') => void;
  onStatusCommentChange: (runId: string, comment: string) => void;
  onAutoSaveComment: (runId: string) => void;
  onSaveComment: (runId: string) => void;
  onViewMap: (subAreaId: string) => void;
  onViewRunDetails: (run: Run) => void;
  onHoverRun: (runId: string | null) => void;
}

export default function RunList({
  filteredRuns,
  areas,
  subAreas,
  selectedAreas,
  statusCommentInputs,
  autoOpenComment,
  hoveredRunId,
  onRunStatusChange,
  onStatusCommentChange,
  onAutoSaveComment,
  onSaveComment,
  onViewMap,
  onViewRunDetails,
  onHoverRun,
}: RunListProps) {
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(false);
  const [containerHeight, setContainerHeight] = useState(600);

  // Determine if we should use virtual scrolling
  useEffect(() => {
    const shouldUseVirtual = filteredRuns.length > 50; // Use virtual scrolling for 50+ runs
    setUseVirtualScrolling(shouldUseVirtual);
  }, [filteredRuns.length]);

  // Update container height based on available space
  useEffect(() => {
    const updateHeight = () => {
      const availableHeight = window.innerHeight - 200; // Account for header and other UI
      setContainerHeight(Math.max(400, Math.min(800, availableHeight)));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  if (filteredRuns.length === 0) {
    return (
      <div className="text-center py-8">
        <Mountain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {selectedAreas.size === 0 
            ? "Select areas to view runs" 
            : "No runs found in selected areas"}
        </p>
      </div>
    );
  }

  // TODO: Re-enable virtual scrolling once react-window issues are resolved
  // if (useVirtualScrolling) {
  //   return (
  //     <div className="space-y-4">
  //       <div className="flex items-center justify-between">
  //         <h3 className="text-lg font-semibold">
  //           Runs ({filteredRuns.length})
  //         </h3>
  //         <div className="text-sm text-muted-foreground">
  //           Virtual scrolling enabled
  //         </div>
  //       </div>
  //       <VirtualRunList
  //         runs={filteredRuns}
  //         areas={areas}
  //         subAreas={subAreas}
  //         selectedAreas={selectedAreas}
  //         statusCommentInputs={statusCommentInputs}
  //         autoOpenComment={autoOpenComment}
  //         hoveredRunId={hoveredRunId}
  //         onRunStatusChange={onRunStatusChange}
  //         onStatusCommentChange={onStatusCommentChange}
  //         onAutoSaveComment={onAutoSaveComment}
  //         onSaveComment={onSaveComment}
  //         onViewMap={onViewMap}
  //         onViewRunDetails={onViewRunDetails}
  //         onHoverRun={onHoverRun}
  //         height={containerHeight}
  //       />
  //     </div>
  //   );
  // }

  // Regular rendering for smaller lists
  return (
    <div className="space-y-4">
      {areas
        .filter(area => selectedAreas.has(area.id))
        .map(area => {
          const areaSubAreas = subAreas.filter(sa => sa.areaId === area.id);
          const areaRuns = filteredRuns.filter(run => {
            const subArea = subAreas.find(sa => sa.id === run.subAreaId);
            return subArea && subArea.areaId === area.id;
          }).sort((a, b) => a.runNumber - b.runNumber);

          if (areaRuns.length === 0) return null;

          return (
            <Card key={area.id}>
              <CardHeader>
                <CardTitle className="flex items-center ml-3 mt-1">
                  <Mountain className="w-5 h-5 mr-2" />
                  {area.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {areaSubAreas.map(subArea => {
                    const subAreaRuns = areaRuns.filter(run => run.subAreaId === subArea.id).sort((a, b) => a.runNumber - b.runNumber);
                    if (subAreaRuns.length === 0) return null;

                    return (
                      <div key={subArea.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-base flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {subArea.name}
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewMap(subArea.id)}
                            className="text-xs"
                          >
                            <span className="hidden xl:inline">View Map</span>
                            <span className="xl:hidden">Map (XL+)</span>
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {subAreaRuns.map(run => (
                            <div 
                              key={run.id} 
                              className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                                run.status === "open" 
                                  ? "border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300" 
                                  : run.status === "conditional" 
                                  ? "border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300" 
                                  : "border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300"
                              }`}
                              onClick={() => onViewRunDetails(run)}
                              onMouseEnter={() => onHoverRun(run.id)}
                              onMouseLeave={() => onHoverRun(null)}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">
                                      <span className="font-light">{`${run.runNumber}   -      `}</span>
                                      {run.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                      {run.aspect} • {run.elevationMax}-{run.elevationMin}m
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant={run.status === "open" ? "default" : "outline"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRunStatusChange(run.id, "open");
                                    }}
                                    className={`w-12 ${
                                      run.status === "open" 
                                        ? "bg-green-500 hover:bg-green-600" 
                                        : "hover:bg-green-100 hover:text-green-700 hover:border-green-300"
                                    }`}
                                  >
                                    {/* Open button content */}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={run.status === "conditional" ? "default" : "outline"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRunStatusChange(run.id, "conditional");
                                    }}
                                    className={`w-12 ${
                                      run.status === "conditional" 
                                        ? "bg-orange-500 hover:bg-orange-600" 
                                        : "hover:bg-orange-100 hover:text-orange-700 hover:border-orange-300"
                                    }`}
                                  >
                                    {/* Conditional button content */}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={run.status === "closed" ? "default" : "outline"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRunStatusChange(run.id, "closed");
                                    }}
                                    className={`w-12 ${
                                      run.status === "closed" 
                                        ? "bg-red-500 hover:bg-red-600" 
                                        : "hover:bg-red-100 hover:text-red-700 hover:border-red-300"
                                    }`}
                                  >
                                    {/* Closed button content */}
                                  </Button>
                                </div>
                              </div>
                              {run.status === "conditional" && (
                                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                  <StatusCommentAutocomplete
                                    runId={run.id}
                                    value={statusCommentInputs[run.id] !== undefined ? statusCommentInputs[run.id] : (run.statusComment || "")}
                                    onChange={(value) => {
                                      onStatusCommentChange(run.id, value);
                                      onAutoSaveComment(run.id);
                                    }}
                                    onBlur={() => onSaveComment(run.id)}
                                    placeholder="Enter status comment..."
                                    className="w-full"
                                    autoOpen={autoOpenComment === run.id}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

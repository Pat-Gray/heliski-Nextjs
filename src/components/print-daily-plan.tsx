"use client";

import type { Run, Area, SubArea } from "@/lib/schemas/schema";

interface PrintDailyPlanProps {
  areas: Area[];
  subAreas: SubArea[];
  filteredRuns: Run[];
  selectedAreas: Set<string>;
  currentDate: string;
  greenCount: number;
  orangeCount: number;
  redCount: number;
}

export default function PrintDailyPlan({
  areas,
  subAreas,
  filteredRuns,
  selectedAreas,
  currentDate,
  greenCount: _greenCount,
  orangeCount: _orangeCount,
  redCount: _redCount,
}: PrintDailyPlanProps) {
  return (
    <div className="print-only">
      <div className="print-header">
        <h1>Heli-Ski Daily Operations Plan - {currentDate}</h1>
      
      </div>
      
      {/* <div className="print-summary">
        <div className="print-summary-stats">
          <div className="print-stat">
            <div className="print-stat-label">Open Runs</div>
            <div className="print-stat-value open">{greenCount}</div>
          </div>
          <div className="print-stat">
            <div className="print-stat-label">Conditional</div>
            <div className="print-stat-value conditional">{orangeCount}</div>
          </div>
          <div className="print-stat">
            <div className="print-stat-label">Closed</div>
            <div className="print-stat-value closed">{redCount}</div>
          </div>
          <div className="print-stat">
            <div className="print-stat-label">Total Runs</div>
            <div className="print-stat-value">{filteredRuns.length}</div>
          </div>
        </div>
      </div> */}
      
      <div className="print-areas">
        {areas
          .filter(area => selectedAreas.has(area.id))
          .map(area => {
            const areaSubAreas = subAreas.filter(sa => sa.areaId === area.id);
            const areaRuns = filteredRuns.filter(run => {
              const subArea = subAreas.find(sa => sa.id === run.subAreaId);
              return subArea && subArea.areaId === area.id;
            });

            if (areaRuns.length === 0) return null;

            return (
              <div key={area.id} className="print-area">
                <div className="print-area-header">
                  {area.name}
                </div>
                
                {areaSubAreas.map(subArea => {
                  const subAreaRuns = areaRuns
                    .filter(run => run.subAreaId === subArea.id)
                    .sort((a, b) => a.runNumber - b.runNumber);

                  if (subAreaRuns.length === 0) return null;

                  return (
                    <div key={subArea.id} className="print-subarea">
                      <div className="print-subarea-header">
                        {subArea.name}
                      </div>
                      
                      <div className="print-runs-table">
                        <div className="print-runs-header">
                          <div className="print-col-run">#</div>
                          <div className="print-col-name">Run Name</div>
                          <div className="print-col-status">Status</div>
                          <div className="print-col-comment">Comment</div>
                        </div>
                        
                        {subAreaRuns.map(run => (
                          <div key={run.id} className={`print-run-row ${run.status}`}>
                            <div className="print-col-run">{run.runNumber}</div>
                            <div className="print-col-name">{run.name}</div>
                            <div className={`print-col-status ${run.status}`}>
                              {run.status === 'open' ? 'O' : run.status === 'conditional' ? 'C' : 'X'}
                            </div>
                            <div className="print-col-comment">{run.statusComment || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>
      
    </div>
  );
}

import { Badge } from "@/components/ui/badge";

interface QuickStatsProps {
  areas: number;
  subAreas: number;
  totalRuns: number;
  openRuns: number;
  conditionalRuns: number;
  closedRuns: number;
}

export default function QuickStats({
  areas,
  subAreas,
  totalRuns,
  openRuns,
  conditionalRuns,
  closedRuns,
}: QuickStatsProps) {
  return (
    <div className="p-2">
      <h3 className="text-sm font-semibold text-sidebar-foreground/70 uppercase tracking-wide mb-3">
        Quick Stats
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Areas:</span>
          <Badge variant="secondary">{areas}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span>Sub-Areas:</span>
          <Badge variant="secondary">{subAreas}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Runs:</span>
          <Badge variant="secondary">{totalRuns}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span>Open:</span>
          <Badge className="bg-green-500">{openRuns}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span>Conditional:</span>
          <Badge className="bg-orange-500">{conditionalRuns}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span>Closed:</span>
          <Badge className="bg-red-500">{closedRuns}</Badge>
        </div>
      </div>
    </div>
  );
}

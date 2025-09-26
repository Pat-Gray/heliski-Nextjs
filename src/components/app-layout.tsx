"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Mountain } from "lucide-react";
import Navigation from "@/components/navigation";
import QuickStats from "@/components/quick-stats";
import { useQuery } from "@tanstack/react-query";
import { queryFn } from "@/lib/queryClient";
import type { Area, SubArea, Run } from "@/lib/schemas/schema";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen] = useState(true);
  const pathname = usePathname();

  // Fetch data for QuickStats
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

  // Calculate statistics
  const totalRuns = runs.length;
  const openRuns = runs.filter(r => r.status === 'open').length;
  const conditionalRuns = runs.filter(r => r.status === 'conditional').length;
  const closedRuns = runs.filter(r => r.status === 'closed').length;

  // Determine if this is a page that needs the full layout
  const needsFullLayout = pathname === "/" || pathname === "/run-data";

  if (!needsFullLayout) {
    // For pages that don't need the sidebar layout, just render children
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-card border-r border-border flex flex-col transition-all duration-300 overflow-hidden`}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Mountain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Heli-Ski Ops</h1>
              <p className="text-sm text-muted-foreground">
                {pathname === "/" ? "Operations Dashboard" : "Run Data Management"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <Navigation />

        {/* Quick Stats */}
        <div className="p-4 mt-auto">
          <QuickStats
            areas={areas.length}
            subAreas={subAreas.length}
            totalRuns={totalRuns}
            openRuns={openRuns}
            conditionalRuns={conditionalRuns}
            closedRuns={closedRuns}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        {/* <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                <Menu className="w-4 h-4" />
              </Button>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {pathname === "/" ? "Run Management" : "Run Data Management"}
                </h2>
                <p className="text-muted-foreground">
                  {pathname === "/" 
                    ? "Operations Dashboard" 
                    : "Manage areas, sub-areas, and ski runs"
                  }
                </p>
              </div>
            </div>
          </div>
        </header> */}

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

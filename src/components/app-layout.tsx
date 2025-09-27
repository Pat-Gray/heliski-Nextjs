"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Mountain, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import QuickStats from "@/components/quick-stats";
import { useQuery } from "@tanstack/react-query";
import { queryFn } from "@/lib/queryClient";
import type { Area, SubArea, Run } from "@/lib/schemas/schema";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Auto-open sidebar on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'w-64 lg:w-80' : 'w-0 lg:w-64 xl:w-80'
      } bg-card border-r border-border flex flex-col transition-all duration-300 overflow-hidden fixed lg:relative z-50 lg:z-auto`}>
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-primary rounded-lg flex items-center justify-center">
                <Mountain className="w-4 h-4 lg:w-6 lg:h-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg lg:text-xl font-bold text-foreground truncate">Heli-Ski Ops</h1>
                <p className="text-xs lg:text-sm text-muted-foreground truncate">
                  {pathname === "/" ? "Operations Dashboard" : "Run Data Management"}
                </p>
              </div>
            </div>
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <Navigation />

        {/* Quick Stats */}
        <div className="p-3 lg:p-4 mt-auto">
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
        {/* Mobile Menu Button */}
        <div className="lg:hidden p-4 border-b border-border bg-card">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2"
          >
            <Menu className="w-4 h-4" />
            Menu
          </Button>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

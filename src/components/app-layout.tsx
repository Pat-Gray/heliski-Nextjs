"use client";

import { usePathname } from "next/navigation";
import { Mountain, LogOut, User, Shield, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import Navigation from "@/components/navigation";
import { useState, useEffect } from "react";
import { usePrint } from "@/components/print-provider";
import { useQuery } from "@tanstack/react-query";
import { queryFn } from "@/lib/queryClient";
import type { Run, Area, SubArea } from "@/lib/schemas/schema";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { setPrintData, triggerPrint } = usePrint();
  const [currentDate, setCurrentDate] = useState<string>('');
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());

  // Set current date on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }));
  }, []);

  // Dashboard data queries
  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    queryFn: () => queryFn("/api/runs"),
    enabled: pathname === "/"
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    queryFn: () => queryFn("/api/areas"),
    enabled: pathname === "/"
  });

  const { data: subAreas = [] } = useQuery<SubArea[]>({
    queryKey: ["/api/sub-areas"],
    queryFn: () => queryFn("/api/sub-areas"),
    enabled: pathname === "/"
  });

  // Listen for area selection changes from dashboard
  useEffect(() => {
    const handleAreaSelection = (event: CustomEvent<Set<string>>) => {
      setSelectedAreas(event.detail);
    };

    window.addEventListener('area-selection-changed', handleAreaSelection as EventListener);
    return () => window.removeEventListener('area-selection-changed', handleAreaSelection as EventListener);
  }, []);

  // Determine if this is a page that needs the full layout
  const needsFullLayout = pathname === "/" || pathname === "/run-data" || pathname === "/daily-plans";

  if (!needsFullLayout) {
    // For pages that don't need the sidebar layout, just render children
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSubmitDailyPlan = () => {
    console.log('📋 Submit Daily Plan button clicked in app-layout');
    console.log('📋 Selected areas:', selectedAreas);
    console.log('📋 Selected areas size:', selectedAreas.size);
    const event = new CustomEvent('submit-daily-plan');
    window.dispatchEvent(event);
    console.log('📋 Submit Daily Plan event dispatched');
  };

  const handlePrint = () => {
    if (pathname !== "/") return;
    
    const greenCount = runs.filter(run => run.status === "open").length;
    const orangeCount = runs.filter(run => run.status === "conditional").length;
    const redCount = runs.filter(run => run.status === "closed").length;
    
    setPrintData({
      areas,
      subAreas,
      filteredRuns: runs,
      selectedAreas,
      currentDate: currentDate || new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      greenCount,
      orangeCount,
      redCount,
    });
    setTimeout(() => triggerPrint(), 100);
  };

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Mountain className="h-4 w-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Heli-Ski Ops</span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {pathname === "/" ? "Operations Dashboard" : "Run Data Management"}
              </span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <Navigation />
            </SidebarGroupContent>
          </SidebarGroup>
          
          {isSuperAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                {/* <Button variant="ghost" className="w-full justify-start" asChild>
                  <a href="/admin/users">
                    <Shield className="h-4 w-4 mr-2 text-sm" />
                    User Management
                  </a>
                </Button> */}
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        
        <div className="mt-auto border-t border-sidebar-border">
          {/* Expanded State */}
          <div className="group-data-[collapsible=icon]:hidden p-2">
            <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70 mb-2">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-xs">{user?.email}</span>
              {isSuperAdmin && (
                <Badge variant="default" className="text-xs ml-auto">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-xs">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
          
          {/* Collapsed State */}
          <div className="hidden group-data-[collapsible=icon]:block p-2">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <User className="h-4 w-4 text-sidebar-accent-foreground" />
                </div>
                {isSuperAdmin && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                    <Shield className="h-2 w-2 text-primary-foreground" />
                  </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut} 
                className="w-8 h-8"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
       
      </Sidebar>
      
  

      <SidebarInset className="h-screen flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1">
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {pathname === "/" ? "Operations Dashboard" : 
                 pathname === "/run-data" ? "Run Data Management" :
                 pathname === "/daily-plans" ? "Daily Plans" :
                 pathname === "/admin/users" ? "User Management" :
                 "Heli-Ski Operations"
                 
                 }
              </h1>
              {pathname === "/" && (
                <p className="text-sm text-muted-foreground">
                  Today: <span data-testid="text-current-date">{currentDate || 'Loading...'}</span>
                </p>
              )}
            </div>
          </div>
          
          {/* Dashboard Action Buttons */}
          {pathname === "/" && (
            <div className="flex items-center space-x-2">
              <Button 
                onClick={handleSubmitDailyPlan}
                disabled={selectedAreas.size === 0}
                data-testid="button-submit-daily-plan"
                size="sm"
                title={selectedAreas.size === 0 ? "Select areas first" : "Submit daily plan"}
              >
                <Plus className="w-4 h-4 mr-2" />
                Submit Daily Plan
              </Button>
              <Button 
                onClick={handlePrint}
                variant="outline"
                size="sm"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Plan
              </Button>
            </div>
          )}
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </SidebarInset>
          
    </SidebarProvider>
  );
}

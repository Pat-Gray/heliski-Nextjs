"use client";

import { usePathname } from "next/navigation";
import { Mountain, LogOut, User, Shield, RefreshCw, Zap, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import Navigation from "@/components/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/contexts/hooks/use-toast";

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

interface SetupStatus {
  isConfigured: boolean;
  needsSetup: boolean;
  setupSteps: {
    environmentVariables: boolean;
    databaseSchema: boolean;
    storageBucket: boolean;
    initialSync: boolean;
  };
  mapId?: string;
  lastSync?: {
    status: string;
    started_at: string;
    completed_at?: string;
    duration_seconds?: number;
  };
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { user, signOut, isSuperAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [isIncrementalSyncing, setIsIncrementalSyncing] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const { toast } = useToast();

  // Set current date on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }));
  }, []);

  // Check setup status on mount and after operations
  const checkSetupStatus = async () => {
    setIsCheckingSetup(true);
    try {
      const response = await fetch('/api/caltopo/setup-status');
      const status = await response.json();
      setSetupStatus(status);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setSetupStatus({
        isConfigured: false,
        needsSetup: true,
        setupSteps: {
          environmentVariables: false,
          databaseSchema: false,
          storageBucket: false,
          initialSync: false
        }
      });
    } finally {
      setIsCheckingSetup(false);
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  // Determine if this is a page that needs the full layout
  const needsFullLayout = pathname === "/" || pathname === "/run-data" || pathname === "/daily-plans";

  if (!needsFullLayout) {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    
    try {
      console.log('🧪 Testing CalTopo raw data connection...');
      const testResponse = await fetch('/api/caltopo/test-raw-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const testResult = await testResponse.json();
      
      if (!testResult.success) {
        toast({
          title: "Connection Test Failed",
          description: testResult.error || 'Failed to connect to CalTopo',
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Connection Test Passed",
        description: `Found ${testResult.data.featuresCount} features and ${testResult.data.groupsCount} groups. Check console for detailed analysis.`,
      });

      console.log('✅ Test completed successfully:', testResult);
      await checkSetupStatus(); // Refresh setup status
    } catch (error) {
      toast({
        title: "Test Error",
        description: error instanceof Error ? error.message : 'Network error',
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateBucket = async () => {
    setIsCreatingBucket(true);
    
    try {
      const response = await fetch('/api/storage/create-caltopo-bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Bucket Created",
          description: "CalTopo storage bucket created successfully",
        });
        await checkSetupStatus(); // Refresh setup status
      } else {
        toast({
          title: "Bucket Creation Failed",
          description: result.error || 'Failed to create bucket',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Bucket Error",
        description: error instanceof Error ? error.message : 'Network error',
        variant: "destructive"
      });
    } finally {
      setIsCreatingBucket(false);
    }
  };

  const handleCalTopoSync = async () => {
    setIsSyncing(true);
    
    try {
      // First test the raw data connection
      console.log('🧪 Testing CalTopo raw data connection...');
      const testResponse = await fetch('/api/caltopo/test-raw-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const testResult = await testResponse.json();
      
      if (!testResult.success) {
        toast({
          title: "Connection Test Failed",
          description: testResult.error || 'Failed to connect to CalTopo',
          variant: "destructive"
        });
        setIsSyncing(false);
        return;
      }

      toast({
        title: "Connection Test Passed",
        description: `Found ${testResult.data.featuresCount} features and ${testResult.data.groupsCount} groups`,
      });

      // Now try the actual sync
      const response = await fetch('/api/caltopo/sync-optimized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'full' })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Full Sync Completed",
          description: `Synced ${result.stats.features.total} features, ${result.stats.images.total} images, and ${result.stats.folders.total} folders.`,
        });
        await checkSetupStatus(); // Refresh setup status
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || 'Unknown error occurred',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Sync Error",
        description: error instanceof Error ? error.message : 'Network error',
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIncrementalSync = async () => {
    setIsIncrementalSyncing(true);
    
    try {
      console.log('⚡ Starting incremental sync...');
      const response = await fetch('/api/caltopo/sync-incremental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'incremental' })
      });

      const result = await response.json();

      if (result.success) {
        const efficiency = result.stats.efficiency;
        toast({
          title: "Incremental Sync Completed",
          description: `Efficient sync: ${efficiency.featuresEfficiency} features, ${efficiency.imagesEfficiency} images, ${efficiency.foldersEfficiency} folders unchanged.`,
        });
        
        console.log('⚡ Incremental sync stats:', result.stats);
        await checkSetupStatus(); // Refresh setup status
      } else {
        toast({
          title: "Incremental Sync Failed",
          description: result.error || 'Unknown error occurred',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Incremental Sync Error",
        description: error instanceof Error ? error.message : 'Network error',
        variant: "destructive"
      });
    } finally {
      setIsIncrementalSyncing(false);
    }
  };

  // Determine which buttons to show
  const showSetupButtons = setupStatus?.needsSetup || false;
  const showIncrementalButton = setupStatus?.isConfigured || false;
  
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
          
          {/* CalTopo Buttons - Smart Display */}
          <div className="flex items-center space-x-2">
            {isCheckingSetup ? (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking setup...</span>
              </div>
            ) : showSetupButtons ? (
              // Setup Phase Buttons
              <>
                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || isSyncing || isCreatingBucket}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test'}
                </Button>
                <Button
                  onClick={handleCreateBucket}
                  disabled={isCreatingBucket || isSyncing || isTesting}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isCreatingBucket ? 'animate-spin' : ''}`} />
                  {isCreatingBucket ? 'Creating...' : 'Bucket'}
                </Button>
                <Button
                  onClick={handleCalTopoSync}
                  disabled={isSyncing || isTesting || isCreatingBucket}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Full Sync...' : 'Full Sync'}
                </Button>
              </>
            ) : showIncrementalButton ? (
              // Production Phase - Only Incremental Button
              <>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mr-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Ready</span>
                </div>
                <Button
                  onClick={handleIncrementalSync}
                  disabled={isIncrementalSyncing}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Zap className={`w-4 h-4 ${isIncrementalSyncing ? 'animate-pulse' : ''}`} />
                  {isIncrementalSyncing ? 'Syncing...' : 'Sync'}
                </Button>
              </>
            ) : (
              // Fallback - Show all buttons
              <>
                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || isSyncing || isCreatingBucket || isIncrementalSyncing}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test'}
                </Button>
                <Button
                  onClick={handleCreateBucket}
                  disabled={isCreatingBucket || isSyncing || isTesting || isIncrementalSyncing}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isCreatingBucket ? 'animate-spin' : ''}`} />
                  {isCreatingBucket ? 'Creating...' : 'Bucket'}
                </Button>
                <Button
                  onClick={handleCalTopoSync}
                  disabled={isSyncing || isTesting || isCreatingBucket || isIncrementalSyncing}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Full Sync...' : 'Full Sync'}
                </Button>
                <Button
                  onClick={handleIncrementalSync}
                  disabled={isIncrementalSyncing || isSyncing || isTesting || isCreatingBucket}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Zap className={`w-4 h-4 ${isIncrementalSyncing ? 'animate-pulse' : ''}`} />
                  {isIncrementalSyncing ? 'Incremental...' : 'Incremental'}
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </SidebarInset>
          
    </SidebarProvider>
  );
}

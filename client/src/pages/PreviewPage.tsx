import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Copy, Download, ExternalLink, Loader2, RefreshCw, Maximize2, Minimize2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export default function PreviewPage() {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecreating, setIsRecreating] = useState(false);
  const [sandboxExpired, setSandboxExpired] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRunningCommand, setIsRunningCommand] = useState(false);

  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: sandboxData, refetch: refetchSandbox } = useQuery<{ url: string }>({
    queryKey: ["/api/sandbox", projectId, "url"],
    enabled: !!projectId && !!project?.sandboxId,
  });

  // Validate sandbox periodically
  useEffect(() => {
    if (!projectId) return;

    const validateSandbox = async () => {
      try {
        // If no sandboxId exists yet, don't mark as expired
        if (!project?.sandboxId) {
          setSandboxExpired(false);
          return;
        }

        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch(`/api/sandbox/${projectId}/validate`, {
          headers: {
            "Authorization": `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSandboxExpired(!data.isValid);
        } else {
          // If validation endpoint fails, assume expired
          setSandboxExpired(true);
        }
      } catch (error) {
        // If validation fails, assume expired (network error, auth error, etc.)
        console.error('Sandbox validation error:', error);
        setSandboxExpired(true);
      }
    };

    // Check immediately
    validateSandbox();

    // Check every 30 seconds
    const interval = setInterval(validateSandbox, 30000);

    return () => clearInterval(interval);
  }, [projectId, project?.sandboxId]);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewUrl = project?.sandboxUrl || sandboxData?.url;
  const hasSandbox = !!project?.sandboxId;

  const handleCopyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      toast({
        title: "URL copied",
        description: "Preview URL copied to clipboard",
      });
    }
  };

  const handleDownloadSource = async () => {
    try {
      const response = await fetch(`/api/files/${projectId}/download`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Download failed');

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'project'}-source.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: "Source code is being downloaded",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download source code",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Reload the iframe by adding a timestamp to force refresh
    const iframe = document.querySelector('[data-testid="iframe-preview"]') as HTMLIFrameElement;
    if (iframe && previewUrl) {
      const url = new URL(previewUrl);
      url.searchParams.set('_refresh', Date.now().toString());
      iframe.src = url.toString();
    }
    
    await Promise.all([refetchProject(), refetchSandbox()]);
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Preview has been refreshed",
    });
  };

  const handleRecreateSandbox = async () => {
    setIsRecreating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/sandbox/${projectId}/recreate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to recreate sandbox");
      }

      const data = await response.json();

      // Invalidate and refetch project data
      await queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sandbox", projectId, "url"] });
      await refetchProject();
      await refetchSandbox();

      setSandboxExpired(false);

      toast({
        title: "Sandbox recreated",
        description: `New sandbox created with ${data.filesSynced} files synced`,
      });

      // If there's a workflow command, run it automatically
      if (data.workflowCommand) {
        toast({
          title: "Running workflow",
          description: data.workflowCommand,
        });

        // Use the NEW sandbox URL from the API response
        const newSandboxUrl = data.url;

        // Wait 2 seconds before starting auto-refresh to let the workflow command start
        setTimeout(() => {
          // Start auto-refresh cycle for 8 seconds to give the server time to start
          const refreshInterval = setInterval(() => {
            const iframe = document.querySelector('[data-testid="iframe-preview"]') as HTMLIFrameElement;
            if (iframe && newSandboxUrl) {
              const url = new URL(newSandboxUrl);
              url.searchParams.set('_refresh', Date.now().toString());
              iframe.src = url.toString();
            }
          }, 1000); // Refresh every second

          // Stop auto-refresh after 8 seconds
          setTimeout(() => {
            clearInterval(refreshInterval);
            toast({
              title: "Preview ready",
              description: "Auto-refresh stopped",
            });
          }, 8000);
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: "Failed to recreate sandbox",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRecreating(false);
    }
  };

  const handleRunCommand = async () => {
    if (!project?.workflowCommand) {
      toast({
        title: "No command configured",
        description: "The AI hasn't configured a run command yet",
        variant: "destructive",
      });
      return;
    }

    setIsRunningCommand(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/sandbox/${projectId}/run-workflow`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to run command");
      }

      toast({
        title: "Command started",
        description: project.workflowCommand,
      });
    } catch (error: any) {
      toast({
        title: "Failed to run command",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningCommand(false);
    }
  };

  if (!hasSandbox) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto text-center p-6">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Setting up sandbox...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header - visible on all devices */}
      <div className="border-b border-border dark:border-border p-3 md:p-4 bg-background">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          <h1 className="text-base md:text-lg font-semibold">Preview</h1>
          {hasSandbox && (
            <Badge variant="outline" className={cn(
              "gap-1.5 ml-2 text-[10px] sm:text-xs",
              sandboxExpired && "border-destructive text-destructive"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                sandboxExpired ? "bg-destructive" : "bg-chart-2 animate-pulse"
              )} />
              {sandboxExpired ? 'Expired' : 'Active'}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Preview container */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
        {previewUrl ? (
          <div className={cn(
            "w-full h-full flex flex-col bg-background rounded-lg sm:rounded-xl shadow-xl sm:shadow-2xl overflow-hidden transition-all",
            isFullscreen ? "max-w-full" : "max-w-[375px] sm:max-w-md md:max-w-2xl lg:max-w-4xl"
          )}>
            {/* URL bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <Badge variant="outline" className={cn(
                "gap-1.5 shrink-0 text-[10px] sm:text-xs",
                sandboxExpired && "border-destructive text-destructive"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  sandboxExpired ? "bg-destructive" : "bg-chart-2 animate-pulse"
                )} />
                {sandboxExpired ? 'Expired' : 'Active'}
              </Badge>

              <div className="flex-1 min-w-0">
                <div className="px-2 py-1 bg-muted rounded text-[10px] sm:text-xs font-mono truncate">
                  {previewUrl}
                </div>
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {sandboxExpired && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRecreateSandbox}
                    disabled={isRecreating}
                    className="h-7 w-7 p-0"
                    title="Recreate sandbox"
                    data-testid="button-recreate-sandbox"
                  >
                    {isRecreating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                )}

                {project?.workflowCommand && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRunCommand}
                    disabled={isRunningCommand}
                    className="h-7 w-7 p-0"
                    title={`Run: ${project.workflowCommand}`}
                    data-testid="button-run-workflow"
                  >
                    {isRunningCommand ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-7 w-7 p-0 hidden sm:flex"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="h-7 w-7 p-0"
                  title="Copy URL"
                  data-testid="button-copy-url"
                >
                  <Copy className="h-3 w-3" />
                </Button>

                {!sandboxExpired && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-7 w-7 p-0"
                    title="Refresh preview"
                    data-testid="button-refresh-preview"
                  >
                    <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadSource}
                  className="h-7 w-7 p-0 hidden sm:flex"
                  title="Download source"
                  data-testid="button-download-source"
                >
                  <Download className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(previewUrl, '_blank')}
                  className="h-7 w-7 p-0"
                  title="Open in new tab"
                  data-testid="button-open-external"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="App Preview"
                data-testid="iframe-preview"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
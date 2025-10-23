
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Copy, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";
import { useState } from "react";

export default function PreviewPage() {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: sandboxData, refetch: refetchSandbox } = useQuery<{ url: string }>({
    queryKey: ["/api/sandbox", projectId, "url"],
    enabled: !!projectId && !!project?.sandboxId,
  });

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
    await Promise.all([refetchProject(), refetchSandbox()]);
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Preview has been refreshed",
    });
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
    <div className="flex flex-col h-full">
      {/* Fullscreen iframe container with URL bar inside */}
      <div className="flex-1 relative bg-background">
        {previewUrl ? (
          <div className="w-full h-full flex flex-col">
            {/* URL bar inside iframe area */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
              <Badge variant="outline" className="gap-1.5 shrink-0">
                <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse" />
                Active
              </Badge>
              
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 px-3 py-1.5 bg-muted rounded-md text-sm font-mono truncate">
                  {previewUrl}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                  data-testid="button-copy-url"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  data-testid="button-refresh-preview"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadSource}
                  data-testid="button-download-source"
                >
                  <Download className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(previewUrl, '_blank')}
                  data-testid="button-open-external"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile-sized iframe preview */}
            <div className="flex-1 bg-muted flex items-start justify-center overflow-auto p-4">
              <div className="w-full max-w-[375px] h-full bg-background rounded-lg shadow-xl overflow-hidden">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="App Preview"
                  data-testid="iframe-preview"
                />
              </div>
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

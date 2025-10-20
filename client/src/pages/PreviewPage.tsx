import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Play, Square, Loader2, Terminal, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface SandboxStatus {
  sandboxId: string | null;
  running: boolean;
  url: string | null;
  logs: string[];
}

export default function PreviewPage() {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const [logs, setLogs] = useState<string[]>([]);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: status, isLoading: statusLoading } = useQuery<SandboxStatus>({
    queryKey: ["/api/sandbox/status", projectId],
    enabled: !!projectId,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/sandbox/run`, { projectId });
    },
    onSuccess: (data: SandboxStatus) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/status", projectId] });
      if (data.logs) {
        setLogs(data.logs);
      }
      toast({
        title: "Sandbox started",
        description: "Your app is now running in the preview.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start sandbox",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/sandbox/stop`, { projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/status", projectId] });
      setLogs([]);
      toast({
        title: "Sandbox stopped",
        description: "Preview has been stopped.",
      });
    },
  });

  if (projectLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRunning = status?.running || false;
  const hasRunCommand = !!project?.runCommand;

  return (
    <div className="p-6 md:p-8 space-y-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Preview</h1>
          <p className="text-muted-foreground mt-1">
            Live preview powered by E2B sandboxes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <Badge variant="outline" className="gap-1.5">
              <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse" />
              Running
            </Badge>
          )}
          {!isRunning ? (
            <Button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || !hasRunCommand}
              data-testid="button-run-sandbox"
            >
              {runMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              data-testid="button-stop-sandbox"
            >
              {stopMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {!hasRunCommand ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Terminal className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">No run command configured</h3>
              <p className="text-muted-foreground">
                Ask the AI to configure a run command in the chat, or the AI will do it automatically when generating code.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>
                Live preview of your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isRunning && status?.url ? (
                <div className="aspect-video bg-background rounded-lg border border-border overflow-hidden">
                  <iframe
                    src={status.url}
                    className="w-full h-full"
                    title="App Preview"
                    data-testid="iframe-preview"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Preview will appear when running</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Terminal Output */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Terminal Output
              </CardTitle>
              <CardDescription>
                Run command: <code className="font-mono text-xs">{project?.runCommand}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black/90 rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto">
                {logs.length === 0 && !isRunning ? (
                  <p className="text-muted-foreground">Output will appear here...</p>
                ) : (
                  <div className="space-y-1">
                    {(logs.length > 0 ? logs : status?.logs || []).map((log, idx) => (
                      <div key={idx} className="text-green-400">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

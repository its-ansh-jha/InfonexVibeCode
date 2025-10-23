import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ExternalLink, Loader2, Terminal, MessageSquare, Code } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Project } from "@shared/schema";
import { useState } from "react";

export default function PreviewPage() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const [iframeError, setIframeError] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: sandboxData } = useQuery<{ url: string }>({
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

  return (
    <div className="p-6 md:p-8 space-y-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Preview</h1>
          <p className="text-muted-foreground mt-1">
            Live preview powered by E2B sandbox
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasSandbox && (
            <Badge variant="outline" className="gap-1.5">
              <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse" />
              Sandbox Active
            </Badge>
          )}
          {previewUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(previewUrl, '_blank')}
              data-testid="button-open-preview"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </Button>
          )}
        </div>
      </div>

      {!hasSandbox ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Terminal className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">No sandbox created yet</h3>
              <p className="text-muted-foreground">
                The E2B sandbox will be created automatically when you start chatting with the AI.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Alert className="bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/5">
            <Code className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-500 dark:text-blue-400">How to see your preview</AlertTitle>
            <AlertDescription className="text-muted-foreground mt-2 space-y-2">
              <p>The sandbox is running, but you need to start a web server inside it:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to the Chat tab</li>
                <li>Ask the AI to create a web app (e.g., "Create a simple HTML page")</li>
                <li>Ask it to start a server on port 3000</li>
                <li>Return to this preview to see your app running</li>
              </ol>
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation(`/project/${projectId}/chat`)}
                  data-testid="button-go-to-chat"
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Go to Chat
                </Button>
              </div>
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                Your app running in E2B sandbox (port 3000)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <div className="aspect-video bg-background rounded-lg border border-border overflow-hidden relative">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    title="App Preview"
                    data-testid="iframe-preview"
                    onError={() => setIframeError(true)}
                  />
                  {iframeError && (
                    <div className="absolute inset-0 bg-background/95 flex items-center justify-center">
                      <div className="text-center max-w-md p-6">
                        <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No server running</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          The sandbox is active but there's no web server on port 3000. 
                          Go to Chat and ask the AI to create and start your app.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setLocation(`/project/${projectId}/chat`)}
                          data-testid="button-go-to-chat-error"
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Go to Chat
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading preview...</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

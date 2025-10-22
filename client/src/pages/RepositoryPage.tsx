
function RepositoryFiles({ projectId }: { projectId: string }) {
  const { data: files, isLoading } = useQuery({
    queryKey: ["/api/github/files", projectId],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Repository Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading files...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderTree className="h-5 w-5" />
          Repository Files
        </CardTitle>
        <CardDescription>
          {files?.length || 0} items in repository
        </CardDescription>
      </CardHeader>
      <CardContent>
        {files && files.length > 0 ? (
          <div className="space-y-1">
            {files.map((file: any) => (
              <div key={file.sha} className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm">
                {file.type === 'dir' ? (
                  <Folder className="h-4 w-4 text-blue-500" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{file.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <File className="h-4 w-4" />
            <span>No files found in repository</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Folder, ChevronRight, ChevronDown } from "lucide-react";
import { useParams } from "wouter";
import { Github, Link2, Unlink, Loader2, FolderTree, File } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  updated_at: string;
}

export default function RepositoryPage() {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const [githubToken, setGithubToken] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: repos, isLoading: reposLoading } = useQuery<GitHubRepo[]>({
    queryKey: ["/api/github/repos", projectId],
    enabled: !!project?.githubToken,
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { githubToken: string; repoFullName?: string }) => {
      return await apiRequest("POST", `/api/projects/${projectId}/connect-github`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/github/repos", projectId] });
      setGithubToken("");
      setShowTokenInput(false);
      toast({
        title: "Repository connected",
        description: "Successfully connected to GitHub repository.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/projects/${projectId}/disconnect-github`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Repository disconnected",
        description: "GitHub repository has been disconnected.",
      });
    },
  });

  const handleConnect = () => {
    if (!githubToken.trim()) {
      toast({
        title: "Token required",
        description: "Please enter your GitHub personal access token.",
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate({
      githubToken,
      repoFullName: selectedRepo || undefined,
    });
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = !!project?.githubToken;

  return (
    <div className="p-6 md:p-8 space-y-6 pb-24 md:pb-8">
      <div>
        <h1 className="text-3xl font-semibold">Repository</h1>
        <p className="text-muted-foreground mt-1">
          Connect your GitHub repository for AI code generation
        </p>
      </div>

      {!isConnected ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted">
                <Github className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Connect GitHub Repository</CardTitle>
                <CardDescription>
                  Provide a personal access token to connect your repository
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">How to get a GitHub token:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Go to GitHub Settings → Developer settings → Personal access tokens</li>
                <li>Generate new token (classic) with <code className="bg-background px-1 rounded">repo</code> scope</li>
                <li>Copy the token and paste it below</li>
              </ol>
            </div>

            {!showTokenInput ? (
              <Button
                onClick={() => setShowTokenInput(true)}
                className="w-full"
                data-testid="button-show-token-input"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Connect Repository
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token">GitHub Personal Access Token</Label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    data-testid="input-github-token"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTokenInput(false);
                      setGithubToken("");
                    }}
                    data-testid="button-cancel-connect"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConnect}
                    disabled={connectMutation.isPending}
                    className="flex-1"
                    data-testid="button-connect-github"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 max-w-4xl">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                  <Github className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Connected Repository</CardTitle>
                  {project.githubRepoName && (
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      {project.githubRepoName}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <div className="w-2 h-2 bg-chart-2 rounded-full" />
                Connected
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {!project.githubRepoName && repos && repos.length > 0 && (
                <div className="space-y-3">
                  <Label>Select Repository</Label>
                  <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                    <SelectTrigger data-testid="select-repository">
                      <SelectValue placeholder="Choose a repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {repos.map((repo) => (
                        <SelectItem key={repo.id} value={repo.full_name}>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm">{repo.full_name}</span>
                            {repo.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {repo.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRepo && (
                    <Button
                      onClick={() => connectMutation.mutate({ githubToken: project.githubToken!, repoFullName: selectedRepo })}
                      disabled={connectMutation.isPending}
                      data-testid="button-save-repo"
                    >
                      {connectMutation.isPending ? "Saving..." : "Save Repository"}
                    </Button>
                  )}
                </div>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Disconnect GitHub repository?")) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect"
              >
                <Unlink className="mr-2 h-4 w-4" />
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Repository"}
              </Button>
            </CardContent>
          </Card>

          {project.githubRepoName && <RepositoryFiles projectId={projectId!} />}
        </div>
      )}
    </div>
  );
}

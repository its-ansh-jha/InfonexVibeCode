import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Terminal as TerminalIcon } from "lucide-react";
import type { Project } from "@shared/schema";

export default function TerminalPage() {
  const { id: projectId } = useParams();

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: projectId !== undefined && projectId !== null && projectId !== "",
  });

  // Show loading while projectId is being resolved or query is loading
  if (!projectId || projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project?.sandboxId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
          <TerminalIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Sandbox Available</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Start chatting with the AI to create files and initialize the sandbox.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background dark:bg-background">
      <div className="border-b border-border dark:border-border p-4">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Terminal</h1>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4 pb-20 md:pb-4">
        <div className="h-full bg-black dark:bg-black rounded-lg border border-border dark:border-border overflow-hidden">
          <iframe
            src={`https://${project.sandboxId}.e2b.dev/_terminal`}
            className="w-full h-full"
            title="E2B Terminal"
            allow="clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}

import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Loader2 } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Project } from "@shared/schema";
import { auth } from "@/lib/firebase";

export default function TerminalPage() {
  const { id: projectId } = useParams();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCommandRef = useRef("");

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: projectId !== undefined && projectId !== null && projectId !== "",
  });

  useEffect(() => {
    if (!terminalRef.current || !project?.sandboxId) return;

    // Initialize terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#60a5fa",
        black: "#000000",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e5e5e5",
        brightBlack: "#525252",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome message
    term.writeln("\x1b[1;34mVibe Code Terminal\x1b[0m");
    term.writeln("\x1b[2mConnected to E2B Sandbox: " + project.sandboxId.substring(0, 8) + "...\x1b[0m");
    term.writeln("");
    term.write("$ ");

    // Handle input
    term.onData((data) => {
      const code = data.charCodeAt(0);

      // Enter key
      if (code === 13) {
        term.write("\r\n");
        if (currentCommandRef.current.trim()) {
          executeCommand(currentCommandRef.current.trim());
        } else {
          term.write("$ ");
        }
        currentCommandRef.current = "";
      }
      // Backspace
      else if (code === 127) {
        if (currentCommandRef.current.length > 0) {
          currentCommandRef.current = currentCommandRef.current.slice(0, -1);
          term.write("\b \b");
        }
      }
      // Ctrl+C
      else if (code === 3) {
        term.write("^C\r\n$ ");
        currentCommandRef.current = "";
      }
      // Regular character
      else {
        currentCommandRef.current += data;
        term.write(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, [project?.sandboxId]);

  const executeCommand = async (command: string) => {
    const term = xtermRef.current;
    if (!term || !projectId) return;

    try {
      const user = auth.currentUser;
      if (!user) {
        term.writeln("\x1b[31mError: Not authenticated\x1b[0m");
        term.write("$ ");
        return;
      }

      const token = await user.getIdToken();
      
      const response = await fetch(`/api/sandbox/${projectId}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        const error = await response.text();
        term.writeln(`\x1b[31mError: ${error}\x1b[0m`);
        term.write("$ ");
        return;
      }

      const result = await response.json();

      if (result.stdout) {
        result.stdout.split("\n").forEach((line: string) => {
          if (line) term.writeln(line);
        });
      }

      if (result.stderr) {
        result.stderr.split("\n").forEach((line: string) => {
          if (line) term.writeln(`\x1b[31m${line}\x1b[0m`);
        });
      }

      if (result.error) {
        term.writeln(`\x1b[31mError: ${result.error}\x1b[0m`);
      }

      term.write("$ ");
    } catch (error) {
      term.writeln(`\x1b[31mError: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      term.write("$ ");
    }
  };

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
          <span className="text-xs text-muted-foreground">
            {project.sandboxId.substring(0, 8)}...
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4 pb-20 md:pb-4">
        <div
          ref={terminalRef}
          className="h-full rounded-lg border border-border dark:border-border overflow-hidden"
          style={{ backgroundColor: "#0a0a0a" }}
        />
      </div>
    </div>
  );
}

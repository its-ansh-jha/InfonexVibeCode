import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./middleware/auth";
import { chatWithAI, SYSTEM_PROMPT, getToolCallSummary } from "./lib/openrouter";
import { listRepositories, writeFile, getFileContent, listFiles } from "./lib/github";
import { webSearch } from "./lib/serper";
import { insertProjectSchema, insertMessageSchema } from "@shared/schema";
import { encryptToken, decryptToken } from "./lib/encryption";

// Simple in-memory E2B sandbox tracking (in production, use database)
const sandboxes = new Map<string, { sandboxId: string; url: string; running: boolean; logs: string[] }>();

async function checkProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const project = await storage.getProject(projectId);
  return project?.userId === userId;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth - Sync Firebase user with database (requires valid ID token)
  app.post("/api/auth/sync", requireAuth, async (req: Request, res) => {
    try {
      const { id, email, displayName, photoURL } = req.body;
      
      // Verify the ID matches the authenticated user
      if (id !== req.userId) {
        return res.status(403).json({ error: "Forbidden: ID mismatch" });
      }
      
      const user = await storage.createUser({ id, email, displayName, photoURL });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects - CRUD (all require authentication)
  app.get("/api/projects", requireAuth, async (req: Request, res) => {
    try {
      const projects = await storage.getProjectsByUserId(req.userId!);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req: Request, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check ownership
      if (project.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", requireAuth, async (req: Request, res) => {
    try {
      const validated = insertProjectSchema.parse({ ...req.body, userId: req.userId });
      const project = await storage.createProject(validated);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req: Request, res) => {
    try {
      // Check ownership before deleting
      if (!(await checkProjectOwnership(req.params.id, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GitHub integration (requires authentication and ownership)
  app.post("/api/projects/:id/connect-github", requireAuth, async (req: Request, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check ownership
      if (project.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const { githubToken, repoFullName } = req.body;
      
      // Validate the GitHub token before saving
      try {
        await listRepositories(githubToken);
      } catch (error: any) {
        return res.status(400).json({ error: "Invalid GitHub token. Please generate a new personal access token with 'repo' scope." });
      }
      
      // Encrypt the GitHub token before storing in database
      const encryptedToken = encryptToken(githubToken);
      let updateData: any = { githubToken: encryptedToken };

      if (repoFullName) {
        const [owner, repo] = repoFullName.split("/");
        updateData = {
          ...updateData,
          githubRepoUrl: `https://github.com/${repoFullName}`,
          githubRepoName: repoFullName,
          githubOwner: owner,
        };
      }

      const updated = await storage.updateProject(req.params.id, updateData);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:id/disconnect-github", requireAuth, async (req: Request, res) => {
    try {
      // Check ownership
      if (!(await checkProjectOwnership(req.params.id, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const updated = await storage.updateProject(req.params.id, {
        githubToken: null,
        githubRepoUrl: null,
        githubRepoName: null,
        githubOwner: null,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/github/repos/:projectId", requireAuth, async (req: Request, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check ownership
      if (project.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      if (!project.githubToken) {
        return res.status(400).json({ error: "GitHub not connected" });
      }

      const decryptedToken = decryptToken(project.githubToken);
      const repos = await listRepositories(decryptedToken);
      res.json(repos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/github/files/:projectId", requireAuth, async (req: Request, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check ownership
      if (project.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      if (!project.githubToken || !project.githubOwner || !project.githubRepoName) {
        return res.status(400).json({ error: "GitHub repository not connected" });
      }

      const [, repo] = project.githubRepoName.split("/");
      const path = req.query.path as string || '';
      const decryptedToken = decryptToken(project.githubToken);
      const files = await listFiles(decryptedToken, project.githubOwner, repo, path);
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Messages - Chat with AI (requires authentication and ownership)
  app.get("/api/messages/:projectId", requireAuth, async (req: Request, res) => {
    try {
      // Check ownership
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const messages = await storage.getMessagesByProjectId(req.params.projectId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", requireAuth, async (req: Request, res) => {
    try {
      const { projectId, content } = req.body;
      
      // Check ownership
      if (!(await checkProjectOwnership(projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      // Save user message
      const userMessage = await storage.createMessage({
        projectId,
        role: "user",
        content,
        toolCalls: null,
      });

      // Get project for context
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get conversation history
      const history = await storage.getMessagesByProjectId(projectId);
      const messages = history.slice(-10).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Call AI
      const aiResponse = await chatWithAI(messages, SYSTEM_PROMPT);

      // Process tool calls
      const toolResults: any[] = [];
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        for (const tool of aiResponse.toolCalls) {
          try {
            let result;
            const summary = getToolCallSummary(tool.name, tool.arguments);
            
            switch (tool.name) {
              case "write_file":
                if (project.githubToken && project.githubOwner && project.githubRepoName) {
                  try {
                    const [, repo] = project.githubRepoName.split("/");
                    const decryptedToken = decryptToken(project.githubToken);
                    await writeFile(
                      decryptedToken,
                      project.githubOwner,
                      repo,
                      tool.arguments.path,
                      tool.arguments.content,
                      `AI: Create/update ${tool.arguments.path}`
                    );
                    result = { status: "success", message: `File ${tool.arguments.path} saved to GitHub` };
                  } catch (error: any) {
                    if (error.status === 401) {
                      result = { status: "error", message: "GitHub token expired. Please reconnect your repository." };
                    } else {
                      result = { status: "error", message: `Failed to write file: ${error.message}` };
                    }
                  }
                } else {
                  result = { status: "error", message: "GitHub not connected. Please connect a repository first." };
                }
                break;

              case "edit_file":
                if (project.githubToken && project.githubOwner && project.githubRepoName) {
                  try {
                    const [, repo] = project.githubRepoName.split("/");
                    const decryptedToken = decryptToken(project.githubToken);
                    const existing = await getFileContent(
                      decryptedToken,
                      project.githubOwner,
                      repo,
                      tool.arguments.path
                    );
                    const updated = existing.replace(
                      tool.arguments.search,
                      tool.arguments.replace
                    );
                    await writeFile(
                      decryptedToken,
                      project.githubOwner,
                      repo,
                      tool.arguments.path,
                      updated,
                      `AI: Edit ${tool.arguments.path}`
                    );
                    result = { status: "success", message: `File ${tool.arguments.path} updated on GitHub` };
                  } catch (error: any) {
                    if (error.status === 401) {
                      result = { status: "error", message: "GitHub token expired. Please reconnect your repository." };
                    } else {
                      result = { status: "error", message: `Failed to edit file: ${error.message}` };
                    }
                  }
                } else {
                  result = { status: "error", message: "GitHub not connected. Please connect a repository first." };
                }
                break;

              case "serper_web_search":
                const searchResults = await webSearch(tool.arguments.query);
                result = { status: "success", data: searchResults };
                break;

              case "configure_run_button":
                await storage.updateProject(projectId, {
                  runCommand: tool.arguments.command,
                });
                result = { status: "success", message: `Run command set to: ${tool.arguments.command}` };
                break;

              case "run_app":
                result = { status: "success", message: "Use the Preview tab to run your app" };
                break;

              default:
                result = { status: "error", message: `Unknown tool: ${tool.name}` };
            }

            toolResults.push({ name: tool.name, summary, ...result });
          } catch (error: any) {
            const summary = getToolCallSummary(tool.name, tool.arguments);
            toolResults.push({ name: tool.name, summary, status: "error", message: error.message });
          }
        }
      }

      // Save AI response
      const aiMessage = await storage.createMessage({
        projectId,
        role: "assistant",
        content: aiResponse.content,
        toolCalls: toolResults.length > 0 ? toolResults : null,
      });

      res.json(aiMessage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // E2B Sandbox management (requires authentication and ownership)
  app.get("/api/sandbox/status/:projectId", requireAuth, async (req: Request, res) => {
    try {
      // Check ownership
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const status = sandboxes.get(req.params.projectId) || {
        sandboxId: null,
        running: false,
        url: null,
        logs: [],
      };
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sandbox/run", requireAuth, async (req: Request, res) => {
    try {
      const { projectId } = req.body;
      
      // Check ownership
      if (!(await checkProjectOwnership(projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.runCommand) {
        return res.status(400).json({ error: "No run command configured. Ask the AI to configure a run command first." });
      }

      if (!project.githubToken || !project.githubOwner || !project.githubRepoName) {
        return res.status(400).json({ error: "GitHub repository not connected. Connect your repository first." });
      }

      // Mock E2B sandbox creation with proper port (3000)
      // In production, use: const sandbox = await Sandbox.create()
      const sandboxId = `sb_${Date.now()}`;
      const url = `https://sandbox-${sandboxId}.e2b.dev`; // Mock URL
      
      sandboxes.set(projectId, {
        sandboxId,
        url,
        running: true,
        logs: [
          `Starting E2B sandbox...`,
          `Cloning repository from GitHub...`,
          `Installing dependencies...`,
          `Running: ${project.runCommand}`,
          `Application started successfully`,
          `Server listening on port 3000`,
          `Preview available at ${url}`,
        ],
      });

      res.json(sandboxes.get(projectId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sandbox/stop", requireAuth, async (req: Request, res) => {
    try {
      const { projectId } = req.body;
      
      // Check ownership
      if (!(await checkProjectOwnership(projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      sandboxes.delete(projectId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

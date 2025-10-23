import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./middleware/auth";
import { chatWithAIStream, SYSTEM_PROMPT, getToolCallSummary } from "./lib/openrouter";
import { webSearch } from "./lib/serper";
import { insertProjectSchema, insertMessageSchema, insertFileSchema } from "@shared/schema";
import { uploadFileToS3, getFileFromS3, deleteFileFromS3, deleteProjectFilesFromS3 } from "./lib/s3";
import { 
  createSandbox, 
  executeCode, 
  executeShellCommand, 
  writeFileToSandbox, 
  getSandboxUrl,
  closeSandbox,
  getSandboxStatus,
  checkSandboxPort
} from "./lib/e2b";

async function checkProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const project = await storage.getProject(projectId);
  return project?.userId === userId;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth - Sync Firebase user with database (requires valid ID token)
  app.post("/api/auth/sync", requireAuth, async (req: Request, res) => {
    try {
      const { id, email, displayName, photoURL } = req.body;
      
      if (id !== req.userId) {
        return res.status(403).json({ error: "Forbidden: ID mismatch" });
      }
      
      const user = await storage.createUser({ id, email, displayName, photoURL });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects - CRUD
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
      const project = await storage.createProject({
        ...validated,
        s3Prefix: `projects/${validated.userId}/${Date.now()}`,
      });
      
      // Create E2B sandbox for the project
      try {
        const sandboxInfo = await createSandbox(project.id);
        await storage.updateProject(project.id, {
          sandboxId: sandboxInfo.sandboxId,
          sandboxUrl: sandboxInfo.url,
        });
        
        const updatedProject = await storage.getProject(project.id);
        res.json(updatedProject);
      } catch (error: any) {
        console.error('Failed to create sandbox:', error);
        res.json(project);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.id, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      // Clean up S3 files
      await deleteProjectFilesFromS3(req.params.id);
      
      // Close E2B sandbox
      await closeSandbox(req.params.id);
      
      // Delete project and files from database
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Files - CRUD
  app.get("/api/files/:projectId", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const files = await storage.getFilesByProjectId(req.params.projectId);
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/files/:projectId/:fileId", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const file = await storage.getFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const content = await getFileFromS3(file.s3Key);
      res.json({ ...file, content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/files/:projectId/download", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const files = await storage.getFilesByProjectId(req.params.projectId);
      const project = await storage.getProject(req.params.projectId);
      
      // Create JSON structure of all files
      const fileContents: Record<string, string> = {};
      for (const file of files) {
        try {
          const content = await getFileFromS3(file.s3Key);
          fileContents[file.path] = content;
        } catch (error) {
          console.error(`Failed to fetch file ${file.path}:`, error);
        }
      }
      
      const downloadData = {
        projectName: project?.name || 'project',
        files: fileContents,
        exportedAt: new Date().toISOString(),
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${project?.name || 'project'}-source.json"`);
      res.json(downloadData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files", requireAuth, async (req: Request, res) => {
    try {
      const { projectId, path, content } = req.body;
      
      if (!(await checkProjectOwnership(projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      // Upload to S3
      const s3Key = await uploadFileToS3(projectId, path, content);
      
      // Write to E2B sandbox
      try {
        await writeFileToSandbox(projectId, path, content);
      } catch (error) {
        console.error('Failed to write to sandbox:', error);
      }
      
      // Check if file already exists
      const existingFile = await storage.getFileByPath(projectId, path);
      
      if (existingFile) {
        // Update existing file
        const updated = await storage.updateFile(existingFile.id, {
          s3Key,
          size: Buffer.byteLength(content, 'utf-8'),
        });
        res.json(updated);
      } else {
        // Create new file
        const file = await storage.createFile({
          projectId,
          path,
          s3Key,
          size: Buffer.byteLength(content, 'utf-8'),
        });
        res.json(file);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/files/:fileId", requireAuth, async (req: Request, res) => {
    try {
      const file = await storage.getFile(req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      if (!(await checkProjectOwnership(file.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      // Delete from S3
      await deleteFileFromS3(file.s3Key);
      
      // Delete from database
      await storage.deleteFile(req.params.fileId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // E2B Sandbox operations
  app.post("/api/sandbox/:projectId/execute", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const { code, language } = req.body;
      const result = await executeCode(req.params.projectId, code, language);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sandbox/:projectId/shell", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const { command } = req.body;
      const result = await executeShellCommand(req.params.projectId, command);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sandbox/:projectId/url", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const project = await storage.getProject(req.params.projectId);
      
      if (project?.sandboxUrl && project?.sandboxId) {
        res.json({ url: project.sandboxUrl });
      } else {
        const sandboxInfo = await createSandbox(req.params.projectId);
        await storage.updateProject(req.params.projectId, {
          sandboxId: sandboxInfo.sandboxId,
          sandboxUrl: sandboxInfo.url,
        });
        res.json({ url: sandboxInfo.url });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sandbox/:projectId/recreate", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const { recreateSandbox } = await import("./lib/e2b");
      
      // Recreate the sandbox
      const sandboxInfo = await recreateSandbox(req.params.projectId);
      
      // Update project with new sandbox info
      await storage.updateProject(req.params.projectId, {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.url,
      });
      
      // Sync all files to new sandbox
      const files = await storage.getFilesByProjectId(req.params.projectId);
      for (const file of files) {
        try {
          const content = await getFileFromS3(file.s3Key);
          await writeFileToSandbox(req.params.projectId, file.path, content);
        } catch (error) {
          console.error(`Failed to sync file ${file.path} to new sandbox:`, error);
        }
      }
      
      res.json({ 
        url: sandboxInfo.url,
        sandboxId: sandboxInfo.sandboxId,
        filesSynced: files.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sandbox/:projectId/validate", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const { validateSandbox } = await import("./lib/e2b");
      const isValid = await validateSandbox(req.params.projectId);
      
      res.json({ isValid });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Messages - Chat with AI
  app.get("/api/messages/:projectId", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }
      
      const messages = await storage.getMessagesByProjectId(req.params.projectId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages/stream", requireAuth, async (req: Request, res) => {
    try {
      const { projectId, content } = req.body;
      
      if (!(await checkProjectOwnership(projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      // Save user message
      await storage.createMessage({
        projectId,
        role: "user",
        content,
      });

      // Get sandbox status and preview state
      const sandboxStatus = await getSandboxStatus(projectId);
      const port3000Active = await checkSandboxPort(projectId, 3000);
      const project = await storage.getProject(projectId);
      
      // Build sandbox context for AI
      let sandboxContext = '';
      if (sandboxStatus.isActive) {
        sandboxContext = `\n\n[SANDBOX STATUS]\n`;
        sandboxContext += `- Sandbox ID: ${project?.sandboxId}\n`;
        sandboxContext += `- Preview URL: ${project?.sandboxUrl}\n`;
        sandboxContext += `- Port 3000 accessible: ${port3000Active ? 'YES - Server is running' : 'NO - No server running on port 3000'}\n`;
        sandboxContext += `- Running processes: ${sandboxStatus.processCount}\n`;
        
        if (!port3000Active && sandboxStatus.hasRunningProcesses) {
          sandboxContext += `\nWARNING: Processes are running but port 3000 is not accessible. The preview won't work until you start a web server on port 3000.\n`;
        } else if (!port3000Active && !sandboxStatus.hasRunningProcesses) {
          sandboxContext += `\nNOTE: No server is running. If the user wants to see the preview, you need to start a web server on port 3000 using 0.0.0.0 as host.\n`;
        }
      }

      // Get previous messages for context
      const previousMessages = await storage.getMessagesByProjectId(projectId);
      const aiMessages = previousMessages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Add current user message with sandbox context
      const userMessageWithContext = sandboxContext ? `${content}${sandboxContext}` : content;
      aiMessages.push({ role: "user" as const, content: userMessageWithContext });

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';
      const toolCalls: any[] = [];

      try {
        for await (const chunk of chatWithAIStream(aiMessages, SYSTEM_PROMPT)) {
          fullResponse += chunk;
          
          // Don't try to strip tool calls during streaming - just collect the response
          // We'll parse tools after streaming is complete
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
        
        // Remove tool calls from the response before saving
        const cleanResponse = fullResponse.replace(/\[tool:\w+\]\{[\s\S]*?\}\s*(?=\[tool:|\n\n|$)/g, '').trim();

        // Parse tool calls from the full response with better error handling
        // Use a more robust regex that handles multi-line JSON
        const toolCallPattern = /\[tool:(\w+)\](\{[\s\S]*?\})\s*(?=\[tool:|\n\n|$)/g;
        const toolCallMatches = Array.from(fullResponse.matchAll(toolCallPattern));
        
        for (const match of toolCallMatches) {
          const toolName = match[1];
          let jsonStr = match[2];
          let args;
          
          try {
            // Try to parse the JSON directly first
            args = JSON.parse(jsonStr);
          } catch (parseError) {
            // If that fails, try to extract and clean the JSON more carefully
            try {
              // Find the complete JSON object by counting braces
              let braceCount = 0;
              let startIdx = jsonStr.indexOf('{');
              let endIdx = startIdx;
              
              for (let i = startIdx; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') braceCount++;
                if (jsonStr[i] === '}') braceCount--;
                if (braceCount === 0) {
                  endIdx = i + 1;
                  break;
                }
              }
              
              jsonStr = jsonStr.substring(startIdx, endIdx);
              args = JSON.parse(jsonStr);
            } catch (secondError) {
              console.error(`Failed to parse tool arguments for ${toolName}:`, jsonStr.substring(0, 200));
              res.write(`data: ${JSON.stringify({ type: 'error', message: `Failed to parse ${toolName} arguments` })}\n\n`);
              continue;
            }
          }
          
          // Execute tool calls
          try {
            if (toolName === 'write_file') {
              const { path, content: fileContent } = args;
              
              // Upload to S3
              const s3Key = await uploadFileToS3(projectId, path, fileContent);
              
              // Write to E2B sandbox
              await writeFileToSandbox(projectId, path, fileContent);
              
              // Save to database
              const existingFile = await storage.getFileByPath(projectId, path);
              if (existingFile) {
                await storage.updateFile(existingFile.id, {
                  s3Key,
                  size: Buffer.byteLength(fileContent, 'utf-8'),
                });
              } else {
                await storage.createFile({
                  projectId,
                  path,
                  s3Key,
                  size: Buffer.byteLength(fileContent, 'utf-8'),
                });
              }
              
              const summary = `Created ${path}`;
              toolCalls.push({ name: toolName, arguments: args, summary });
              res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
            } else if (toolName === 'run_shell') {
              const { command } = args;
              const result = await executeShellCommand(projectId, command);
              const summary = `Ran: ${command}`;
              toolCalls.push({ name: toolName, arguments: args, summary, result });
              res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary, result })}\n\n`);
            } else if (toolName === 'run_code') {
              const { code, language } = args;
              const result = await executeCode(projectId, code, language);
              const summary = `Executed ${language} code`;
              toolCalls.push({ name: toolName, arguments: args, summary, result });
              res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary, result })}\n\n`);
            } else if (toolName === 'serper_web_search') {
              const { query } = args;
              const results = await webSearch(query);
              const summary = `Searched: ${query}`;
              toolCalls.push({ name: toolName, arguments: args, summary, results });
              res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
            }
          } catch (toolError: any) {
            console.error(`Tool execution error (${toolName}):`, toolError);
            res.write(`data: ${JSON.stringify({ type: 'error', message: toolError.message })}\n\n`);
          }
        }

        // Save assistant message (without tool call syntax)
        await storage.createMessage({
          projectId,
          role: "assistant",
          content: cleanResponse || "Processing...",
          toolCalls: toolCalls.length > 0 ? toolCalls : null,
        });

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      } catch (error: any) {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./middleware/auth";
import { chatWithAIStream, SYSTEM_PROMPT, getToolCallSummary } from "./lib/gemini";
import { webSearch } from "./lib/serper";
import { insertProjectSchema, insertMessageSchema, insertFileSchema } from "@shared/schema";
import { uploadFileToS3, getFileFromS3, deleteFileFromS3, deleteProjectFilesFromS3 } from "./lib/s3";
import { 
  createSandbox, 
  executeCode, 
  executeShellCommand,
  writeFileToSandbox,
  deleteFileFromSandbox,
  getSandboxUrl,
  closeSandbox,
  getSandboxStatus,
  checkSandboxPort
} from "./lib/e2b";
import { ensureViteConfigAllowedHosts, validateViteConfigOnWrite } from "./lib/viteConfigSync";

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

  app.post("/api/projects/:id/boilerplate", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.id, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const { type } = req.body;
      
      if (!['react-vite', 'node-express'].includes(type)) {
        return res.status(400).json({ error: "Invalid boilerplate type" });
      }

      const { createBoilerplateProject } = await import('./lib/boilerplate');
      await createBoilerplateProject(req.params.id, type as 'react-vite' | 'node-express');
      
      res.json({ success: true, message: `${type} boilerplate created successfully` });
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

      // Delete from E2B sandbox
      const sandboxDeletion = await deleteFileFromSandbox(file.projectId, file.path);

      // Delete from database
      await storage.deleteFile(req.params.fileId);

      res.json({ 
        success: true, 
        deleted: { 
          s3: true, 
          sandbox: sandboxDeletion.success, 
          database: true 
        },
        sandboxError: sandboxDeletion.error
      });
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
        // Check and fix vite.config.ts if needed
        await ensureViteConfigAllowedHosts(req.params.projectId);
        res.json({ url: project.sandboxUrl });
      } else {
        const sandboxInfo = await createSandbox(req.params.projectId);
        await storage.updateProject(req.params.projectId, {
          sandboxId: sandboxInfo.sandboxId,
          sandboxUrl: sandboxInfo.url,
        });
        // Check and fix vite.config.ts if needed
        await ensureViteConfigAllowedHosts(req.params.projectId);
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

      // Ensure vite.config.ts has correct allowedHosts setting
      await ensureViteConfigAllowedHosts(req.params.projectId);

      // Get project to check for workflow command
      const project = await storage.getProject(req.params.projectId);

      // If there's a saved workflow command, run it automatically
      if (project?.workflowCommand) {
        try {
          // Run the workflow command in the background
          executeShellCommand(req.params.projectId, project.workflowCommand).catch(err => 
            console.error('Background workflow command error:', err)
          );
        } catch (error) {
          console.error('Failed to run workflow command:', error);
        }
      }

      res.json({ 
        url: sandboxInfo.url,
        sandboxId: sandboxInfo.sandboxId,
        workflowCommand: project?.workflowCommand || null,
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

  app.post("/api/sandbox/:projectId/run-workflow", requireAuth, async (req: Request, res) => {
    try {
      if (!(await checkProjectOwnership(req.params.projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const project = await storage.getProject(req.params.projectId);

      if (!project?.workflowCommand) {
        return res.status(400).json({ error: "No workflow command configured" });
      }

      // Run the workflow command in the background
      executeShellCommand(req.params.projectId, project.workflowCommand).catch(err => 
        console.error('Background workflow command error:', err)
      );

      res.json({ 
        success: true,
        command: project.workflowCommand
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Image Upload
  app.post("/api/upload/image", requireAuth, async (req: any, res) => {
    try {
      const multer = (await import("multer")).default;

      // Configure multer with file size limit (5MB) and file filter
      const upload = multer({ 
        storage: multer.memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024 // 5MB limit
        },
        fileFilter: (req: any, file: any, cb: any) => {
          // Only allow image files
          const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
          if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed.'));
          }
        }
      });

      upload.single('file')(req, res, async (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds 5MB limit' });
          }
          return res.status(400).json({ error: err.message });
        }

        const file = req.file;
        const projectId = req.body.projectId;

        if (!file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        if (!(await checkProjectOwnership(projectId, req.userId!))) {
          return res.status(403).json({ error: "Forbidden: Access denied" });
        }

        // Generate unique filename with safe extension
        const timestamp = Date.now();
        const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${timestamp}-${sanitizedOriginalName}`;
        const path = `attachments/${filename}`;

        // Upload to S3
        const s3Key = await uploadFileToS3(projectId, path, file.buffer.toString('base64'));

        // Get public URL (you may need to adjust based on your S3 configuration)
        const url = `https://s3.amazonaws.com/${process.env.S3_BUCKET_NAME}/${s3Key}`;

        res.json({ url, path, s3Key });
      });
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
      const { projectId, content, attachments } = req.body;

      if (!(await checkProjectOwnership(projectId, req.userId!))) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      // Set up SSE with keepalive
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Track if client is still connected
      let clientConnected = true;
      req.on('close', () => {
        clientConnected = false;
      });

      // Send keepalive pings every 15 seconds
      const keepaliveInterval = setInterval(() => {
        if (clientConnected) {
          res.write(': keepalive\n\n');
        } else {
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // Save user message with attachments
      const userMessage = await storage.createMessage({
        projectId,
        role: "user",
        content,
        attachments: attachments || null,
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

      // Stream AI response
      let fullResponse = "";
      const toolCalls: any[] = [];
      const actions: any[] = [];

      try {
        // Use chatWithAIStream which is already compatible with streaming
        for await (const chunk of chatWithAIStream(aiMessages, SYSTEM_PROMPT)) {
          if (chunk.type === 'text') {
            fullResponse += chunk.content;
            // Only send to client if still connected
            if (clientConnected) {
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk.content })}\n\n`);
            }
          } else if (chunk.type === 'action') {
            // Track actions and send to client in real-time
            actions.push(chunk.data);
            if (clientConnected) {
              res.write(`data: ${JSON.stringify({ type: 'action', action: chunk.data })}\n\n`);
            }
          } else if (chunk.type === 'tool_call') {
            const { name: toolName, arguments: args } = chunk.data;
            let toolResult: any = null;

            // Execute tool calls
            try {
              if (toolName === 'write_file') {
                const { path, content } = args;

                // Validate and fix vite.config.ts if needed
                const finalContent = await validateViteConfigOnWrite(projectId, path, content);

                // Upload to S3
                const s3Key = await uploadFileToS3(projectId, path, finalContent);

                // Write to E2B sandbox
                await writeFileToSandbox(projectId, path, finalContent);

                // Save to database
                const existingFile = await storage.getFileByPath(projectId, path);
                if (existingFile) {
                  await storage.updateFile(existingFile.id, {
                    s3Key,
                    size: Buffer.byteLength(finalContent, 'utf-8'),
                  });
                } else {
                  await storage.createFile({
                    projectId,
                    path,
                    s3Key,
                    size: Buffer.byteLength(finalContent, 'utf-8'),
                  });
                }

                const summary = `Created ${path}`;
                toolCalls.push({ name: toolName, arguments: args, summary });
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              } else if (toolName === 'edit_file') {
                const { path, old_str, new_str } = args;

                // Get existing file
                const existingFile = await storage.getFileByPath(projectId, path);
                if (!existingFile) {
                  throw new Error(`File not found: ${path}`);
                }

                // Get current content from S3
                const currentContent = await getFileFromS3(existingFile.s3Key);

                // Apply edit
                let fileContent = currentContent.replace(old_str, new_str);

                // Validate and fix vite.config.ts if needed
                fileContent = await validateViteConfigOnWrite(projectId, path, fileContent);

                // Upload to S3
                const s3Key = await uploadFileToS3(projectId, path, fileContent);

                // Write to E2B sandbox
                await writeFileToSandbox(projectId, path, fileContent);
                
                const summary = `Edited ${path}`;
                toolCalls.push({ name: toolName, arguments: args, summary });
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              } else if (toolName === 'delete_file') {
                const { path } = args;

                let deletionStatus = { s3: false, sandbox: false, database: false };
                let summary = `Deleted ${path}`;
                const errors: string[] = [];

                // Find file in database
                const existingFile = await storage.getFileByPath(projectId, path);

                if (existingFile) {
                  // Delete from S3
                  try {
                    await deleteFileFromS3(existingFile.s3Key);
                    deletionStatus.s3 = true;
                  } catch (error: any) {
                    console.error('Failed to delete file from S3:', error);
                    errors.push(`S3: ${error.message}`);
                  }

                  // Delete from E2B sandbox
                  const sandboxDeletion = await deleteFileFromSandbox(projectId, path);
                  deletionStatus.sandbox = sandboxDeletion.success;
                  if (!sandboxDeletion.success && sandboxDeletion.error) {
                    console.error('Failed to delete file from sandbox:', sandboxDeletion.error);
                    errors.push(`Sandbox: ${sandboxDeletion.error}`);
                  }

                  // Delete from database - only if at least one of the above succeeded
                  if (deletionStatus.s3 || deletionStatus.sandbox) {
                    try {
                      await storage.deleteFile(existingFile.id);
                      deletionStatus.database = true;
                    } catch (error: any) {
                      console.error('Failed to delete file from database:', error);
                      errors.push(`Database: ${error.message}`);
                    }
                  }

                  // Update summary based on results
                  if (errors.length > 0) {
                    summary = `Partially deleted ${path} (${errors.join(', ')})`;
                  }
                } else {
                  summary = `File ${path} not found in database`;
                }

                toolCalls.push({ name: toolName, arguments: args, summary, result: deletionStatus });
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              } else if (toolName === 'list_files') {
                // List all files in the project
                const files = await storage.getFilesByProjectId(projectId);
                const fileList = files.map(f => ({
                  path: f.path,
                  size: f.size,
                  mimeType: f.mimeType,
                }));

                const summary = `Listed ${files.length} files`;
                toolCalls.push({ name: toolName, arguments: args, summary, result: fileList });
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              } else if (toolName === 'read_file') {
                const { path } = args;

                // Get file from database
                const existingFile = await storage.getFileByPath(projectId, path);
                if (!existingFile) {
                  throw new Error(`File not found: ${path}`);
                }

                // Read content from S3
                const content = await getFileFromS3(existingFile.s3Key);

                const summary = `Read ${path} (${content.length} characters)`;
                toolCalls.push({ name: toolName, arguments: args, summary, result: { content, path } });
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              } else if (toolName === 'run_shell') {
                const { command } = args;

                // Check if this is a long-running server command
                const isServerCommand = command.includes('python -m http.server') || 
                                       command.includes('npm start') || 
                                       command.includes('npm run dev') ||
                                       command.includes('node ') ||
                                       command.match(/python\s+.*\.py/) ||
                                       command.includes('flask run') ||
                                       command.includes('streamlit run');

                if (isServerCommand) {
                  // For server commands, start in background and don't wait
                  executeShellCommand(projectId, command).catch(err => 
                    console.error('Background command error:', err)
                  );

                  // Save workflow command for auto-restart on sandbox recreation
                  await storage.updateProject(projectId, {
                    workflowCommand: command
                  });

                  const summary = `Started: ${command}`;
                  toolCalls.push({ name: toolName, arguments: args, summary, result: { 
                    stdout: 'Server started in background',
                    stderr: '',
                    exitCode: 0
                  }});
                  if (clientConnected) {
                    res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                  }
                } else {
                  // For regular commands, wait for completion with timeout
                  const result = await Promise.race([
                    executeShellCommand(projectId, command),
                    new Promise<any>((_, reject) => 
                      setTimeout(() => reject(new Error('Command timeout')), 10000)
                    )
                  ]).catch(err => ({
                    stdout: '',
                    stderr: err.message === 'Command timeout' ? 'Command timed out (running in background)' : err.message,
                    exitCode: err.message === 'Command timeout' ? 0 : 1
                  }));

                  const summary = `Ran shell: ${command}`;
                  toolCalls.push({ name: toolName, arguments: args, summary, result });
                  if (clientConnected) {
                    res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                  }
                }
              } else if (toolName === 'run_code') {
                const { code, language } = args;
                const result = await executeCode(projectId, code, language);
                const summary = `Executed ${language} code`;
                toolCalls.push({ name: toolName, arguments: args, summary, result });
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              } else if (toolName === 'configure_workflow') {
                const { command } = args;

                // Save workflow command for auto-restart
                await storage.updateProject(projectId, {
                  workflowCommand: command
                });

                const summary = `Configured workflow: ${command}`;
                toolCalls.push({ name: toolName, arguments: args, summary, result: { 
                  command,
                  message: 'Workflow command saved. Will auto-run on sandbox restart and available via manual run button.'
                }});
                if (clientConnected) {
                  res.write(`data: ${JSON.stringify({ type: 'tool', name: toolName, summary })}\n\n`);
                }
              }
            } catch (toolError: any) {
              console.error(`Tool execution error (${toolName}):`, toolError);
              if (clientConnected) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: toolError.message })}\n\n`);
              }
            }
          }
        }

        // Mark all actions as completed after streaming finishes
        const completedActions = actions.map(action => ({
          ...action,
          status: 'completed' as const
        }));

        // Send final action status updates to client
        if (clientConnected && completedActions.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'actions_completed', actions: completedActions })}\n\n`);
        }

        // Save assistant message with tool calls and completed actions (even if client disconnected)
        await storage.createMessage({
          projectId,
          role: "assistant",
          content: fullResponse,
          toolCalls: toolCalls.length > 0 ? toolCalls : null,
          actions: completedActions.length > 0 ? completedActions : null,
        });

        clearInterval(keepaliveInterval);

        if (clientConnected) {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
        }
      } catch (error: any) {
        console.error('Streaming error:', error);
        clearInterval(keepaliveInterval);
        if (clientConnected) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          res.end();
        }
      }
    } catch (error: any) {
      console.error('Stream setup error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
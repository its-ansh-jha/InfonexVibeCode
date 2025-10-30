import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

interface ChatResponse {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
}

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Use inference profile ARN for Claude Sonnet 4.5
const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

export async function* chatWithAIStream(
  messages: Message[],
  systemPrompt?: string,
  enableReasoning: boolean = false,
  reasoningBudget: number = 4096
): AsyncGenerator<{ type: 'text' | 'thinking' | 'action' | 'tool_call'; content?: string; data?: any }, void, unknown> {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials are not set");
  }

  const conversationMessages = messages
    .filter(msg => msg.role !== "system")
    .map(msg => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: [{ type: "text" as const, text: msg.content }],
    }));

  const requestBody: any = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    temperature: 1.0,
    messages: conversationMessages,
  };

  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  if (enableReasoning) {
    requestBody.thinking = {
      type: "enabled",
      budget_tokens: reasoningBudget,
    };
  }

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  try {
    const response = await client.send(command);

    if (!response.body) {
      throw new Error("No response body from Bedrock");
    }

    let fullContent = "";
    let fullThinking = "";
    let buffer = "";
    let currentBlockType = "";

    for await (const event of response.body) {
      if (event.chunk) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

        if (chunk.type === "content_block_start") {
          currentBlockType = chunk.content_block?.type || "";
          
          if (currentBlockType === "thinking") {
            yield { type: 'thinking', content: "" };
          }
        } else if (chunk.type === "content_block_delta") {
          const delta = chunk.delta;

          if (delta?.type === "thinking_delta") {
            const thinkingText = delta.thinking || "";
            fullThinking += thinkingText;
            yield { type: 'thinking', content: thinkingText };
          } else if (delta?.type === "text_delta") {
            const textContent = delta.text || "";
            fullContent += textContent;
            buffer += textContent;

            const actionMatches = parseActionsFromBuffer(buffer);
            for (const action of actionMatches.actions) {
              yield { type: 'action', data: action };
            }
            buffer = actionMatches.remaining;

            yield { type: 'text', content: textContent };
          }
        } else if (chunk.type === "content_block_stop") {
          currentBlockType = "";
        } else if (chunk.type === "message_stop") {
          break;
        }
      }
    }

    if (buffer.trim()) {
      const finalActions = parseActionsFromBuffer(buffer, true);
      for (const action of finalActions.actions) {
        yield { type: 'action', data: action };
      }
    }

    const toolCalls = parseToolCalls(fullContent);
    for (const toolCall of toolCalls) {
      yield { type: 'tool_call', data: toolCall };
    }
  } catch (error) {
    console.error("Bedrock streaming error:", error);
    throw error;
  }
}

export async function chatWithAI(
  messages: Message[],
  systemPrompt?: string,
  enableReasoning: boolean = false,
  reasoningBudget: number = 4096
): Promise<ChatResponse> {
  let content = "";
  let thinking = "";
  const toolCalls: ToolCall[] = [];

  for await (const event of chatWithAIStream(messages, systemPrompt, enableReasoning, reasoningBudget)) {
    if (event.type === 'text' && event.content) {
      content += event.content;
    } else if (event.type === 'thinking' && event.content) {
      thinking += event.content;
    } else if (event.type === 'tool_call' && event.data) {
      toolCalls.push(event.data);
    }
  }

  return {
    content,
    thinking: thinking || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

interface ActionMatch {
  description: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'error';
}

function parseActionsFromBuffer(buffer: string, isFinal: boolean = false): { actions: ActionMatch[], remaining: string } {
  const actions: ActionMatch[] = [];
  let remaining = buffer;

  const actionPattern = /\[action:(.*?)\]/g;
  let match;
  let lastIndex = 0;

  while ((match = actionPattern.exec(buffer)) !== null) {
    const description = match[1].trim();
    if (description) {
      actions.push({ 
        description,
        status: 'in_progress'
      });
    }
    lastIndex = match.index + match[0].length;
  }

  if (!isFinal && lastIndex > 0) {
    const partialMatch = buffer.slice(lastIndex).match(/\[action:/);
    if (partialMatch) {
      remaining = buffer.slice(lastIndex);
    } else {
      remaining = "";
    }
  } else if (isFinal) {
    remaining = "";
  }

  return { actions, remaining };
}

function parseToolCalls(content: string): ToolCall[] {
  const tools: ToolCall[] = [];

  const toolPattern = /\[tool:(\w+)\](\{[\s\S]*?)(?=\[tool:|$)/g;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    try {
      const toolName = match[1];
      let jsonStr = match[2].trim();

      let braceCount = 0;
      let jsonEnd = 0;
      for (let i = 0; i < jsonStr.length; i++) {
        if (jsonStr[i] === '{') braceCount++;
        if (jsonStr[i] === '}') braceCount--;
        if (braceCount === 0 && i > 0) {
          jsonEnd = i + 1;
          break;
        }
      }

      if (jsonEnd > 0) {
        jsonStr = jsonStr.substring(0, jsonEnd);
      }

      const args = JSON.parse(jsonStr);
      tools.push({ name: toolName, arguments: args });
    } catch (e) {
      console.error("Failed to parse tool call:", e);
      const toolName = match[1];
      console.error(`Tool: ${toolName}, Raw args: ${match[2].substring(0, 500)}...`);
    }
  }

  return tools;
}

export function getToolCallSummary(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case "create_boilerplate":
      return `Created ${args.type} boilerplate`;
    case "write_file":
      return `Created ${args.path}`;
    case "edit_file":
      return `Edited ${args.path}`;
    case "delete_file":
      return `Deleted ${args.path}`;
    case "list_files":
      return `Listed all files`;
    case "read_file":
      return `Read ${args.path}`;
    case "run_shell":
      return `Ran shell command: ${args.command}`;
    case "serper_web_search":
      return `Searched: ${args.query}`;
    case "run_code":
      return `Executed ${args.language} code`;
    default:
      return toolName;
  }
}

export const SYSTEM_PROMPT = `You are InfonexAgent, an advanced AI coding assistant created by Ansh and integrated into Vibe Code, an AI-powered app building platform.

You have access to the following MCP tools:
- create_boilerplate: Create a complete boilerplate project structure (React+Vite with pre-configured vite.config.ts). Use this when starting a NEW project or when user wants a fresh start. Types: 'react-vite'. The boilerplate includes a properly configured vite.config.ts that you must NEVER modify or recreate.
- write_file: Create or overwrite a file in the project's S3 storage and E2B sandbox
- edit_file: Edit specific parts of an existing file
- delete_file: Delete a file from both S3 storage and E2B sandbox permanently
- list_files: List all files in the current project (searches both S3 storage and E2B sandbox)
- read_file: Read the content of any file from S3 storage or E2B sandbox
- run_shell: Execute shell commands in the E2B sandbox terminal (supports long-running commands like npm run dev)
- run_code: Execute code in the E2B code interpreter (Python/JavaScript)
- Google Search: You have built-in access to Google Search - just ask questions naturally and I'll search for documentation, libraries, best practices, or any information needed DURING your work (not after)
- configure_workflow: Configure the run command for this project (automatically runs when sandbox is recreated and available via manual run button).If the project is related to a web app, always configure the workflow to run the development server command (npm install;npm run dev)

REAL-TIME ACTION TRACKING:
Before performing ANY action, announce it using this format: [action:description]
- Example: [action:Installing dependencies]
- Example: [action:Configured Start application to run npm run dev]
- Example: [action:Opened package.json]
- Example: [action:Installed dependencies]
- Example: [action:Integrating with Full-stack JavaScript Website]
These actions show the user what you're doing in real-time as you work.

CRITICAL RULES:
1. All files you create/edit/delete are automatically synced to S3 storage AND the E2B sandbox
2. When configuring web servers, ALWAYS use port 3000 (the E2B sandbox preview uses port 3000)
3. Use 0.0.0.0 as the host when binding ports to make them accessible
4. The user NEVER sees the full code in chat - only brief summaries
5. Keep your text responses SHORT - the user only sees what you're doing, not code details
6. MCP tool calls are processed in the backend - user only sees the summary badges
7. ALWAYS create websites, apps, and content in ENGLISH language unless specifically asked otherwise
8. DEFAULT STACK: Always create apps using React + Vite for frontend and Node.js + Express.js for backend (when backend is needed) unless the user explicitly requests a different technology
9. When starting a long-running server (npm run dev, etc.), ALWAYS use configure_workflow to save the command so it auto-runs when the sandbox restarts
10. CRITICAL: vite.config.ts is automatically included in the react-vite boilerplate with correct E2B sandbox configuration. You must NEVER create, modify, edit, or delete vite.config.js or vite.config.ts files - they are pre-configured and must remain untouched
11. FILE NAMING: Use PascalCase for React component files (App.tsx, Button.tsx). ALWAYS match exact filenames when editing - if you created "app.jsx", edit "app.jsx" not "App.jsx". Use list_files to verify exact filenames before editing
12. USE GOOGLE SEARCH PROACTIVELY: When you need to know how to use a library, check documentation, find best practices, or solve technical problems - just ask naturally and Google Search will provide real-time information DURING your work (not after)
13. Shell commands auto-forward results back to you - you'll see stdout/stderr automatically after execution
14. Shell commands auto-forward results back to you - you'll see stdout/stderr automatically after execution
15. AUTONOMOUS DEBUGGING: If something doesn't work, proactively search for solutions, check error messages, and fix issues without waiting for user input
16. Always when starts a app instead of running npm run dev command run the command (npm install;npm run dev) dont separate these commands make it always run in a single request both commands.
17. BOILERPLATE MCP TOOL USAGE: When starting a NEW React project or the user wants a fresh React+Vite setup, use create_boilerplate FIRST instead of manually creating individual files. This creates a complete, properly configured project in one step. Then modify the files as needed.
18. PACKAGE MANAGEMENT: When you need to use a new npm package (like react-router-dom, axios, etc.), you MUST:
    a) First update package.json using write_file or edit_file to add the package to "dependencies" or "devDependencies"
    b) Then run "npm install" using run_shell to install the package
    c) Only after installation, create/edit files that import that package
    Example: For react-router-dom, add it to package.json dependencies, run npm install, then create App.tsx with imports

=== E2B SANDBOX DOCUMENTATION ===

SANDBOX ARCHITECTURE:
- Each project runs in an isolated E2B cloud sandbox (small VM with internet access)
- Files written via write_file are automatically saved to both S3 and the E2B sandbox filesystem
- The sandbox provides a public preview URL at https://{port}-{sandbox-id}.e2b.dev
- Preview URL is ONLY accessible when a web server is actively running on port 3000

CRITICAL: TO SHOW PREVIEW, YOU MUST:
1. Create your app files (HTML, CSS, JS, Python, Node.js, etc.)
2. Start a web server on port 3000 with host 0.0.0.0
3. The server MUST bind to 0.0.0.0 (NOT localhost or 127.0.0.1) to be publicly accessible

STARTING WEB SERVERS (REQUIRED FOR PREVIEW):

For Static HTML/CSS/JS:
[tool:run_shell]{"command":"python -m http.server 3000 --bind 0.0.0.0"}
OR
[tool:run_shell]{"command":"npx serve -l 3000"}

For React/Vite Apps (RECOMMENDED DEFAULT):
1. Create package.json with scripts and vite.config.js with server: { host: '0.0.0.0', port: 3000 }
2. [tool:run_shell]{"command":"npm install"}
3. [tool:run_shell]{"command":"npm run dev"}
4. [tool:configure_workflow]{"command":"npm run dev"} - Save command for auto-restart

For Node.js/Express:
1. In your server file, use: app.listen(3000, '0.0.0.0', () => {...})
2. [tool:run_shell]{"command":"node server.js"}

For Python Flask:
1. In your app file, use: app.run(host='0.0.0.0', port=3000)
2. [tool:run_shell]{"command":"python app.py"}

For Next.js:
[tool:run_shell]{"command":"npm run dev -- -p 3000 -H 0.0.0.0"}

BACKGROUND PROCESSES:
- All server commands (npm run dev, python app.py, node server.js) run in BACKGROUND mode
- They start immediately and don't block - no need to wait for output
- The server needs a few seconds to fully initialize before the preview URL is accessible
- After starting a server, tell the user it's starting and will be ready shortly

COMPLETE WORKFLOW EXAMPLE:
1. Create files: [tool:write_file]{"path":"index.html","content":"..."}
2. Start server: [tool:run_shell]{"command":"python -m http.server 3000 --bind 0.0.0.0"}
3. Tell user: "Server is starting on port 3000. The preview will be available in a few seconds - refresh the preview tab if needed."

IMPORTANT: After starting a development server (npm run dev, etc.), ALWAYS mention:
- The server is starting in the background
- It will take a few seconds to be ready
- The user should refresh the preview tab if it doesn't load immediately

COMMON MISTAKES TO AVOID:
❌ Using localhost or 127.0.0.1 instead of 0.0.0.0
❌ Using wrong port (must be 3000)
❌ Forgetting to start a server after creating files
❌ Not configuring host: '0.0.0.0' in framework config files

FRAMEWORK-SPECIFIC CONFIG:

Vite: vite.config.ts is pre-configured in the boilerplate - DO NOT create or modify it

Express (server.js):
app.listen(3000, '0.0.0.0', () => console.log('Server running'))

Flask (app.py):
app.run(host='0.0.0.0', port=3000)

=== END E2B DOCUMENTATION ===

When using MCP tools, format them as: [tool:tool_name]{JSON_OBJECT}

MCP tool format rules:
- Use proper JSON with escaped quotes and newlines
- For file content, escape all special characters properly
- Example: [tool:create_boilerplate]{"type":"react-vite"} - Creates a complete React+Vite project structure with src/App.tsx (PascalCase)
- Example: [tool:write_file]{"path":"src/Button.tsx","content":"export function Button() {...}"} - Use PascalCase for React components
- Example: [tool:edit_file]{"path":"src/App.tsx","old_str":"old code","new_str":"new code"} - Match EXACT filename including case
- Example: [tool:run_shell]{"command":"npm install express"}
- Example: [tool:run_code]{"language":"python","code":"print(\\"Hello\\")"}
- Example: [tool:list_files]{} - Lists all files to verify exact names before editing
- Example: [tool:read_file]{"path":"package.json"} - Reads the content of package.json
- Example: [tool:configure_workflow]{"command":"npm run dev"} - Sets the auto-run command for sandbox restarts

RESPONSE STYLE:
✓ "I'll create index.html with a welcome page. Starting server on port 3000 - preview will be available shortly."
✗ "Here's the code for index.html: <!DOCTYPE html>..."

Remember: Be concise! Users see MCP tool badges, not code. ALWAYS START A SERVER for web apps! CREATE EVERYTHING IN ENGLISH!`;

// Official Google Gemini API integration for Gemini 2.5 Flash & Pro models
import { GoogleGenAI } from "@google/genai";

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
  toolCalls?: ToolCall[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function chatWithAI(
  messages: Message[],
  systemPrompt?: string
): Promise<ChatResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const selectedModel = "gemini-2.5-flash-preview-09-2025";

  const contents = messages
    .filter(msg => msg.role !== "system")
    .map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  const response = await ai.models.generateContent({
    model: selectedModel,
    config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
    contents,
  });

  const assistantMessage = response.text || "";
  const toolCalls = parseToolCalls(assistantMessage);

  return {
    content: assistantMessage,
    toolCalls,
  };
}

// Streaming version of chatWithAI that yields chunks, action events, and tool calls
export async function* chatWithAIStream(
  messages: Message[],
  systemPrompt?: string
): AsyncGenerator<{ type: 'text' | 'action' | 'tool_call'; content?: string; data?: any }, void, unknown> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const selectedModel = "gemini-2.5-flash-preview-09-2025";

  const contents = messages
    .filter(msg => msg.role !== "system")
    .map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  const stream = await ai.models.generateContentStream({
    model: selectedModel,
    config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
    contents,
  });

  let fullContent = "";
  let buffer = "";

  for await (const chunk of stream) {
    const content = chunk.text;
    if (content) {
      fullContent += content;
      buffer += content;
      
      // Parse and emit action events in real-time
      const actionMatches = parseActionsFromBuffer(buffer);
      for (const action of actionMatches.actions) {
        yield { type: 'action', data: action };
      }
      buffer = actionMatches.remaining;
      
      // Yield text content
      yield { type: 'text', content };
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const finalActions = parseActionsFromBuffer(buffer, true);
    for (const action of finalActions.actions) {
      yield { type: 'action', data: action };
    }
  }

  // After streaming is complete, parse tool calls from the full content
  const toolCalls = parseToolCalls(fullContent);
  for (const toolCall of toolCalls) {
    yield { type: 'tool_call', data: toolCall };
  }
}

interface ActionMatch {
  description: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'error';
}

function parseActionsFromBuffer(buffer: string, isFinal: boolean = false): { actions: ActionMatch[], remaining: string } {
  const actions: ActionMatch[] = [];
  let remaining = buffer;
  
  // Match action patterns like: [action:description]
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
  
  // Keep the part after the last complete match in the buffer
  if (!isFinal && lastIndex > 0) {
    // Check if there's a partial match at the end
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

  // Match tool call patterns like: [tool:write_file]{...}
  // Use a more permissive regex that captures until the next [tool: or end of string
  const toolPattern = /\[tool:(\w+)\](\{[\s\S]*?)(?=\[tool:|$)/g;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    try {
      const toolName = match[1];
      let jsonStr = match[2].trim();
      
      // Try to find the complete JSON object by counting braces
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

// Generate a human-readable summary for tool calls
export function getToolCallSummary(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case "write_file":
      return `Created ${args.path}`;
    case "edit_file":
      return `Edited ${args.path}`;
    case "delete_file":
      return `Deleted ${args.path}`;
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

export const SYSTEM_PROMPT = `You are InfonexAgent, an AI coding assistant created by Ansh and integrated into Vibe Code, an AI-powered app building platform.

You have access to the following tools:
- write_file: Create or overwrite a file in the project's S3 storage and E2B sandbox
- edit_file: Edit specific parts of an existing file
- delete_file: Delete a file from both S3 storage and E2B sandbox permanently
- run_shell: Execute shell commands in the E2B sandbox terminal (supports long-running commands like npm run dev)
- run_code: Execute code in the E2B code interpreter (Python/JavaScript)
- serper_web_search: Search the web for documentation, libraries, best practices, or any information needed DURING your work (not after)

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
6. Tool calls are processed in the backend - user only sees the summary badges
7. ALWAYS create websites, apps, and content in ENGLISH language unless specifically asked otherwise
8. When starting a server (npm run dev, python -m http.server, etc.), tell the user which command to use if they need to restart it
9. Always Create Apps In React.js And use backend if required of Node.js with Express.js Note:Express.js is optional .Only Create any Other language also only when specifically gave the instruction by user.
10. If you create a vite.config.js always set the server.allowedHosts to all .
11. USE WEB SEARCH PROACTIVELY: When you need to know how to use a library, check documentation, find best practices, or solve technical problems - use serper_web_search DURING your work, not after. This makes you more capable and accurate.
12. Shell commands auto-forward results back to you - you'll see stdout/stderr automatically after execution

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

For React/Vite Apps:
1. Create package.json with scripts
2. [tool:run_shell]{"command":"npm install"}
3. Configure vite.config.js with: server: { host: '0.0.0.0', port: 3000 }
4. [tool:run_shell]{"command":"npm run dev"}

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

Vite (vite.config.js):
export default {
  server: {
    host: '0.0.0.0',
    port: 3000
  }
}

Express (server.js):
app.listen(3000, '0.0.0.0', () => console.log('Server running'))

Flask (app.py):
app.run(host='0.0.0.0', port=3000)

=== END E2B DOCUMENTATION ===

When using tools, format them as: [tool:tool_name]{JSON_OBJECT}

Tool format rules:
- Use proper JSON with escaped quotes and newlines
- For file content, escape all special characters properly
- Example: [tool:write_file]{"path":"index.html","content":"<!DOCTYPE html>\\n<html>\\n  <body>\\n    <h1>Hello</h1>\\n  </body>\\n</html>"}
- Example: [tool:run_shell]{"command":"npm install express"}
- Example: [tool:run_code]{"language":"python","code":"print(\\"Hello\\")"}

CRITICAL: ALWAYS add plain text explanation AFTER each tool call to explain what you did and why.
- Example: [tool:write_file]{...} followed by "I created index.html with a responsive homepage layout."
- Example: [tool:run_shell]{...} followed by "Installed the Express framework for building the API server."

RESPONSE STYLE:
✓ "I'll create index.html with a welcome page. Starting server on port 3000 - preview will be available shortly."
✗ "Here's the code for index.html: <!DOCTYPE html>..."

Remember: Be concise! Users see tool badges, not code. ALWAYS add explanatory text after tool calls! ALWAYS START A SERVER for web apps! CREATE EVERYTHING IN ENGLISH!`;

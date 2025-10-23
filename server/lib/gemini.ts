// Official Google Gemini API integration for Gemini 2.5 Flash Preview model
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

  const contents = messages
    .filter(msg => msg.role !== "system")
    .map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-09-2025",
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

// Streaming version of chatWithAI that yields chunks and tool calls
export async function* chatWithAIStream(
  messages: Message[],
  systemPrompt?: string
): AsyncGenerator<{ type: 'text' | 'tool_call'; content?: string; data?: any }, void, unknown> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const contents = messages
    .filter(msg => msg.role !== "system")
    .map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash-preview-09-2025",
    config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
    contents,
  });

  let fullContent = "";

  for await (const chunk of stream) {
    const content = chunk.text;
    if (content) {
      fullContent += content;
      yield { type: 'text', content };
    }
  }

  // After streaming is complete, parse tool calls from the full content
  const toolCalls = parseToolCalls(fullContent);
  for (const toolCall of toolCalls) {
    yield { type: 'tool_call', data: toolCall };
  }
}

function parseToolCalls(content: string): ToolCall[] {
  const tools: ToolCall[] = [];

  // Match tool call patterns like: [tool:write_file]{"path":"...","content":"..."}
  const toolPattern = /\[tool:(\w+)\](\{(?:[^{}]|\{[^}]*\})*\})/g;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    try {
      const toolName = match[1];
      const args = JSON.parse(match[2]);
      tools.push({ name: toolName, arguments: args });
    } catch (e) {
      console.error("Failed to parse tool call:", e);
      const toolName = match[1];
      console.error(`Tool: ${toolName}, Raw args: ${match[2]}`);
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
- run_shell: Execute shell commands in the E2B sandbox terminal
- run_code: Execute code in the E2B code interpreter (Python/JavaScript)
- serper_web_search: Search the web for information

CRITICAL RULES:
1. All files you create/edit are automatically saved to S3 storage AND the E2B sandbox
2. When configuring web servers, ALWAYS use port 3000 (the E2B sandbox preview uses port 3000)
3. Use 0.0.0.0 as the host when binding ports to make them accessible
4. The user NEVER sees the full code in chat - only brief summaries
5. Keep your text responses SHORT - the user only sees what you're doing, not code details
6. Tool calls are processed in the backend - user only sees the summary badges
7. ALWAYS create websites, apps, and content in ENGLISH language unless specifically asked otherwise
8. When starting a server (npm run dev, python -m http.server, etc.), tell the user which command to use if they need to restart it
9. Always Create Apps In React.js with Vite And use backend if required of Node.js with Express.js Only Create any Other language alos only when specifically gave the instruction by user.

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
- Once started, the preview URL becomes accessible

COMPLETE WORKFLOW EXAMPLE:
1. Create files: [tool:write_file]{"path":"index.html","content":"..."}
2. Start server: [tool:run_shell]{"command":"python -m http.server 3000 --bind 0.0.0.0"}
3. Tell user: "Preview is now available on port 3000"

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

RESPONSE STYLE:
✓ "I'll create index.html with a welcome page. Starting server on port 3000 - preview will be available shortly."
✗ "Here's the code for index.html: <!DOCTYPE html>..."

Remember: Be concise! Users see tool badges, not code. ALWAYS START A SERVER for web apps! CREATE EVERYTHING IN ENGLISH!`;

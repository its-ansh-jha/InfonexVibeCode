// OpenRouter AI integration for GLM-4.5-air model
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

export async function chatWithAI(
  messages: Message[],
  systemPrompt?: string
): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const fullMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://replit.com",
      "X-Title": "Vibe Code Platform",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "z-ai/glm-4.5-air:free",
      messages: fullMessages,
      provider: {
        sort: "throughput",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  const assistantMessage = data.choices[0]?.message?.content || "";

  // Parse tool calls from the response
  const toolCalls = parseToolCalls(assistantMessage);

  return {
    content: assistantMessage,
    toolCalls,
  };
}

function parseToolCalls(content: string): ToolCall[] {
  const tools: ToolCall[] = [];
  
  // Match tool call patterns like: [tool:write_file]{"path":"...","content":"..."}
  // Use a more robust pattern that handles nested braces
  const toolPattern = /\[tool:(\w+)\](\{(?:[^{}]|\{[^}]*\})*\})/g;
  let match;

  while ((match = toolPattern.exec(content)) !== null) {
    try {
      const toolName = match[1];
      const args = JSON.parse(match[2]);
      tools.push({ name: toolName, arguments: args });
    } catch (e) {
      console.error("Failed to parse tool call:", e);
      // Try to extract tool name at least
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
      return `Create file ${args.path}`;
    case "edit_file":
      return `Edit file ${args.path}`;
    case "serper_web_search":
      return `Search: ${args.query}`;
    case "configure_run_button":
      return `Configure run: ${args.command}`;
    case "run_app":
      return "Run application";
    default:
      return toolName;
  }
}

export const SYSTEM_PROMPT = `You are an AI coding assistant integrated into Vibe Code, a platform for AI-powered development.

You have access to the following tools:
- write_file: Create or overwrite a file in the GitHub repository
- edit_file: Edit specific parts of an existing file
- serper_web_search: Search the web for information
- configure_run_button: Set the command to run the application
- run_app: Execute the configured run command

IMPORTANT RULES:
1. All files you create/edit are automatically saved to the connected GitHub repository
2. When configuring web servers, ALWAYS use port 3000 (the E2B sandbox uses port 3000)
3. Use 0.0.0.0 as the host when binding ports to make them accessible

When using tools, format them as: [tool:tool_name]{"arg1":"value1","arg2":"value2"}

For example:
[tool:write_file]{"path":"server.js","content":"const express = require('express');\nconst app = express();\napp.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));"}
[tool:configure_run_button]{"command":"node server.js"}
[tool:run_app]{}

Always explain what you're doing and provide helpful context to the user.`;

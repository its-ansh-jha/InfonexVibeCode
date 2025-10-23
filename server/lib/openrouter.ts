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

// Streaming version of chatWithAI
export async function* chatWithAIStream(
  messages: Message[],
  systemPrompt?: string
): AsyncGenerator<string, void, unknown> {
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
      stream: true,
      provider: {
        sort: "throughput",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
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

export const SYSTEM_PROMPT = `You are an AI coding assistant integrated into Vibe Code, an AI-powered app building platform.

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

When using tools, format them as: [tool:tool_name]{"arg1":"value1","arg2":"value2"}

Tool format examples (keep JSON on single line, escape special chars):
[tool:write_file]{"path":"index.html","content":"<!DOCTYPE html>\\n<html>\\n<body><h1>Hello</h1></body>\\n</html>"}
[tool:run_shell]{"command":"npm install express"}
[tool:run_code]{"language":"python","code":"print('Hello')"}

RESPONSE STYLE:
✓ "I'll create index.html with a welcome page"
✗ "Here's the code for index.html: <!DOCTYPE html>..."

Remember: Be concise! Users see tool badges, not code.`;

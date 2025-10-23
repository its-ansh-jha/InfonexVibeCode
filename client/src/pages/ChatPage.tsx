import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Send, Bot, User as UserIcon, Loader2, Wrench, FileCode, Terminal, Play, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ToolCall {
  name: string;
  summary?: string;
  arguments?: any;
  result?: any;
}

function CodeBlock({ code, language = "javascript" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 max-w-full">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-muted/50 border border-border rounded-t-lg">
        <span className="text-xs font-mono text-muted-foreground uppercase truncate">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-b-lg border border-t-0 border-border bg-muted/30 p-3 sm:p-4 text-sm max-w-full">
        <code className="font-mono text-[10px] xs:text-xs sm:text-sm block break-all whitespace-pre-wrap">{code}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Parse code blocks from content
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  
  // Match code blocks with ```language\ncode\n``` or ```\ncode\n``` format
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({
          type: 'text',
          content: textContent
        });
      }
    }
    
    // Add code block
    const codeContent = match[2].trim();
    if (codeContent) {
      parts.push({
        type: 'code',
        content: codeContent,
        language: match[1] || 'code'
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex).trim();
    if (remainingContent) {
      parts.push({
        type: 'text',
        content: remainingContent
      });
    }
  }

  // If no code blocks found, return plain text
  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm sm:text-base">{content}</p>;
  }

  return (
    <div className="space-y-2 max-w-full overflow-hidden">
      {parts.map((part, idx) => (
        part.type === 'code' ? (
          <CodeBlock key={idx} code={part.content} language={part.language} />
        ) : (
          <p key={idx} className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm sm:text-base">{part.content}</p>
        )
      ))}
    </div>
  );
}

export default function ChatPage() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamingTools, setStreamingTools] = useState<ToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", projectId],
    enabled: !!projectId,
  });

  // Refresh messages when returning to the page/tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && projectId) {
        // Refresh messages and files when tab becomes visible again
        queryClient.invalidateQueries({ queryKey: ["/api/messages", projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/files", projectId] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input;
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");
    setStreamingTools([]);

    // Track if page becomes hidden
    let wasHidden = false;
    const handleVisibilityChange = () => {
      if (document.hidden && isStreaming) {
        wasHidden = true;
        console.log('Tab hidden - AI will continue processing in background');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    try {
      // Get Firebase ID token for authentication
      const idToken = await auth.currentUser?.getIdToken();
      
      const response = await fetch("/api/messages/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          projectId,
          content: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let fullMessage = "";
      const tools: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              fullMessage += data.content;
              setStreamingMessage(fullMessage);
            } else if (data.type === 'tool') {
              const toolCall: ToolCall = {
                name: data.name,
                summary: data.summary,
                result: data.result,
              };
              tools.push(toolCall);
              setStreamingTools([...tools]);
            } else if (data.type === 'error') {
              toast({
                title: "Error",
                description: data.message,
                variant: "destructive",
              });
            } else if (data.type === 'done') {
              queryClient.invalidateQueries({ queryKey: ["/api/messages", projectId] });
              queryClient.invalidateQueries({ queryKey: ["/api/files", projectId] });
              
              // Show notification if tab was hidden
              if (wasHidden) {
                toast({
                  title: "AI Processing Complete",
                  description: "Your request was processed in the background",
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      // Always refresh to show any work that was completed
      queryClient.invalidateQueries({ queryKey: ["/api/messages", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/files", projectId] });
      
      if (wasHidden) {
        toast({
          title: "Processing Complete",
          description: "Your request was processed in the background",
        });
      } else {
        toast({
          title: "Connection interrupted",
          description: "Refreshing to show completed work...",
        });
      }
    } finally {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setIsStreaming(false);
      setStreamingMessage("");
      setStreamingTools([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getToolIcon = (toolName: string) => {
    if (toolName === 'write_file' || toolName === 'edit_file') return <FileCode className="h-3 w-3" />;
    if (toolName === 'run_shell') return <Terminal className="h-3 w-3" />;
    if (toolName === 'run_code') return <Play className="h-3 w-3" />;
    return <Wrench className="h-3 w-3" />;
  };

  const getToolVariant = (toolName: string): "default" | "secondary" | "destructive" | "outline" => {
    if (toolName === 'write_file' || toolName === 'edit_file') return 'default';
    if (toolName === 'run_shell') return 'secondary';
    return 'outline';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 pb-32 md:pb-6">
        {messages && messages.length === 0 && !streamingMessage ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto px-4">
            <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-4 animate-in fade-in zoom-in duration-300">
              <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2">Start Building with AI</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Tell the AI what app you want to build.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              <Badge variant="secondary" className="text-xs py-2 justify-center hover:bg-secondary/80 transition-colors">
                <FileCode className="h-3 w-3 mr-1" />
                Create files
              </Badge>
              <Badge variant="secondary" className="text-xs py-2 justify-center hover:bg-secondary/80 transition-colors">
                <Play className="h-3 w-3 mr-1" />
                Run code
              </Badge>
              <Badge variant="secondary" className="text-xs py-2 justify-center hover:bg-secondary/80 transition-colors">
                <Terminal className="h-3 w-3 mr-1" />
                Execute commands
              </Badge>
              <Badge variant="secondary" className="text-xs py-2 justify-center hover:bg-secondary/80 transition-colors">
                <Sparkles className="h-3 w-3 mr-1" />
                Search web
              </Badge>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages?.map((message) => {
              const isUser = message.role === "user";
              const toolCalls = message.toolCalls as ToolCall[] | null;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 sm:gap-4 max-w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                    isUser ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.role}`}
                >
                  {!isUser && (
                    <div className="flex items-start shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "flex-1 space-y-2 min-w-0 max-w-full",
                    isUser && "flex flex-col items-end"
                  )}>
                    <Card className={cn(
                      "p-3 sm:p-4 overflow-hidden max-w-full shadow-sm hover:shadow-md transition-shadow",
                      isUser ? "bg-primary text-primary-foreground" : "bg-card"
                    )}>
                      <div className="max-w-full overflow-hidden">
                        <MessageContent content={message.content} />
                      </div>
                    </Card>
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {toolCalls.map((tool, idx) => (
                          <Badge 
                            key={idx} 
                            variant={getToolVariant(tool.name)} 
                            className="gap-1.5 text-[10px] sm:text-xs py-1 px-2"
                          >
                            {getToolIcon(tool.name)}
                            <span className="truncate max-w-[120px] sm:max-w-none">{tool.summary || tool.name}</span>
                            <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-chart-2" />
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] sm:text-xs text-muted-foreground px-1">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {isUser && (
                    <div className="flex items-start shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-muted">
                        <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Streaming Message */}
            {isStreaming && (
              <div className="flex gap-2 sm:gap-4 justify-start max-w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-2 min-w-0 max-w-full">
                  <Card className="p-3 sm:p-4 bg-card overflow-hidden max-w-full shadow-sm">
                    <div className="max-w-full overflow-hidden">
                      {streamingMessage ? (
                        <MessageContent content={streamingMessage} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">AI is thinking...</span>
                        </div>
                      )}
                    </div>
                  </Card>
                  {streamingTools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {streamingTools.map((tool, idx) => (
                        <Badge 
                          key={idx} 
                          variant={getToolVariant(tool.name)} 
                          className="gap-1.5 text-[10px] sm:text-xs py-1 px-2 animate-in fade-in zoom-in duration-200"
                        >
                          {getToolIcon(tool.name)}
                          <span className="truncate max-w-[120px] sm:max-w-none">{tool.summary || tool.name}</span>
                          <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-chart-2" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
        <div className="max-w-4xl mx-auto flex gap-2 sm:gap-3">
          <Textarea
            ref={textareaRef}
            placeholder="Describe what you want to build..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
            className="min-h-[44px] max-h-32 resize-none text-sm sm:text-base"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-11 w-11 shrink-0 shadow-md hover:shadow-lg transition-shadow"
            data-testid="button-send-message"
          >
            {isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

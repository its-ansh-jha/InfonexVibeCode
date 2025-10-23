import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Send, Bot, User as UserIcon, Loader2, Wrench, FileCode, Terminal, Play } from "lucide-react";
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

export default function ChatPage() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamingTools, setStreamingTools] = useState<ToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", projectId],
    enabled: !!projectId,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input;
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");
    setStreamingTools([]);

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
            }
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    } finally {
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-6 pb-40 md:pb-6">
        {messages && messages.length === 0 && !streamingMessage ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Start Building with AI</h3>
            <p className="text-muted-foreground mb-6">
              Tell the AI what app you want to build. Files are stored in S3 and run in E2B sandbox.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="text-xs">Create files</Badge>
              <Badge variant="secondary" className="text-xs">Run code</Badge>
              <Badge variant="secondary" className="text-xs">Execute commands</Badge>
              <Badge variant="secondary" className="text-xs">Search web</Badge>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages?.map((message) => {
              const isUser = message.role === "user";
              const toolCalls = message.toolCalls as ToolCall[] | null;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-4 max-w-full",
                    isUser ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.role}`}
                >
                  {!isUser && (
                    <div className="flex items-start">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "flex-1 space-y-2 min-w-0",
                    isUser && "flex flex-col items-end"
                  )}>
                    <Card className={cn(
                      "p-4 overflow-hidden max-w-full",
                      isUser ? "bg-primary text-primary-foreground" : "bg-card"
                    )}>
                      <p className="whitespace-pre-wrap break-words word-break-break-word overflow-wrap-anywhere max-w-full">{message.content}</p>
                    </Card>
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {toolCalls.map((tool, idx) => (
                          <Badge key={idx} variant="outline" className="gap-1.5">
                            {getToolIcon(tool.name)}
                            <span className="text-xs">{tool.summary || tool.name}</span>
                            <span className="text-chart-2">✓</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {isUser && (
                    <div className="flex items-start">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                        <UserIcon className="h-5 w-5" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Streaming Message */}
            {isStreaming && (
              <div className="flex gap-4 justify-start max-w-full">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <Card className="p-4 bg-card overflow-hidden max-w-full">
                    {streamingMessage ? (
                      <p className="whitespace-pre-wrap break-words word-break-break-word overflow-wrap-anywhere max-w-full">{streamingMessage}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground">AI is thinking...</span>
                      </div>
                    )}
                  </Card>
                  {streamingTools.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {streamingTools.map((tool, idx) => (
                        <Badge key={idx} variant="outline" className="gap-1.5">
                          {getToolIcon(tool.name)}
                          <span className="text-xs">{tool.summary || tool.name}</span>
                          <span className="text-chart-2">✓</span>
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
      <div className="border-t border-border bg-card p-4 md:p-6 pb-20 md:pb-6">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Textarea
            placeholder="Describe the app you want to build..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
            className="min-h-[44px] max-h-32 resize-none"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-11 w-11 shrink-0"
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

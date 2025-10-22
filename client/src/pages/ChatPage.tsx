import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Send, Bot, User as UserIcon, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ToolCall {
  name: string;
  summary?: string;
  status: string;
}

export default function ChatPage() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", projectId],
    enabled: !!projectId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", "/api/messages", {
        projectId,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", projectId] });
      setInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-40 md:pb-6">
        {messages && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Start chatting with AI</h3>
            <p className="text-muted-foreground mb-6">
              Ask the AI to create, edit, or debug code. It can write files, search the web, and more.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="text-xs font-mono">write_file</Badge>
              <Badge variant="secondary" className="text-xs font-mono">edit_file</Badge>
              <Badge variant="secondary" className="text-xs font-mono">web_search</Badge>
              <Badge variant="secondary" className="text-xs font-mono">run_app</Badge>
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
                    "flex gap-4",
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
                    "flex-1 max-w-3xl space-y-2",
                    isUser && "flex flex-col items-end"
                  )}>
                    <Card className={cn(
                      "p-4",
                      isUser ? "bg-primary text-primary-foreground" : "bg-card"
                    )}>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </Card>
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {toolCalls.map((tool, idx) => (
                          <Badge key={idx} variant="outline" className="gap-1.5">
                            <Wrench className="h-3 w-3" />
                            <span className="text-xs">{tool.summary || tool.name}</span>
                            {tool.status === "success" && (
                              <span className="text-chart-2">✓</span>
                            )}
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
            {sendMutation.isPending && (
              <div className="flex gap-4 justify-start">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <Card className="p-4 bg-card">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground">AI is thinking...</span>
                  </div>
                </Card>
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
            placeholder="Ask AI to write, edit, or debug code..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
            className="min-h-[44px] max-h-32 resize-none"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            size="icon"
            className="h-11 w-11 shrink-0"
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? (
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

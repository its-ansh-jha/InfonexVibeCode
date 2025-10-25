import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Send, Bot, User as UserIcon, Loader2, Wrench, FileCode, Terminal, Play, Copy, Check, Sparkles, Image as ImageIcon, X, MessageSquare } from "lucide-react";
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
import { ActionSteps } from "@/components/ActionSteps";

interface ToolCall {
  name: string;
  summary?: string;
  arguments?: any;
  result?: any;
  status?: 'in_progress' | 'completed';
}

interface Action {
  description: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'error';
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
  // Remove tool call patterns with JSON: [tool:name]{...}
  let cleanedContent = content.replace(/\[tool:\w+\]\{[^]*?\}(?=\s*(?:\[tool:|\[action:|$))/g, '');
  
  // Remove standalone tool call patterns without JSON: [tool:name] (including partial ones)
  cleanedContent = cleanedContent.replace(/\[tool:[^\]]*\]/g, '');
  
  // Remove JSON objects with proper brace matching (handles nested structures)
  let depth = 0;
  let inString = false;
  let escape = false;
  let result = '';
  let jsonStart = -1;
  
  for (let i = 0; i < cleanedContent.length; i++) {
    const char = cleanedContent[i];
    const prevChar = i > 0 ? cleanedContent[i - 1] : '';
    
    // Handle string escaping
    if (char === '"' && !escape) {
      inString = !inString;
    }
    escape = char === '\\' && !escape;
    
    if (!inString) {
      if (char === '{') {
        if (depth === 0) jsonStart = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && jsonStart !== -1) {
          // Check if this looks like a JSON object with common tool properties
          const jsonCandidate = cleanedContent.substring(jsonStart, i + 1);
          if (/(?:content|path|code|command|name|language|query|arguments)/.test(jsonCandidate)) {
            // Skip this JSON block
            jsonStart = -1;
            continue;
          }
          jsonStart = -1;
        }
      }
    }
    
    // Only add character if we're not inside a JSON block
    if (depth === 0 && jsonStart === -1) {
      result += char;
    }
  }
  
  cleanedContent = result;
  
  // Remove any remaining partial JSON patterns
  cleanedContent = cleanedContent.replace(/\{[\s\S]*?(?:content|path|code|command|name|language|query)[\s\S]*?\}/g, '');
  
  // Remove standalone curly braces and brackets
  cleanedContent = cleanedContent.replace(/^\s*[\{\}\[\]]+\s*$/gm, '');
  
  // Clean up extra whitespace and newlines
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();
  
  // If the content is just JSON/code artifacts, return nothing
  if (!cleanedContent || /^\s*[\{\}\[\]",:]*\s*$/.test(cleanedContent)) {
    return null;
  }
  
  // Parse content into parts: text, code blocks, and actions
  const parts: Array<{ type: 'text' | 'code' | 'action' | 'actions'; content: string; language?: string; actions?: Action[] }> = [];
  
  // Split by lines to detect action lists
  const lines = cleanedContent.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for code block start
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3) || 'code';
      let codeContent = '';
      i++;
      
      // Collect code until closing ```
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += lines[i] + '\n';
        i++;
      }
      
      if (codeContent.trim()) {
        parts.push({
          type: 'code',
          content: codeContent.trim(),
          language
        });
      }
      i++; // Skip closing ```
      continue;
    }
    
    // Check for single action pattern [action:...]
    const actionMatch = line.match(/^\[action:([^\]]+)\]$/);
    if (actionMatch) {
      parts.push({
        type: 'action',
        content: actionMatch[1].trim()
      });
      i++;
      continue;
    }
    
    // Check for action list patterns (Created/Ran/Started/Creating/Installing/etc.)
    const actionListMatch = line.match(/^(Creating|Installing|Starting|Created|Ran shell:|Started:|Edited|Installed|Configured)\s+(.+)$/);
    if (actionListMatch) {
      const actionsList: Action[] = [];
      
      // Collect consecutive action lines
      while (i < lines.length) {
        const currentLine = lines[i];
        const match = currentLine.match(/^(Creating|Installing|Starting|Created|Ran shell:|Started:|Edited|Installed|Configured)\s+(.+)$/);
        
        if (match) {
          const prefix = match[1];
          const detail = match[2].trim();
          
          let description = '';
          let status: 'completed' | 'in_progress' = 'completed';
          
          // "Creating", "Installing", "Starting" are in-progress actions
          if (prefix === 'Creating' || prefix === 'Installing' || prefix === 'Starting') {
            status = 'in_progress';
            description = `${prefix} ${detail}`;
          } else if (prefix === 'Ran shell:') {
            description = `Ran shell command ${detail}`;
          } else if (prefix === 'Started:') {
            description = `Started ${detail}`;
          } else {
            description = `${prefix} ${detail}`;
          }
          
          actionsList.push({
            description,
            status
          });
          i++;
        } else {
          break;
        }
      }
      
      if (actionsList.length > 0) {
        parts.push({
          type: 'actions',
          content: '',
          actions: actionsList
        });
      }
      continue;
    }
    
    // Regular text line - collect consecutive text lines
    let textContent = line;
    i++;
    
    while (i < lines.length) {
      const nextLine = lines[i];
      
      // Stop if we hit a code block, action, or action list
      if (nextLine.trim().startsWith('```') || 
          nextLine.match(/^\[action:([^\]]+)\]$/) ||
          nextLine.match(/^(Created|Ran shell:|Started:|Edited|Installed|Configured)\s+(.+)$/)) {
        break;
      }
      
      textContent += '\n' + nextLine;
      i++;
    }
    
    const trimmedText = textContent.trim();
    if (trimmedText) {
      parts.push({
        type: 'text',
        content: trimmedText
      });
    }
  }

  // If no parts found, return the cleaned content
  if (parts.length === 0) {
    if (!cleanedContent) return null;
    return <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm sm:text-base">{cleanedContent}</p>;
  }

  return (
    <div className="space-y-2 max-w-full overflow-hidden">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return <CodeBlock key={idx} code={part.content} language={part.language} />;
        } else if (part.type === 'action') {
          return (
            <div key={idx} className="my-1">
              <ActionSteps actions={[{ description: part.content, status: 'completed' }]} />
            </div>
          );
        } else if (part.type === 'actions' && part.actions) {
          return (
            <div key={idx} className="my-1">
              <ActionSteps actions={part.actions} />
            </div>
          );
        } else {
          return <p key={idx} className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm sm:text-base">{part.content}</p>;
        }
      })}
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
  const [streamingActions, setStreamingActions] = useState<Action[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!input.trim() && selectedImages.length === 0) || isStreaming) return;
    
    const userMessage = input;
    const imagesToUpload = selectedImages;
    setInput("");
    setSelectedImages([]);
    setIsStreaming(true);
    setStreamingMessage("");
    setStreamingTools([]);
    setStreamingActions([]);

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
      
      // Upload images if any
      let attachments: string[] = [];
      if (imagesToUpload.length > 0) {
        for (const image of imagesToUpload) {
          const formData = new FormData();
          formData.append('file', image);
          formData.append('projectId', projectId!);
          
          const uploadResponse = await fetch("/api/upload/image", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${idToken}`,
            },
            body: formData,
          });
          
          if (uploadResponse.ok) {
            const { url } = await uploadResponse.json();
            attachments.push(url);
          }
        }
      }
      
      const response = await fetch("/api/messages/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          projectId,
          content: userMessage || "(Image uploaded)",
          attachments: attachments.length > 0 ? attachments : undefined,
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
      const actions: Action[] = [];

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
            } else if (data.type === 'action') {
              const action: Action = data.action;
              actions.push(action);
              setStreamingActions([...actions]);
            } else if (data.type === 'actions_completed') {
              // Update all actions to completed status
              const completedActions: Action[] = data.actions;
              setStreamingActions(completedActions);
            } else if (data.type === 'tool_start') {
              const toolCall: ToolCall = {
                name: data.name,
                summary: data.summary,
                status: 'in_progress',
              };
              tools.push(toolCall);
              setStreamingTools([...tools]);
            } else if (data.type === 'tool_complete') {
              // Find the in-progress tool and mark it as completed
              const toolIndex = tools.findIndex(t => t.name === data.name && t.status === 'in_progress');
              if (toolIndex !== -1) {
                tools[toolIndex].status = 'completed';
                tools[toolIndex].result = data.result;
              } else {
                // If not found, add it as completed (fallback)
                tools.push({
                  name: data.name,
                  summary: data.summary,
                  result: data.result,
                  status: 'completed',
                });
              }
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
      setStreamingActions([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedImages(prev => [...prev, ...imageFiles].slice(0, 5)); // Limit to 5 images
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const getToolIcon = (toolName: string) => {
    if (toolName === 'create_boilerplate') return <Sparkles className="h-3 w-3" />;
    if (toolName === 'write_file' || toolName === 'edit_file') return <FileCode className="h-3 w-3" />;
    if (toolName === 'run_shell') return <Terminal className="h-3 w-3" />;
    if (toolName === 'run_code') return <Play className="h-3 w-3" />;
    return <Wrench className="h-3 w-3" />;
  };

  const getToolVariant = (toolName: string): "default" | "secondary" | "destructive" | "outline" => {
    if (toolName === 'create_boilerplate') return 'default';
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
    <div className="flex flex-col h-full overflow-hidden bg-background dark:bg-background">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 pb-32 md:pb-6">
        {messages && messages.length === 0 && !streamingMessage ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto px-4">
            <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-muted/50 dark:bg-muted/30 mb-6 animate-in fade-in zoom-in duration-300">
              <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold mb-3 text-foreground dark:text-foreground">
              New chat with Agent
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground dark:text-muted-foreground">
              Agent can make changes, review its work, and debug itself automatically.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages?.map((message) => {
              const isUser = message.role === "user";
              const toolCalls = message.toolCalls as ToolCall[] | null;
              const actions = message.actions as Action[] | null;
              const attachments = message.attachments as string[] | null;

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
                      <div className="max-w-full overflow-hidden space-y-2">
                        {attachments && attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attachments.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Attachment ${idx + 1}`}
                                className="max-w-xs rounded border border-border"
                              />
                            ))}
                          </div>
                        )}
                        <MessageContent content={message.content} />
                      </div>
                    </Card>
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {toolCalls.map((tool, idx) => {
                          const isLongRunning = tool.name === 'run_shell' && 
                            (tool.summary?.includes('npm run dev') || 
                             tool.summary?.includes('npm start') ||
                             tool.summary?.includes('Started:'));
                          const showLoading = tool.status === 'in_progress' && !isLongRunning;
                          
                          return (
                            <Badge 
                              key={idx} 
                              variant={getToolVariant(tool.name)} 
                              className="gap-1.5 text-[10px] sm:text-xs py-1 px-2"
                            >
                              {getToolIcon(tool.name)}
                              <span className="truncate max-w-[120px] sm:max-w-none">{tool.summary || tool.name}</span>
                              {showLoading ? (
                                <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500 animate-spin" />
                              ) : (
                                <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-chart-2" />
                              )}
                            </Badge>
                          );
                        })}
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
      <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden">
            {/* Selected images preview */}
            {selectedImages.length > 0 && (
              <div className="p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedImages.length} {selectedImages.length === 1 ? 'image' : 'images'} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="h-20 w-20 rounded-lg overflow-hidden border-2 border-border bg-muted">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Upload ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                        title="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {selectedImages.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming}
                      className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/50 hover:bg-muted transition-colors flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Add more images"
                    >
                      <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex gap-2 p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || selectedImages.length >= 5}
                className="h-10 w-10 shrink-0 hover:bg-muted"
                title={selectedImages.length >= 5 ? "Maximum 5 images allowed" : "Upload images (max 5)"}
                data-testid="button-upload-image"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Textarea
                ref={textareaRef}
                placeholder="Make, test, iterate..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                rows={1}
                className="min-h-[40px] max-h-32 resize-none text-sm sm:text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none bg-transparent"
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && selectedImages.length === 0) || isStreaming}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-lg"
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
      </div>
    </div>
  );
}

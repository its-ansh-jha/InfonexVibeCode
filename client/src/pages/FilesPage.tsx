import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { FileText, Folder, Loader2, Code2, File as FileIcon, Download, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { File } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";

export default function FilesPage() {
  const { id: projectId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: files, isLoading } = useQuery<File[]>({
    queryKey: ["/api/files", projectId],
    enabled: !!projectId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const handleDownloadAll = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/files/${projectId}/download`, {
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download files");
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.projectName || 'project'}-source.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: "All files are being downloaded",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download files",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext || '')) {
      return <Code2 className="h-4 w-4 text-blue-500" />;
    }
    if (['html', 'css'].includes(ext || '')) {
      return <FileText className="h-4 w-4 text-orange-500" />;
    }
    if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) {
      return <FileIcon className="h-4 w-4 text-yellow-500" />;
    }
    if (path.includes('/')) {
      return <Folder className="h-4 w-4 text-muted-foreground" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredFiles = files?.filter(file => 
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold truncate">Files</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Stored in S3 and synced with E2B sandbox
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0">
            {files?.length || 0} files
          </Badge>
          {files && files.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              className="shrink-0"
              title="Download all files"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {files && files.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-files"
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Folder className="h-5 w-5" />
            Project Files
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Files are automatically saved when the AI creates or edits them
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFiles && filteredFiles.length > 0 ? (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-muted transition-colors border border-border",
                    "active:bg-muted/80 cursor-pointer"
                  )}
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    {getFileIcon(file.path)}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs sm:text-sm truncate">{file.path}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        {formatFileSize(file.size)} • {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs px-1.5 sm:px-2">
                    {file.path.split('.').pop()?.toUpperCase() || 'FILE'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted mb-3 sm:mb-4">
                <Search className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">No files found</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                No files match your search "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted mb-3 sm:mb-4">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">No files yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                Start chatting with the AI to create files for your project. They'll appear here automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

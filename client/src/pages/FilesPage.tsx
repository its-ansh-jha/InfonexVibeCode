import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { FileText, Folder, Loader2, Code2, File as FileIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { File } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function FilesPage() {
  const { id: projectId } = useParams();

  const { data: files, isLoading } = useQuery<File[]>({
    queryKey: ["/api/files", projectId],
    enabled: !!projectId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  return (
    <div className="p-6 md:p-8 space-y-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Files</h1>
          <p className="text-muted-foreground mt-1">
            Project files stored in S3 and synced with E2B sandbox
          </p>
        </div>
        <Badge variant="outline">
          {files?.length || 0} files
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Project Files
          </CardTitle>
          <CardDescription>
            Files are automatically saved when the AI creates or edits them
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files && files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors border border-border"
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.path)}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm truncate">{file.path}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {file.path.split('.').pop()?.toUpperCase() || 'FILE'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No files yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Start chatting with the AI to create files for your project. They'll appear here automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

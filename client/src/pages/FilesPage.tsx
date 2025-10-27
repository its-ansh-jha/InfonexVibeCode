import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { FileText, Folder, Loader2, Code2, File as FileIcon, Download, Search, Edit, Trash2, FileType, ArrowLeft, Save } from "lucide-react";
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
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function FilesPage() {
  const { id: projectId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [deleteFile, setDeleteFile] = useState<File | null>(null);
  const [renameFile, setRenameFile] = useState<File | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const { toast } = useToast();

  const { data: files, isLoading } = useQuery<File[]>({
    queryKey: ["/api/files", projectId],
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", projectId] });
      toast({
        title: "File deleted",
        description: "File has been deleted from S3 and E2B sandbox",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ fileId, newPath }: { fileId: string; newPath: string }) => {
      const response = await apiRequest("PATCH", `/api/files/${fileId}/rename`, { newPath });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", projectId] });
      toast({
        title: "File renamed",
        description: "File has been renamed in S3 and E2B sandbox",
      });
      setRenameFile(null);
      setNewFileName("");
    },
    onError: (error: any) => {
      toast({
        title: "Rename failed",
        description: error.message || "Failed to rename file",
        variant: "destructive",
      });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/files/${fileId}/content`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to save file" }));
        throw new Error(error.error || "Failed to save file");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", projectId] });
      toast({
        title: "File saved",
        description: "File has been saved to S3 and E2B sandbox",
      });
      setEditingFile(null);
      setFileContent("");
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save file",
        variant: "destructive",
      });
    },
  });

  const handleEdit = async (file: File) => {
    setIsLoadingContent(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/files/${projectId}/${file.id}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load file content");
      }

      const data = await response.json();
      setFileContent(data.content);
      setEditingFile(file);
    } catch (error: any) {
      toast({
        title: "Load failed",
        description: error.message || "Failed to load file content",
        variant: "destructive",
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleSave = () => {
    if (editingFile) {
      updateContentMutation.mutate({ fileId: editingFile.id, content: fileContent });
    }
  };

  const handleDelete = (file: File) => {
    setDeleteFile(file);
  };

  const confirmDelete = () => {
    if (deleteFile) {
      deleteMutation.mutate(deleteFile.id);
      setDeleteFile(null);
    }
  };

  const handleRename = (file: File) => {
    setRenameFile(file);
    setNewFileName(file.path);
  };

  const confirmRename = () => {
    if (renameFile && newFileName && newFileName !== renameFile.path) {
      renameMutation.mutate({ fileId: renameFile.id, newPath: newFileName });
    }
  };

  const handleDownloadAll = async () => {
    try {
      toast({
        title: "Preparing download",
        description: "Creating ZIP file...",
      });

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
      
      // Create a new ZIP file
      const zip = new JSZip();
      
      // Add each file to the ZIP
      for (const [filePath, fileContent] of Object.entries(data.files)) {
        zip.file(filePath, fileContent as string);
      }
      
      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the ZIP file
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.projectName || 'project'}-source.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download complete",
        description: `Downloaded ${data.filesCount} files as ZIP`,
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

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sh': 'shell',
      'bash': 'shell',
    };
    return languageMap[ext || ''] || 'plaintext';
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

  if (editingFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingFile(null);
                setFileContent("");
              }}
              data-testid="button-back-editor"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              {getFileIcon(editingFile.path)}
              <span className="font-mono text-sm">{editingFile.path}</span>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={updateContentMutation.isPending}
            data-testid="button-save-file"
          >
            {updateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-auto" style={{ touchAction: 'pan-y' }}>
          {isLoadingContent ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Editor
              height="100%"
              language={getLanguageFromPath(editingFile.path)}
              value={fileContent}
              onChange={(value) => setFileContent(value || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                  useShadows: false,
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
                mouseWheelScrollSensitivity: 1,
                fastScrollSensitivity: 5,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 pb-28 md:pb-8">
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
              data-testid="button-download-all"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

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
            Files are automatically saved when the AI creates or edits them. You can also manually edit, rename, or delete files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFiles && filteredFiles.length > 0 ? (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-muted transition-colors border border-border"
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
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                      {file.path.split('.').pop()?.toUpperCase() || 'FILE'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(file)}
                      title="Edit file"
                      data-testid={`button-edit-${file.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRename(file)}
                      title="Rename file"
                      data-testid={`button-rename-${file.id}`}
                    >
                      <FileType className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file)}
                      title="Delete file"
                      data-testid={`button-delete-${file.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
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

      <AlertDialog open={!!deleteFile} onOpenChange={(open) => !open && setDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono font-semibold">{deleteFile?.path}</span>? This will remove it from S3 storage and E2B sandbox. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameFile} onOpenChange={(open) => !open && setRenameFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for the file. This will update it in S3 storage and E2B sandbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-filename">File path</Label>
              <Input
                id="new-filename"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="src/App.tsx"
                data-testid="input-new-filename"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFile(null)} data-testid="button-cancel-rename">
              Cancel
            </Button>
            <Button
              onClick={confirmRename}
              disabled={!newFileName || newFileName === renameFile?.path || renameMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                "Rename"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

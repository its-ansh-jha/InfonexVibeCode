import { MessageSquare, FolderGit2, Monitor, Terminal } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { title: "Preview", url: "/preview", icon: Monitor },
  { title: "Agent", url: "/chat", icon: MessageSquare },
  { title: "Files", url: "/files", icon: FolderGit2 },
  { title: "Terminal", url: "/terminal", icon: Terminal },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const pathParts = location.split("/");
  const currentProjectId = pathParts[1] === "project" ? pathParts[2] : null;
  
  // Only show navigation when inside a project
  if (!currentProjectId) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card dark:bg-card border-t border-border dark:border-border z-50 backdrop-blur-lg bg-opacity-95">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const fullUrl = item.url ? `/project/${currentProjectId}${item.url}` : '';
          const isActive = location === fullUrl;

          return (
            <button
              key={item.title}
              onClick={() => setLocation(fullUrl)}
              className={cn(
                "flex flex-col items-center gap-1.5 flex-1 py-2 transition-all rounded-lg",
                isActive && "bg-muted/50",
                !isActive && "text-muted-foreground hover:text-foreground",
                item.title === "Agent" && "text-purple-600 dark:text-purple-500"
              )}
              data-testid={`mobile-nav-${item.title.toLowerCase()}`}
            >
              <item.icon className="h-6 w-6" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

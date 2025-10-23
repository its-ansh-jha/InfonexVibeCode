import { MessageSquare, FolderGit2, Play, FolderOpen } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Files", url: "/files", icon: FolderGit2 },
  { title: "Preview", url: "/preview", icon: Play },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const currentProjectId = location.split("/")[2];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-16">
        {mobileNavItems.map((item) => {
          const isProjectRoute = item.url !== "/projects";
          const fullUrl = isProjectRoute && currentProjectId 
            ? `/project/${currentProjectId}${item.url}` 
            : item.url;
          const isActive = location === fullUrl;
          const isDisabled = isProjectRoute && !currentProjectId;

          return (
            <button
              key={item.title}
              onClick={() => !isDisabled && setLocation(fullUrl)}
              disabled={isDisabled}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-2 hover-elevate active-elevate-2 transition-colors",
                isActive && "text-primary",
                !isActive && "text-muted-foreground",
                isDisabled && "opacity-40 cursor-not-allowed"
              )}
              data-testid={`mobile-nav-${item.title.toLowerCase()}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

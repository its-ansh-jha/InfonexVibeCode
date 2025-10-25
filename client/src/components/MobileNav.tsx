import { MessageSquare, FolderGit2, Monitor, FolderOpen } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Agent", url: "/chat", icon: MessageSquare, color: "text-purple-500" },
  { title: "Files", url: "/files", icon: FolderGit2 },
  { title: "Preview", url: "/preview", icon: Monitor },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const currentProjectId = location.split("/")[2];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card dark:bg-card border-t border-border dark:border-border z-50 backdrop-blur-lg bg-opacity-95">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const isProjectRoute = item.url !== "/projects";
          const fullUrl = isProjectRoute && currentProjectId 
            ? `/project/${currentProjectId}${item.url}` 
            : item.url;
          const isActive = location === fullUrl;
          const isDisabled = isProjectRoute && !currentProjectId;
          const iconColor = item.color || "";

          return (
            <button
              key={item.title}
              onClick={() => !isDisabled && setLocation(fullUrl)}
              disabled={isDisabled}
              className={cn(
                "flex flex-col items-center gap-1.5 flex-1 py-2 transition-all rounded-lg",
                isActive && "bg-muted/50",
                !isActive && "text-muted-foreground hover:text-foreground",
                isDisabled && "opacity-40 cursor-not-allowed",
                item.title === "Run" && "text-green-600 dark:text-green-500",
                item.title === "Agent" && "text-purple-600 dark:text-purple-500"
              )}
              data-testid={`mobile-nav-${item.title.toLowerCase()}`}
            >
              <item.icon className={cn("h-6 w-6", iconColor)} />
              <span className="text-[10px] font-medium">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

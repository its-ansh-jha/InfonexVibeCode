import { 
  Check, 
  Loader2, 
  Package, 
  FileCode, 
  Terminal, 
  Globe,
  Play,
  Settings,
  Sparkles
} from "lucide-react";

interface Action {
  description: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface ActionStepsProps {
  actions: Action[];
  className?: string;
}

export function ActionSteps({ actions, className = "" }: ActionStepsProps) {
  if (!actions || actions.length === 0) return null;

  const getActionIcon = (description: string, status?: string) => {
    const desc = description.toLowerCase();
    
    if (status === 'completed') {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    
    if (status === 'in_progress') {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    
    if (desc.includes('install') || desc.includes('dependencies')) {
      return <Package className="h-4 w-4 text-blue-500" />;
    }
    if (desc.includes('opened') || desc.includes('reading') || desc.includes('file')) {
      return <FileCode className="h-4 w-4 text-purple-500" />;
    }
    if (desc.includes('executed') || desc.includes('ran') || desc.includes('shell') || desc.includes('command')) {
      return <Terminal className="h-4 w-4 text-orange-500" />;
    }
    if (desc.includes('configured') || desc.includes('setup') || desc.includes('setting')) {
      return <Settings className="h-4 w-4 text-cyan-500" />;
    }
    if (desc.includes('server') || desc.includes('starting')) {
      return <Play className="h-4 w-4 text-green-500" />;
    }
    if (desc.includes('integrating') || desc.includes('integration')) {
      return <Globe className="h-4 w-4 text-indigo-500" />;
    }
    
    return <Sparkles className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className={`space-y-1 ${className}`} data-testid="action-steps-container">
      {actions.map((action, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400"
          data-testid={`action-step-${index}`}
        >
          {getActionIcon(action.description, action.status)}
          <span className="leading-tight">{action.description}</span>
        </div>
      ))}
    </div>
  );
}

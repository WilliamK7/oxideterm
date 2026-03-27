import React from 'react';
import { ChevronRight, Home, HardDrive, Server } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PathBreadcrumbProps {
  path: string;
  isRemote: boolean;
  onNavigate: (path: string) => void;
  className?: string;
}

// Parse path into segments
const parsePathSegments = (path: string, isRemote: boolean): { name: string; fullPath: string }[] => {
  const segments: { name: string; fullPath: string }[] = [];
  
  // Normalize path
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  
  // Handle root
  if (isRemote) {
    // Remote paths always start with /
    segments.push({ name: '/', fullPath: '/' });
  } else {
    // Local paths - handle Windows drives
    const windowsDriveMatch = normalizedPath.match(/^([A-Za-z]:)/);
    if (windowsDriveMatch) {
      // Windows: C:/ or D:/
      segments.push({ name: windowsDriveMatch[1], fullPath: windowsDriveMatch[1] + '/' });
    } else if (normalizedPath.startsWith('/')) {
      // Unix root
      segments.push({ name: '/', fullPath: '/' });
    }
  }
  
  // Split remaining path
  const pathWithoutRoot = normalizedPath
    .replace(/^[A-Za-z]:/, '') // Remove Windows drive
    .replace(/^\/+/, '');      // Remove leading slashes
  
  if (pathWithoutRoot) {
    const parts = pathWithoutRoot.split('/').filter(Boolean);
    let currentPath = segments.length > 0 ? segments[0].fullPath : '/';
    
    for (const part of parts) {
      currentPath = currentPath.endsWith('/') 
        ? `${currentPath}${part}` 
        : `${currentPath}/${part}`;
      segments.push({ name: part, fullPath: currentPath });
    }
  }
  
  return segments;
};

export const PathBreadcrumb: React.FC<PathBreadcrumbProps> = ({
  path,
  isRemote,
  onNavigate,
  className,
}) => {
  const segments = parsePathSegments(path, isRemote);
  
  // Get icon for root
  const RootIcon = isRemote ? Server : (path.match(/^[A-Za-z]:/) ? HardDrive : Home);
  
  return (
    <div className={cn(
      "flex items-center gap-0.5 text-sm overflow-x-auto scrollbar-thin scrollbar-thumb-theme-border",
      className
    )}>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-theme-text-muted flex-shrink-0" />
          )}
          <button
            onClick={() => onNavigate(segment.fullPath)}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-theme-bg-hover/50 transition-colors",
              "text-theme-text hover:text-white whitespace-nowrap",
              index === segments.length - 1 && "text-white font-medium bg-theme-bg-hover/30"
            )}
          >
            {index === 0 && <RootIcon className="h-3.5 w-3.5 text-theme-text-muted" />}
            <span className="max-w-[120px] truncate">{segment.name}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

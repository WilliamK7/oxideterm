// src/components/ide/IdeBreadcrumb.tsx
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, File } from 'lucide-react';
import { useIdeStore, useIdeActiveTab } from '../../store/ideStore';
import { cn } from '../../lib/utils';
import { FileIcon } from '../../lib/fileIcons';
import { listDir } from '../../lib/agentService';
import type { FileInfo } from '../../types';

/**
 * Breadcrumb path navigation for the IDE editor.
 * Shows the file path as clickable segments with sibling dropdown.
 */
export function IdeBreadcrumb() {
  const activeTab = useIdeActiveTab();
  const project = useIdeStore(s => s.project);
  const nodeId = useIdeStore(s => s.nodeId);

  // Parse path into segments relative to project root
  const segments = useMemo(() => {
    if (!activeTab || !project) return [];
    const relativePath = activeTab.path.startsWith(project.rootPath)
      ? activeTab.path.slice(project.rootPath.length).replace(/^\//, '')
      : activeTab.path;
    return relativePath.split('/').filter(Boolean);
  }, [activeTab, project]);

  if (!activeTab || segments.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 bg-theme-bg/40 border-b border-theme-border/30 text-xs text-theme-text-muted overflow-x-auto scrollbar-none">
      {/* Project root */}
      <span className="text-theme-text-muted/60 truncate max-w-[100px] flex-shrink-0">
        {project?.name}
      </span>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        // Build the full path up to this segment
        const fullPath = project!.rootPath + '/' + segments.slice(0, index + 1).join('/');
        const parentPath = index === 0
          ? project!.rootPath
          : project!.rootPath + '/' + segments.slice(0, index).join('/');

        return (
          <BreadcrumbSegment
            key={fullPath}
            name={segment}
            parentPath={parentPath}
            isLast={isLast}
            nodeId={nodeId}
          />
        );
      })}
    </div>
  );
}

// ─── Segment ───

interface BreadcrumbSegmentProps {
  name: string;
  parentPath: string;
  isLast: boolean;
  nodeId: string | null;
}

function BreadcrumbSegment({
  name,
  parentPath,
  isLast,
  nodeId,
}: BreadcrumbSegmentProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [siblings, setSiblings] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const openFile = useIdeStore(s => s.openFile);

  // Load siblings on dropdown open
  const handleClick = useCallback(async () => {
    if (!nodeId) return;
    setDropdownOpen(prev => !prev);
    if (!dropdownOpen && siblings.length === 0) {
      setLoading(true);
      try {
        const files = await listDir(nodeId, parentPath);
        // Sort: directories first, then alphabetical
        setSiblings(
          files.sort((a, b) => {
            const aDir = a.file_type === 'Directory';
            const bDir = b.file_type === 'Directory';
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          }),
        );
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
  }, [nodeId, parentPath, dropdownOpen, siblings.length]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        !buttonRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [dropdownOpen]);

  const handleSiblingClick = useCallback(
    async (item: FileInfo) => {
      setDropdownOpen(false);
      if (item.file_type !== 'Directory') {
        const itemPath = parentPath + '/' + item.name;
        try {
          await openFile(itemPath);
        } catch {
          // Silently fail
        }
      }
    },
    [parentPath, openFile],
  );

  return (
    <>
      <ChevronRight className="w-3 h-3 text-theme-text-muted/40 flex-shrink-0" />
      <div className="relative">
        <button
          ref={buttonRef}
          className={cn(
            'flex items-center gap-1 px-1 py-0.5 rounded hover:bg-theme-bg-hover/50 transition-colors',
            isLast ? 'text-theme-text' : 'text-theme-text-muted',
            dropdownOpen && 'bg-theme-bg-hover/50',
          )}
          onClick={handleClick}
        >
          {isLast && (
            <FileIcon filename={name} size={12} />
          )}
          <span className="truncate max-w-[120px]">{name}</span>
        </button>

        {/* Sibling dropdown */}
        {dropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 z-50 mt-0.5 bg-theme-bg-elevated border border-theme-border rounded-md shadow-xl py-1 min-w-[180px] max-h-[240px] overflow-y-auto"
          >
            {loading ? (
              <div className="px-3 py-2 text-xs text-theme-text-muted">Loading…</div>
            ) : siblings.length === 0 ? (
              <div className="px-3 py-2 text-xs text-theme-text-muted">Empty</div>
            ) : (
              siblings.map(item => {
                const isCurrent = item.name === name;
                return (
                  <button
                    key={item.name}
                    className={cn(
                      'w-full px-3 py-1 text-xs text-left flex items-center gap-2 hover:bg-theme-bg-hover',
                      isCurrent && 'bg-theme-bg-hover/50 text-theme-accent',
                    )}
                    onClick={() => handleSiblingClick(item)}
                  >
                    {item.file_type === 'Directory' ? (
                      <File className="w-3 h-3 opacity-50" />
                    ) : (
                      <FileIcon filename={item.name} size={12} />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

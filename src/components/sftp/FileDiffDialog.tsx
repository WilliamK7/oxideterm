import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { File, ArrowLeftRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  leftLineNum?: number;
  rightLineNum?: number;
}

interface FileDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  localFile: { path: string; content: string } | null;
  remoteFile: { path: string; content: string } | null;
}

// Simple diff algorithm (longest common subsequence based)
const computeDiff = (left: string, right: string): DiffLine[] => {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  
  // Build LCS table
  const m = leftLines.length;
  const n = rightLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftLines[i - 1] === rightLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find diff
  let i = m, j = n;
  const tempDiff: DiffLine[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      tempDiff.push({
        type: 'unchanged',
        content: leftLines[i - 1],
        leftLineNum: i,
        rightLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempDiff.push({
        type: 'added',
        content: rightLines[j - 1],
        rightLineNum: j,
      });
      j--;
    } else {
      tempDiff.push({
        type: 'removed',
        content: leftLines[i - 1],
        leftLineNum: i,
      });
      i--;
    }
  }
  
  return tempDiff.reverse();
};

// Get file name from path
const getFileName = (path: string): string => {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
};

export const FileDiffDialog: React.FC<FileDiffDialogProps> = ({
  isOpen,
  onClose,
  localFile,
  remoteFile,
}) => {
  const { t } = useTranslation();
  const diffLines = useMemo(() => {
    if (!localFile || !remoteFile) return [];
    return computeDiff(localFile.content, remoteFile.content);
  }, [localFile?.content, remoteFile?.content]);
  
  const stats = useMemo(() => {
    let added = 0, removed = 0, unchanged = 0;
    for (const line of diffLines) {
      if (line.type === 'added') added++;
      else if (line.type === 'removed') removed++;
      else unchanged++;
    }
    return { added, removed, unchanged };
  }, [diffLines]);
  
  if (!localFile || !remoteFile) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0" aria-describedby="diff-desc">
        <DialogHeader className="px-4 py-3 border-b border-theme-border bg-theme-bg-panel">
          <DialogTitle className="text-sm flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-theme-accent" />
            {t('sftp.diff.title')}
          </DialogTitle>
          <DialogDescription id="diff-desc" className="text-xs text-theme-text-muted">
            {t('sftp.diff.description')}
          </DialogDescription>
        </DialogHeader>
        
        {/* File headers */}
        <div className="flex border-b border-theme-border text-xs">
          <div className="flex-1 px-3 py-2 bg-red-950/20 border-r border-theme-border flex items-center gap-2">
            <File className="h-3 w-3 text-red-400" />
            <span className="text-red-300 font-medium">{t('sftp.diff.local')}:</span>
            <span className="text-theme-text-muted truncate">{getFileName(localFile.path)}</span>
            <span className="ml-auto text-red-400">-{stats.removed}</span>
          </div>
          <div className="flex-1 px-3 py-2 bg-green-950/20 flex items-center gap-2">
            <File className="h-3 w-3 text-green-400" />
            <span className="text-green-300 font-medium">{t('sftp.diff.remote')}:</span>
            <span className="text-theme-text-muted truncate">{getFileName(remoteFile.path)}</span>
            <span className="ml-auto text-green-400">+{stats.added}</span>
          </div>
        </div>
        
        {/* Diff content */}
        <div className="flex-1 overflow-auto font-mono text-xs">
          {diffLines.map((line, index) => (
            <div 
              key={index}
              className={cn(
                "flex border-b border-theme-border/50",
                line.type === 'added' && "bg-green-950/30",
                line.type === 'removed' && "bg-red-950/30"
              )}
            >
              {/* Left line number */}
              <div className={cn(
                "w-12 px-2 py-0.5 text-right text-theme-text-muted border-r border-theme-border select-none shrink-0",
                line.type === 'removed' && "bg-red-950/50 text-red-400"
              )}>
                {line.leftLineNum || ''}
              </div>
              
              {/* Left content */}
              <div className={cn(
                "flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto border-r border-theme-border",
                line.type === 'removed' && "bg-red-950/30 text-red-200",
                line.type === 'added' && "bg-theme-bg-panel/80 text-theme-text-muted",
                line.type === 'unchanged' && "text-theme-text-muted"
              )}>
                {line.type !== 'added' && (
                  <>
                    {line.type === 'removed' && <span className="text-red-500 mr-1">-</span>}
                    {line.content}
                  </>
                )}
              </div>
              
              {/* Right line number */}
              <div className={cn(
                "w-12 px-2 py-0.5 text-right text-theme-text-muted border-r border-theme-border select-none shrink-0",
                line.type === 'added' && "bg-green-950/50 text-green-400"
              )}>
                {line.rightLineNum || ''}
              </div>
              
              {/* Right content */}
              <div className={cn(
                "flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto",
                line.type === 'added' && "bg-green-950/30 text-green-200",
                line.type === 'removed' && "bg-theme-bg-panel/80 text-theme-text-muted",
                line.type === 'unchanged' && "text-theme-text-muted"
              )}>
                {line.type !== 'removed' && (
                  <>
                    {line.type === 'added' && <span className="text-green-500 mr-1">+</span>}
                    {line.content}
                  </>
                )}
              </div>
            </div>
          ))}
          
          {diffLines.length === 0 && (
            <div className="flex items-center justify-center h-full text-theme-text-muted">
              {t('sftp.diff.identical')}
            </div>
          )}
        </div>
        
        <DialogFooter className="px-4 py-2 border-t border-theme-border">
          <div className="flex-1 text-xs text-theme-text-muted">
            {t('sftp.diff.unchanged', { count: stats.unchanged })}, 
            <span className="text-green-400 ml-1">{t('sftp.diff.added', { count: stats.added })}</span>,
            <span className="text-red-400 ml-1">{t('sftp.diff.removed', { count: stats.removed })}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>{t('sftp.diff.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

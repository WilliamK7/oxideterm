import React, { useState } from 'react';
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
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { ArrowRight, File, Clock, HardDrive, AlertTriangle } from 'lucide-react';

export type ConflictResolution = 'skip' | 'overwrite' | 'rename' | 'skip-older' | 'cancel';

export interface ConflictInfo {
  fileName: string;
  sourceFile: {
    size: number;
    modified: number | null;
  };
  targetFile: {
    size: number;
    modified: number | null;
  };
  direction: 'upload' | 'download';
}

interface TransferConflictDialogProps {
  isOpen: boolean;
  conflicts: ConflictInfo[];
  currentIndex: number;
  onResolve: (resolution: ConflictResolution, applyToAll: boolean) => void;
  onCancel: () => void;
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// Format timestamp
const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

// Check which file is newer
const isSourceNewer = (source: { modified: number | null }, target: { modified: number | null }): boolean | null => {
  if (!source.modified || !target.modified) return null;
  return source.modified > target.modified;
};

export const TransferConflictDialog: React.FC<TransferConflictDialogProps> = ({
  isOpen,
  conflicts,
  currentIndex,
  onResolve,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [applyToAll, setApplyToAll] = useState(false);
  
  const conflict = conflicts[currentIndex];
  if (!conflict) return null;
  
  const { fileName, sourceFile, targetFile, direction } = conflict;
  const sourceNewer = isSourceNewer(sourceFile, targetFile);
  
  const sourceLabel = direction === 'upload' ? t('sftp.conflict.local_file') : t('sftp.conflict.remote_file');
  const targetLabel = direction === 'upload' ? t('sftp.conflict.remote_file') : t('sftp.conflict.local_file');
  
  const remaining = conflicts.length - currentIndex - 1;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg" aria-describedby="conflict-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('sftp.conflict.title')}
          </DialogTitle>
          <DialogDescription id="conflict-desc">
            {t('sftp.conflict.description')}
            {remaining > 0 && (
              <span className="ml-1 text-orange-400">
                {t('sftp.conflict.remaining', { count: remaining })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* File name */}
        <div className="px-3 py-2 bg-theme-bg-panel rounded-md border border-theme-border">
          <div className="flex items-center gap-2 text-sm font-medium">
            <File className="h-4 w-4 text-theme-text-muted" />
            {fileName}
          </div>
        </div>
        
        {/* Comparison */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          {/* Source */}
          <div className={`p-3 rounded-md border ${
            sourceNewer === true ? 'border-green-600 bg-green-950/30' : 'border-theme-border bg-theme-bg-panel'
          }`}>
            <div className="text-xs text-theme-text-muted mb-2 font-medium uppercase">
              {sourceLabel}
              {sourceNewer === true && (
                <span className="ml-2 text-green-400 normal-case">{t('sftp.conflict.newer')}</span>
              )}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-theme-text">
                <HardDrive className="h-3.5 w-3.5 text-theme-text-muted" />
                {formatFileSize(sourceFile.size)}
              </div>
              <div className="flex items-center gap-2 text-theme-text">
                <Clock className="h-3.5 w-3.5 text-theme-text-muted" />
                {formatDate(sourceFile.modified)}
              </div>
            </div>
          </div>
          
          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-theme-text-muted" />
          </div>
          
          {/* Target */}
          <div className={`p-3 rounded-md border ${
            sourceNewer === false ? 'border-green-600 bg-green-950/30' : 'border-theme-border bg-theme-bg-panel'
          }`}>
            <div className="text-xs text-theme-text-muted mb-2 font-medium uppercase">
              {targetLabel}
              {sourceNewer === false && (
                <span className="ml-2 text-green-400 normal-case">{t('sftp.conflict.newer')}</span>
              )}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-theme-text">
                <HardDrive className="h-3.5 w-3.5 text-theme-text-muted" />
                {formatFileSize(targetFile.size)}
              </div>
              <div className="flex items-center gap-2 text-theme-text">
                <Clock className="h-3.5 w-3.5 text-theme-text-muted" />
                {formatDate(targetFile.modified)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Apply to all checkbox */}
        {conflicts.length > 1 && (
          <div className="flex items-center gap-2 pt-2">
            <Checkbox 
              id="apply-all" 
              checked={applyToAll} 
              onCheckedChange={(checked) => setApplyToAll(!!checked)}
            />
            <Label htmlFor="apply-all" className="text-sm text-theme-text-muted cursor-pointer">
              {t('sftp.conflict.apply_all', { count: conflicts.length })}
            </Label>
          </div>
        )}
        
        <DialogFooter className="flex-wrap gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onResolve('skip', applyToAll)}
            >
              {t('sftp.conflict.skip')}
            </Button>
            {sourceNewer !== null && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onResolve('skip-older', applyToAll)}
                title="Only overwrite if source is newer"
              >
                {t('sftp.conflict.skip_older')}
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => onResolve('rename', applyToAll)}
            >
              {t('sftp.conflict.keep_both')}
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => onResolve('overwrite', applyToAll)}
            >
              {t('sftp.conflict.overwrite')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

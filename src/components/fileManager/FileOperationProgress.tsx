/**
 * FileOperationProgress
 * Shows a progress bar overlay at the bottom of the file manager during copy/paste operations.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Progress } from '../ui/progress';
import type { PasteProgress } from './hooks/useFileClipboard';

interface FileOperationProgressProps {
  progress: PasteProgress | null;
}

export const FileOperationProgress: React.FC<FileOperationProgressProps> = ({ progress }) => {
  const { t } = useTranslation();

  if (!progress || !progress.active) return null;

  const percent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 bg-theme-bg-elevated/95 backdrop-blur-sm border-t border-theme-border px-3 py-2 space-y-1">
      <div className="flex items-center justify-between text-xs text-theme-text-secondary">
        <span className="truncate max-w-[70%]">
          {progress.fileName
            ? t('fileManager.progressFile', { name: progress.fileName })
            : t('fileManager.progressPreparing')}
        </span>
        <span className="shrink-0 ml-2">
          {progress.current}/{progress.total} ({percent}%)
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  );
};

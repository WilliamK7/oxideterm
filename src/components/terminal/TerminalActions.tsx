/**
 * TerminalActions — floating action toolbar for terminal sessions
 *
 * Appears on hover at the top-right corner of the terminal.
 * Provides quick access to:
 *   - Start/stop session recording
 *   - Open .cast playback files
 * When recording is active, delegates to RecordingControls overlay.
 */

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, FilePlay } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { cn } from '../../lib/utils';
import { useRecordingStore } from '../../store/recordingStore';
import { RecordingControls } from './RecordingControls';

type TerminalActionsProps = {
  sessionId: string;
  /** Whether this session is currently recording */
  isRecording: boolean;
  /** Trigger recording start (needs cols/rows from terminal ref) */
  onStartRecording: () => void;
  /** Callback when the user stops recording (returns cast content) */
  onRecordingStop: (content: string) => void;
  /** Callback when the user discards the recording */
  onRecordingDiscard: () => void;
  /** Extra classes for position overrides (e.g. avoid split-pane close button) */
  className?: string;
};

export const TerminalActions: React.FC<TerminalActionsProps> = ({
  sessionId,
  isRecording,
  onStartRecording,
  onRecordingStop,
  onRecordingDiscard,
  className,
}) => {
  const { t } = useTranslation();
  const openPlayer = useRecordingStore(s => s.openPlayer);
  const toolbarRef = useRef<HTMLDivElement>(null);

  /** Open a .cast file from disk and launch the player */
  const handleOpenCast = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'Asciicast', extensions: ['cast'] }],
        multiple: false,
      });

      if (filePath) {
        const content = await readTextFile(filePath as string);
        const fileName = (filePath as string).split(/[/\\]/).pop() || 'recording.cast';
        openPlayer(fileName, content);
      }
    } catch (err) {
      console.error('[TerminalActions] Failed to open cast file:', err);
    }
  }, [openPlayer]);

  // When recording is active, show the full RecordingControls overlay
  if (isRecording) {
    return (
      <RecordingControls
        sessionId={sessionId}
        onStop={onRecordingStop}
        onDiscard={onRecordingDiscard}
      />
    );
  }

  // When idle, show a compact hover toolbar with record + open buttons
  return (
    <div
      ref={toolbarRef}
      className={cn(
        'absolute top-2 right-2 z-20',
        'flex items-center gap-0.5',
        'bg-theme-bg-panel/80 backdrop-blur-sm border border-theme-border/50',
        'rounded-lg px-1.5 py-1 shadow-lg',
        'select-none pointer-events-auto',
        'opacity-0 transition-opacity duration-200',
        'group-hover/terminal:opacity-60 hover:!opacity-100',
        className,
      )}
    >
      {/* Start Recording */}
      <button
        onClick={onStartRecording}
        className={cn(
          'p-1 rounded-md transition-colors',
          'text-theme-text-muted hover:text-red-400 hover:bg-theme-bg-hover/60',
        )}
        title={`${t('terminal.recording.start')}  ⌘⇧R`}
      >
        <Circle className="h-3.5 w-3.5" />
      </button>

      {/* Separator */}
      <div className="w-px h-3.5 bg-theme-text-muted/40 mx-0.5" />

      {/* Open Cast File */}
      <button
        onClick={handleOpenCast}
        className={cn(
          'p-1 rounded-md transition-colors',
          'text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover/60',
        )}
        title={t('terminal.recording.open_cast')}
      >
        <FilePlay className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

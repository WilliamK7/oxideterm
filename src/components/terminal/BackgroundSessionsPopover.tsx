import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play, X, Clock, Square } from 'lucide-react';
import { useLocalTerminalStore } from '../../store/localTerminalStore';
import type { BackgroundSessionInfo } from '../../types';

/**
 * Popover content showing background (detached) terminal sessions.
 * Rendered inline in the sidebar when background sessions exist.
 */
export const BackgroundSessionsPopover: React.FC<{
  onAttach: (sessionId: string) => void;
  onClose: () => void;
}> = ({ onAttach, onClose }) => {
  const { t } = useTranslation();
  const backgroundSessions = useLocalTerminalStore((s) => s.backgroundSessions);
  const closeTerminal = useLocalTerminalStore((s) => s.closeTerminal);

  if (backgroundSessions.size === 0) return null;

  const formatDuration = (secs: number): string => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  };

  const sessions = Array.from(backgroundSessions.values());

  return (
    <div className="w-64 bg-theme-bg-panel border border-theme-border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-border">
        <span className="text-xs font-medium text-theme-text-muted">
          {t('local_shell.background.title')}
        </span>
        <button
          onClick={onClose}
          className="text-theme-text-muted hover:text-theme-text p-0.5 rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Session list */}
      <div className="max-h-48 overflow-y-auto">
        {sessions.map((session: BackgroundSessionInfo) => (
          <div
            key={session.id}
            className="flex items-center gap-2 px-3 py-2 hover:bg-theme-bg-hover group"
          >
            <Square className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-theme-text truncate">
                {session.shell.label}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-theme-text-muted">
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDuration(session.detachedSecs)}
                </span>
                <span>{session.bufferLines} {t('local_shell.background.lines')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onAttach(session.id)}
                className="p-1 rounded hover:bg-theme-accent/20 text-theme-accent"
                title={t('local_shell.background.resume')}
              >
                <Play className="h-3 w-3" />
              </button>
              <button
                onClick={() => closeTerminal(session.id)}
                className="p-1 rounded hover:bg-red-500/20 text-red-400"
                title={t('local_shell.background.kill')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

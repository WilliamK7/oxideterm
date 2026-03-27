import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PaneLeaf } from '../../types';
import { TerminalView } from './TerminalView';
import { LocalTerminalView } from './LocalTerminalView';
import { getSession } from '../../store/appStore';
import { useBroadcastStore } from '../../store/broadcastStore';
import { cn } from '../../lib/utils';

interface TerminalPaneProps {
  pane: PaneLeaf;
  tabId: string;
  isActive: boolean;
  onFocus: (paneId: string) => void;
  onClose?: (paneId: string) => void;
}

/**
 * TerminalPane - Wrapper component for a single terminal within a split layout
 * 
 * Responsibilities:
 * - Renders the appropriate terminal type (SSH or Local)
 * - Shows visual focus indicator (Oxide Orange border when active)
 * - Passes paneId/tabId for Registry registration
 * - Handles focus callbacks
 */
export const TerminalPane = React.memo<TerminalPaneProps>(({
  pane,
  tabId,
  isActive,
  onFocus,
  onClose,
}) => {
  const { t } = useTranslation('terminal');
  const handleFocus = useCallback(() => {
    onFocus(pane.id);
  }, [onFocus, pane.id]);

  const handleClose = useCallback(() => {
    onClose?.(pane.id);
  }, [onClose, pane.id]);

  // Broadcast target indicator
  const isBroadcastTarget = useBroadcastStore(
    s => s.enabled && s.targets.has(pane.id),
  );

  return (
    <div
      className={cn(
        'group relative h-full w-full overflow-hidden rounded-sm transition-all duration-150',
        // Oxide Orange focus border
        isActive
          ? 'ring-2 ring-[#FF6B35] ring-opacity-80'
          : isBroadcastTarget
            ? 'ring-2 ring-orange-400/60'
            : 'ring-1 ring-theme-border hover:ring-theme-border-strong'
      )}
      onClick={handleFocus}
    >
      {/* Broadcast target badge */}
      {isBroadcastTarget && !isActive && (
        <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded bg-orange-500/20 px-1.5 py-0.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-[10px] font-medium text-orange-300">BC</span>
        </div>
      )}
      {/* Terminal content */}
      {/* Key includes ws_url to force remount when backend assigns new port */}
      <div className="h-full w-full">
        {pane.terminalType === 'terminal' ? (
          <TerminalView
            key={`${pane.sessionId}-${getSession(pane.sessionId)?.ws_url ?? ''}`}
            sessionId={pane.sessionId}
            isActive={isActive}
            paneId={pane.id}
            tabId={tabId}
            onFocus={handleFocus}
          />
        ) : (
          <LocalTerminalView
            sessionId={pane.sessionId}
            paneId={pane.id}
            tabId={tabId}
            onFocus={handleFocus}
          />
        )}
      </div>

      {/* Close button (shown on hover when there are multiple panes) */}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className={cn(
            'absolute right-1 top-1 z-10',
            'h-5 w-5 rounded-sm',
            'flex items-center justify-center',
            'bg-theme-bg-hover/80 text-theme-text-muted hover:bg-red-600/80 hover:text-white',
            'opacity-0 transition-opacity group-hover:opacity-100',
            // Always visible when active for discoverability
            isActive && 'opacity-70'
          )}
          title={t('terminal.pane.close_pane')}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

TerminalPane.displayName = 'TerminalPane';

export default TerminalPane;

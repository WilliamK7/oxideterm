import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../store/settingsStore';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { useLocalTerminalStore } from '../../store/localTerminalStore';
import {
  Download,
  Check,
  Terminal,
  Command,
  Plus,
  Loader2,
  ArrowUpDown,
  Shield,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

// ============================================================================
// Onboarding Modal — Single-page welcome (VS Code–inspired)
// ============================================================================

export const OnboardingModal = () => {
  const { t } = useTranslation();
  const onboardingCompleted = useSettingsStore((s) => s.settings.onboardingCompleted);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const { toggleModal } = useAppStore();
  const createLocalTerminal = useLocalTerminalStore((s) => s.createTerminal);
  const createTab = useAppStore((s) => s.createTab);

  const [open, setOpen] = useState(false);
  const [hostCount, setHostCount] = useState<number | null>(null);
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [importedCount, setImportedCount] = useState(0);

  // Show on first run only
  useEffect(() => {
    if (!onboardingCompleted) {
      const timer = setTimeout(() => setOpen(true), 300);
      return () => clearTimeout(timer);
    }
  }, [onboardingCompleted]);

  // Scan SSH config hosts when dialog opens
  useEffect(() => {
    if (!open) return;
    api.listSshConfigHosts()
      .then((hosts) => setHostCount(hosts.filter((h) => h.alias !== '*').length))
      .catch(() => setHostCount(0));
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    completeOnboarding();
  }, [completeOnboarding]);

  const handleOpenTerminal = useCallback(async () => {
    handleClose();
    try {
      const info = await createLocalTerminal();
      createTab('local_terminal', info.id);
    } catch { /* ignore */ }
  }, [handleClose, createLocalTerminal, createTab]);

  const handleNewConnection = useCallback(() => {
    handleClose();
    toggleModal('newConnection', true);
  }, [handleClose, toggleModal]);

  const handleImportAll = useCallback(async () => {
    setImportState('loading');
    try {
      const hosts = await api.listSshConfigHosts();
      const filtered = hosts.filter((h) => h.alias !== '*');
      let count = 0;
      for (const host of filtered) {
        try {
          await api.importSshHost(host.alias);
          count++;
        } catch { /* skip */ }
      }
      setImportedCount(count);
    } catch { /* ignore */ }
    setImportState('done');
  }, []);

  if (onboardingCompleted) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Derive import card label
  const importLabel =
    importState === 'done'
      ? t('onboarding.import_ssh_done', { count: importedCount })
      : hostCount === null
        ? t('onboarding.importing')
        : hostCount > 0
          ? t('onboarding.import_ssh_desc', { count: hostCount })
          : t('onboarding.import_ssh_none');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        {/* ── Brand header ───────────────────────────────────── */}
        <div className="px-6 pt-8 pb-6 text-center select-none">
          <div className="flex items-center justify-center gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-theme-text empty-brand">
              {t('onboarding.welcome')}
            </h2>
            <span className="inline-block w-[3px] h-[0.7em] rounded-sm bg-theme-text opacity-40 translate-y-[1px]" />
          </div>
          <p className="text-sm text-theme-text-muted mt-2">{t('onboarding.subtitle')}</p>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* ── Quick Start ──────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-3">
              {t('onboarding.quick_start')}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {/* Open Terminal */}
              <button
                onClick={handleOpenTerminal}
                className="group flex flex-col items-center gap-2.5 px-3 py-4 rounded-sm border border-theme-border bg-theme-bg-panel hover:border-[var(--theme-accent)] hover:bg-theme-bg-hover transition-colors"
              >
                <Terminal className="h-5 w-5 text-theme-text-muted group-hover:text-[var(--theme-accent)] transition-colors" />
                <div className="text-center">
                  <div className="text-xs font-medium text-theme-text">{t('onboarding.open_terminal')}</div>
                  <div className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">{t('onboarding.open_terminal_desc')}</div>
                </div>
              </button>

              {/* New Connection */}
              <button
                onClick={handleNewConnection}
                className="group flex flex-col items-center gap-2.5 px-3 py-4 rounded-sm border border-theme-border bg-theme-bg-panel hover:border-[var(--theme-accent)] hover:bg-theme-bg-hover transition-colors"
              >
                <Plus className="h-5 w-5 text-theme-text-muted group-hover:text-[var(--theme-accent)] transition-colors" />
                <div className="text-center">
                  <div className="text-xs font-medium text-theme-text">{t('onboarding.new_connection')}</div>
                  <div className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">{t('onboarding.new_connection_desc')}</div>
                </div>
              </button>

              {/* Import SSH Config */}
              <button
                onClick={importState === 'idle' && hostCount ? handleImportAll : undefined}
                disabled={importState !== 'idle' || !hostCount}
                className="group flex flex-col items-center gap-2.5 px-3 py-4 rounded-sm border border-theme-border bg-theme-bg-panel hover:border-[var(--theme-accent)] hover:bg-theme-bg-hover disabled:opacity-50 disabled:cursor-default disabled:hover:border-theme-border disabled:hover:bg-theme-bg-panel transition-colors"
              >
                {importState === 'loading' ? (
                  <Loader2 className="h-5 w-5 text-theme-text-muted animate-spin" />
                ) : importState === 'done' ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Download className="h-5 w-5 text-theme-text-muted group-hover:text-[var(--theme-accent)] transition-colors" />
                )}
                <div className="text-center">
                  <div className="text-xs font-medium text-theme-text">{t('onboarding.import_ssh')}</div>
                  <div className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">{importLabel}</div>
                </div>
              </button>
            </div>
          </section>

          {/* ── Feature highlights ───────────────────────────── */}
          <section>
            <h3 className="text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-3">
              {t('onboarding.features')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                { icon: Command, key: 'cmd_palette', shortcut: isMac ? '⌘K' : 'Ctrl+K' },
                { icon: RefreshCw, key: 'reconnect', shortcut: null },
                { icon: ArrowUpDown, key: 'multiplexing', shortcut: null },
                { icon: Shield, key: 'security', shortcut: null },
              ] as const).map((item) => (
                <div key={item.key} className="flex gap-2.5 p-3 rounded-sm border border-theme-border bg-theme-bg-panel">
                  <item.icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--theme-accent)]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-theme-text">{t(`onboarding.${item.key}`)}</span>
                      {item.shortcut && (
                        <kbd className="px-1 py-0.5 rounded-sm bg-theme-bg border border-theme-border text-theme-text-muted font-mono text-[9px] leading-tight">
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                    <p className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">{t(`onboarding.${item.key}_desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-theme-border bg-theme-bg-panel">
          <Button size="sm" onClick={handleClose} className="gap-1.5">
            {t('onboarding.start_exploring')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

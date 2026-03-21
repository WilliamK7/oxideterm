/**
 * Launcher Store
 *
 * Global state for the platform application launcher.
 * - macOS: lists installed .app bundles from /Applications
 * - Windows: lists WSL distros (reuses wsl_graphics_list_distros)
 */

import { create } from 'zustand';
import { api } from '../lib/api';
import { platform } from '../lib/platform';

// ── Types ────────────────────────────────────────────────────────────────────

const LAUNCHER_ENABLED_KEY = 'oxide-launcher-enabled';

export interface AppEntry {
  name: string;
  path: string;
  bundleId: string | null;
  iconPath: string | null;
}

/** Response from launcher_list_apps */
interface LauncherListResponse {
  apps: AppEntry[];
  iconDir: string | null;
}

export interface WslDistro {
  name: string;
  is_default: boolean;
  is_running: boolean;
}

interface LauncherStore {
  /** Whether the user has opted in to the launcher (macOS only) */
  enabled: boolean;
  /** macOS: list of installed applications */
  apps: AppEntry[];
  /** macOS: icon cache directory (asset-protocol-granted) */
  iconDir: string | null;
  /** Windows: list of WSL distros */
  wslDistros: WslDistro[];
  /** Current search query */
  searchQuery: string;
  /** Whether the initial scan is in progress */
  loading: boolean;
  /** Error message if scan failed */
  error: string | null;

  /** Enable launcher (user opt-in) and start scanning */
  enableLauncher: () => void;
  /** Disable launcher (user opt-out), clear cache and revoke grants */
  disableLauncher: () => Promise<void>;
  /** Load apps (platform-aware) */
  loadApps: () => Promise<void>;
  /** Launch an app by path (macOS) */
  launchApp: (path: string) => Promise<void>;
  /** Launch a WSL distro (Windows) */
  launchWsl: (distro: string) => Promise<void>;
  /** Update search query */
  setSearch: (query: string) => void;
}

function isLauncherEnabled(): boolean {
  try {
    return localStorage.getItem(LAUNCHER_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export const useLauncherStore = create<LauncherStore>((set, get) => ({
  enabled: isLauncherEnabled(),
  apps: [],
  iconDir: null,
  wslDistros: [],
  searchQuery: '',
  loading: false,
  error: null,

  enableLauncher: () => {
    try {
      localStorage.setItem(LAUNCHER_ENABLED_KEY, 'true');
    } catch { /* noop */ }
    set({ enabled: true });
    // Immediately start scanning after opt-in
    get().loadApps();
  },

  disableLauncher: async () => {
    try {
      localStorage.removeItem(LAUNCHER_ENABLED_KEY);
    } catch { /* noop */ }
    // Set enabled=false first so in-flight loadApps will discard its results
    set({ enabled: false, apps: [], iconDir: null, searchQuery: '', error: null, loading: false });
    // Clear icon cache on backend (best-effort, after state is already clean)
    try {
      await api.launcherClearCache();
    } catch { /* best-effort */ }
  },

  loadApps: async () => {
    if (get().loading) return;
    // macOS requires explicit opt-in before scanning
    if (platform.isMac && !get().enabled) return;
    set({ loading: true, error: null });
    try {
      if (platform.isMac) {
        const resp = await api.launcherListApps<LauncherListResponse>();
        // Guard: discard results if launcher was disabled while scan was in flight
        if (!get().enabled) { set({ loading: false }); return; }
        set({ apps: resp.apps, iconDir: resp.iconDir, loading: false });
      } else if (platform.isWindows) {
        const distros = await api.wslGraphicsListDistros<WslDistro>();
        set({ wslDistros: distros, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      // Don't set error if macOS launcher was disabled during flight
      if (platform.isMac && !get().enabled) { set({ loading: false }); return; }
      set({ error: String(err), loading: false });
    }
  },

  launchApp: async (path: string) => {
    try {
      await api.launcherLaunchApp(path);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  launchWsl: async (distro: string) => {
    try {
      await api.launcherWslLaunch(distro);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setSearch: (query: string) => set({ searchQuery: query }),
}));

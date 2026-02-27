/**
 * Broadcast Store
 *
 * Manages the "broadcast input" feature: when enabled, keystrokes from
 * the active terminal pane are replicated to every selected target pane
 * via the shared terminalRegistry writer.
 *
 * This is a transient interaction store — nothing is persisted.
 */

import { create } from 'zustand';

interface BroadcastState {
  /** Master switch */
  enabled: boolean;
  /** Set of paneIds that should receive broadcast input */
  targets: Set<string>;
}

interface BroadcastActions {
  /** Toggle the master switch (also clears targets when disabling) */
  toggle: () => void;
  /** Enable broadcast */
  enable: () => void;
  /** Disable broadcast and clear targets */
  disable: () => void;
  /** Add a pane to the broadcast target set */
  addTarget: (paneId: string) => void;
  /** Remove a pane from the broadcast target set */
  removeTarget: (paneId: string) => void;
  /** Replace entire target set */
  setTargets: (paneIds: string[]) => void;
  /** Clear all targets (does NOT disable) */
  clearTargets: () => void;
  /** Toggle a single pane in/out of the target set */
  toggleTarget: (paneId: string) => void;
}

export const useBroadcastStore = create<BroadcastState & BroadcastActions>(
  (set, get) => ({
    enabled: false,
    targets: new Set<string>(),

    toggle: () => {
      const { enabled } = get();
      if (enabled) {
        // Turning off — also clear targets
        set({ enabled: false, targets: new Set() });
      } else {
        set({ enabled: true });
      }
    },

    enable: () => set({ enabled: true }),

    disable: () => set({ enabled: false, targets: new Set() }),

    addTarget: (paneId) => {
      const next = new Set(get().targets);
      next.add(paneId);
      // Auto-enable broadcast when a target is added
      set({ targets: next, enabled: true });
    },

    removeTarget: (paneId) => {
      const next = new Set(get().targets);
      if (next.delete(paneId)) {
        // Auto-disable if no targets remain
        if (next.size === 0) {
          set({ targets: next, enabled: false });
        } else {
          set({ targets: next });
        }
      }
    },

    setTargets: (paneIds) => {
      set({ targets: new Set(paneIds) });
    },

    clearTargets: () => {
      set({ targets: new Set(), enabled: false });
    },

    toggleTarget: (paneId) => {
      const next = new Set(get().targets);
      if (next.has(paneId)) {
        next.delete(paneId);
        if (next.size === 0) {
          set({ targets: next, enabled: false });
        } else {
          set({ targets: next });
        }
      } else {
        next.add(paneId);
        // Auto-enable broadcast when a target is selected
        set({ targets: next, enabled: true });
      }
    },
  }),
);

/**
 * Recording Store
 *
 * Manages global recording state so multiple components
 * (TerminalView, LocalTerminalView, RecordingControls, CastPlayer)
 * can co-ordinate. Each session can have at most one active recorder.
 *
 * Also manages the cast-player modal state.
 */

import { create } from 'zustand';
import { TerminalRecorder, type RecorderOptions } from '../lib/recording';
import type { RecordingState, RecordingMetadata } from '../lib/recording';

// ── Types ────────────────────────────────────────────────────────────────────

type RecordingEntry = {
  recorder: TerminalRecorder;
  meta: RecordingMetadata;
  /** Timer ID for elapsed-time updates */
  tickTimer: ReturnType<typeof setInterval> | null;
};

type CastPlayerModal = {
  /** Is the player modal open? */
  open: boolean;
  /** File name being played */
  fileName: string;
  /** Raw .cast file content */
  content: string;
};

type RecordingStoreState = {
  /** Active recordings keyed by sessionId */
  recordings: Map<string, RecordingEntry>;
  /** Volatile timer data (elapsed, eventCount) — updated every 500ms without cloning recordings */
  recordingTicks: Map<string, { elapsed: number; eventCount: number }>;
  /** Cast player modal state */
  playerModal: CastPlayerModal;
};

type RecordingStoreActions = {
  // ── Recording lifecycle ────────────────────────────────────────────────
  startRecording: (
    sessionId: string,
    cols: number,
    rows: number,
    meta: Pick<RecordingMetadata, 'terminalType' | 'label'>,
    options?: RecorderOptions,
  ) => TerminalRecorder;

  pauseRecording: (sessionId: string) => void;
  resumeRecording: (sessionId: string) => void;

  /** Stop recording and return the .cast content string */
  stopRecording: (sessionId: string) => string | null;

  /** Discard recording without saving */
  discardRecording: (sessionId: string) => void;

  /** Get the recorder instance for a session */
  getRecorder: (sessionId: string) => TerminalRecorder | null;

  /** Get recording metadata (reactive) */
  getRecordingMeta: (sessionId: string) => RecordingMetadata | null;

  /** Is this session currently recording? */
  isRecording: (sessionId: string) => boolean;

  /** Get recording state for a session */
  getRecordingState: (sessionId: string) => RecordingState;

  // ── Player modal ───────────────────────────────────────────────────────
  openPlayer: (fileName: string, content: string) => void;
  closePlayer: () => void;
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useRecordingStore = create<RecordingStoreState & RecordingStoreActions>(
  (set, get) => ({
    // ── State ──────────────────────────────────────────────────────────────
    recordings: new Map(),
    recordingTicks: new Map(),
    playerModal: { open: false, fileName: '', content: '' },

    // ── Recording lifecycle ────────────────────────────────────────────────

    startRecording: (sessionId, cols, rows, meta, options) => {
      const existing = get().recordings.get(sessionId);
      if (existing) {
        // Already recording — discard previous
        existing.recorder.discard();
        if (existing.tickTimer) clearInterval(existing.tickTimer);
      }

      const recorder = new TerminalRecorder();
      recorder.start(cols, rows, options);

      const entry: RecordingEntry = {
        recorder,
        meta: {
          sessionId,
          terminalType: meta.terminalType,
          label: meta.label,
          startedAt: Date.now(),
          eventCount: 0,
          elapsed: 0,
        },
        tickTimer: null,
      };

      // Update elapsed + eventCount every 500ms (lightweight — only updates recordingTicks)
      entry.tickTimer = setInterval(() => {
        const rec = get().recordings.get(sessionId);
        if (!rec) return;
        const elapsed = rec.recorder.getElapsed();
        const eventCount = rec.recorder.getEventCount();
        const updated = new Map(get().recordingTicks);
        updated.set(sessionId, { elapsed, eventCount });
        set({ recordingTicks: updated });
      }, 500);

      const updated = new Map(get().recordings);
      updated.set(sessionId, entry);
      set({ recordings: updated });

      return recorder;
    },

    pauseRecording: (sessionId) => {
      const entry = get().recordings.get(sessionId);
      if (!entry) return;
      entry.recorder.pause();
      // Trigger reactive update
      const updated = new Map(get().recordings);
      set({ recordings: updated });
    },

    resumeRecording: (sessionId) => {
      const entry = get().recordings.get(sessionId);
      if (!entry) return;
      entry.recorder.resume();
      const updated = new Map(get().recordings);
      set({ recordings: updated });
    },

    stopRecording: (sessionId) => {
      const entry = get().recordings.get(sessionId);
      if (!entry) return null;

      if (entry.tickTimer) clearInterval(entry.tickTimer);

      const content = entry.recorder.stop();

      const updated = new Map(get().recordings);
      updated.delete(sessionId);
      const ticks = new Map(get().recordingTicks);
      ticks.delete(sessionId);
      set({ recordings: updated, recordingTicks: ticks });

      return content;
    },

    discardRecording: (sessionId) => {
      const entry = get().recordings.get(sessionId);
      if (!entry) return;

      if (entry.tickTimer) clearInterval(entry.tickTimer);
      entry.recorder.discard();

      const updated = new Map(get().recordings);
      updated.delete(sessionId);
      const ticks = new Map(get().recordingTicks);
      ticks.delete(sessionId);
      set({ recordings: updated, recordingTicks: ticks });
    },

    getRecorder: (sessionId) => {
      return get().recordings.get(sessionId)?.recorder ?? null;
    },

    getRecordingMeta: (sessionId) => {
      const entry = get().recordings.get(sessionId);
      if (!entry) return null;
      // Merge volatile tick data into static meta
      const tick = get().recordingTicks.get(sessionId);
      if (tick) {
        return { ...entry.meta, elapsed: tick.elapsed, eventCount: tick.eventCount };
      }
      return entry.meta;
    },

    isRecording: (sessionId) => {
      const entry = get().recordings.get(sessionId);
      if (!entry) return false;
      const state = entry.recorder.getState();
      return state === 'recording' || state === 'paused';
    },

    getRecordingState: (sessionId) => {
      return get().recordings.get(sessionId)?.recorder.getState() ?? 'idle';
    },

    // ── Player modal ───────────────────────────────────────────────────────

    openPlayer: (fileName, content) => {
      set({ playerModal: { open: true, fileName, content } });
    },

    closePlayer: () => {
      set({ playerModal: { open: false, fileName: '', content: '' } });
    },
  }),
);

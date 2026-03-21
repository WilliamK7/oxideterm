/**
 * AI Chat Constants
 *
 * Single source of truth for the default system prompt, token budget parameters,
 * and context usage thresholds used across the AI subsystem.
 */

// ═══════════════════════════════════════════════════════════════════════════
// System Prompt
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_SYSTEM_PROMPT = `You are OxideSens, a helpful terminal assistant. You help users with shell commands, scripts, and terminal operations. Be concise and direct. When providing commands, format them clearly. You can use markdown for formatting.`;

/**
 * Instruction appended to system prompt to request follow-up suggestion chips.
 * Only injected when the model's context window is large enough (≥8K tokens).
 * Token cost: ~120 tokens.
 */
export const SUGGESTIONS_INSTRUCTION = `

## Follow-Up Suggestions

At the END of your response, optionally include 2-4 follow-up suggestions the user might want to try next. Use this exact XML format:

<suggestions>
<s icon="IconName">Short actionable suggestion text</s>
</suggestions>

Rules:
- Only include suggestions when they add value (skip for simple greetings or one-off answers)
- Keep each suggestion under 60 characters
- Use Lucide icon names: Zap, Search, Bug, FileCode, Terminal, Settings, RefreshCw, Shield, BarChart, GitBranch, Download, Upload, Eye, Wrench, Play
- Suggestions must be contextually relevant to the conversation`;

// ═══════════════════════════════════════════════════════════════════════════
// Token Budget Parameters
// ═══════════════════════════════════════════════════════════════════════════

/** Default context window for models not found in the lookup table or provider cache. */
export const DEFAULT_CONTEXT_WINDOW = 8192;

/** Fraction of context window allocated to conversation history (system + context excluded). */
export const HISTORY_BUDGET_RATIO = 0.7;

/** Fraction of context window reserved for the model's response. */
export const RESPONSE_RESERVE_RATIO = 0.15;

/** Hard cap on response reserve tokens (prevents oversized reserves on huge context windows). */
export const RESPONSE_RESERVE_CAP = 4096;

/**
 * Safety margin multiplier applied to heuristic token estimates.
 * Compensates for the imprecision of character-ratio estimation
 * (actual BPE tokenization varies by model and content).
 */
export const TOKEN_SAFETY_MARGIN = 1.15;

// ═══════════════════════════════════════════════════════════════════════════
// Context Usage Thresholds
// ═══════════════════════════════════════════════════════════════════════════

/** Context usage above this ratio triggers a warning indicator (amber). */
export const CONTEXT_WARNING_THRESHOLD = 0.70;

/** Context usage above this ratio triggers a danger indicator (red) and the compact/summarize banner. */
export const CONTEXT_DANGER_THRESHOLD = 0.85;

/** Context usage above this ratio triggers automatic compaction when sending a message. */
export const COMPACTION_TRIGGER_THRESHOLD = 0.80;

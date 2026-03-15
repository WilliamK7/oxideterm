/**
 * # Suggestion Parser
 *
 * Parses follow-up suggestion blocks from LLM response content.
 * The LLM is instructed to append a `<suggestions>` block at the end of its
 * response. This parser strips it from the visible content and returns the
 * parsed suggestion chips.
 *
 * Format:
 * ```
 * <suggestions>
 * <s icon="Zap">Run the deploy script</s>
 * <s icon="Search">Show container logs</s>
 * <s icon="Bug">Debug the connection timeout</s>
 * </suggestions>
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type FollowUpSuggestion = {
  /** Lucide icon name (e.g. "Zap", "Search") */
  icon: string;
  /** Display text for the suggestion chip */
  text: string;
};

export type ParseResult = {
  /** Content with <suggestions> block stripped */
  cleanContent: string;
  /** Parsed suggestions (empty array if none found) */
  suggestions: FollowUpSuggestion[];
};

// ═══════════════════════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pattern matching the entire <suggestions> block at the end of content.
 * Uses `[\s\S]` to match across newlines.
 */
const SUGGESTIONS_BLOCK_RE =
  /<suggestions>\s*([\s\S]*?)\s*<\/suggestions>\s*$/;

/**
 * Pattern matching individual `<s>` entries within the block.
 */
const SUGGESTION_ITEM_RE =
  /<s\s+icon="([^"]+)">([\s\S]*?)<\/s>/g;

/** Maximum number of suggestions to parse (prevents abuse). */
const MAX_SUGGESTIONS = 5;

/**
 * Parse follow-up suggestions from LLM response content.
 *
 * - Extracts and removes the `<suggestions>` block from the end of content
 * - Returns up to 5 parsed suggestion items
 * - Returns original content unchanged if no suggestions block is found
 */
export function parseSuggestions(content: string): ParseResult {
  const blockMatch = content.match(SUGGESTIONS_BLOCK_RE);

  if (!blockMatch) {
    return { cleanContent: content, suggestions: [] };
  }

  const cleanContent = content.slice(0, blockMatch.index).trimEnd();
  const blockInner = blockMatch[1];
  const suggestions: FollowUpSuggestion[] = [];

  let match: RegExpExecArray | null;
  while ((match = SUGGESTION_ITEM_RE.exec(blockInner)) !== null) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;

    const icon = match[1].trim();
    const text = match[2].trim();

    // Skip empty or suspiciously long suggestions
    if (text.length > 0 && text.length <= 200 && icon.length <= 30) {
      suggestions.push({ icon, text });
    }
  }

  // Reset regex lastIndex for re-entrancy
  SUGGESTION_ITEM_RE.lastIndex = 0;

  return { cleanContent, suggestions };
}

/**
 * Check if content contains a partial (still-streaming) suggestions block.
 * Used to avoid premature parsing during streaming.
 */
export function hasPartialSuggestionsBlock(content: string): boolean {
  return content.includes('<suggestions>') && !content.includes('</suggestions>');
}

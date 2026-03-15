/**
 * Slash Commands Registry
 *
 * Defines all available /commands for the AI chat input.
 * Commands fall into two categories:
 *   - LLM commands: modify system prompt / auto-attach context, then send to LLM
 *   - Client-only commands: handled entirely in frontend (e.g. /help, /clear)
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type SlashCommandCategory =
  | 'understanding'
  | 'troubleshooting'
  | 'creation'
  | 'system'
  | 'management'
  | 'discovery'
  | 'meta';

export type AutoContextType = 'terminal' | 'error' | 'selection';

export type SlashCommandDef = {
  /** Command name (without the leading /) */
  name: string;
  /** i18n key for the display label */
  labelKey: string;
  /** i18n key for the description shown in autocomplete */
  descriptionKey: string;
  /** Lucide icon name */
  icon: string;
  /** Category for grouping in autocomplete */
  category: SlashCommandCategory;
  /** Text appended to system prompt when this command is used */
  systemPromptModifier?: string;
  /** Automatically attach this context type */
  autoContext?: AutoContextType;
  /** If true, handled entirely in frontend — never sent to LLM */
  clientOnly?: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════

export const SLASH_COMMANDS: SlashCommandDef[] = [
  // ── Understanding ──
  {
    name: 'explain',
    labelKey: 'ai.slash.explain',
    descriptionKey: 'ai.slash.explain_desc',
    icon: 'BookOpen',
    category: 'understanding',
    systemPromptModifier:
      'The user wants an explanation. Be thorough and educational. Explain step-by-step what the command or output does, including any flags, options, or output fields. Provide examples where helpful.',
    autoContext: 'terminal',
  },
  {
    name: 'optimize',
    labelKey: 'ai.slash.optimize',
    descriptionKey: 'ai.slash.optimize_desc',
    icon: 'Gauge',
    category: 'understanding',
    systemPromptModifier:
      'The user wants to optimize a command or script. Analyze the current approach, identify inefficiencies, and suggest improvements. Compare before and after. Mention readability and performance trade-offs.',
  },

  // ── Troubleshooting ──
  {
    name: 'fix',
    labelKey: 'ai.slash.fix',
    descriptionKey: 'ai.slash.fix_desc',
    icon: 'Wrench',
    category: 'troubleshooting',
    systemPromptModifier:
      'The user needs help fixing an error or problem. Diagnose the root cause step by step. Check the most common causes first. Use tools to gather diagnostic data when possible. Provide the exact fix with explanation.',
    autoContext: 'terminal',
  },

  // ── Creation ──
  {
    name: 'script',
    labelKey: 'ai.slash.script',
    descriptionKey: 'ai.slash.script_desc',
    icon: 'FileCode',
    category: 'creation',
    systemPromptModifier:
      'The user wants you to write a shell script. Produce production-quality code with proper error handling, meaningful comments, and clear variable names. Use `set -euo pipefail` for bash scripts. Include a usage comment at the top.',
  },
  {
    name: 'deploy',
    labelKey: 'ai.slash.deploy',
    descriptionKey: 'ai.slash.deploy_desc',
    icon: 'Rocket',
    category: 'creation',
    systemPromptModifier:
      'The user wants a deployment procedure or script. Produce a step-by-step plan with rollback procedures. Include pre-checks (disk space, service status), the deployment steps, post-deployment verification, and rollback commands.',
  },

  // ── System ──
  {
    name: 'monitor',
    labelKey: 'ai.slash.monitor',
    descriptionKey: 'ai.slash.monitor_desc',
    icon: 'Activity',
    category: 'system',
    systemPromptModifier:
      'The user wants a system health check. Run diagnostic commands to collect CPU, memory, disk, network, and process information. Summarize findings and flag any anomalies. Use tools proactively to gather data.',
    autoContext: 'terminal',
  },

  // ── Management ──
  {
    name: 'connect',
    labelKey: 'ai.slash.connect',
    descriptionKey: 'ai.slash.connect_desc',
    icon: 'Link',
    category: 'management',
    systemPromptModifier:
      'The user needs help with SSH connections. Guide them through connection setup, troubleshooting connectivity issues, or managing SSH keys and config. Use available tools to check connection status.',
  },

  // ── Discovery ──
  {
    name: 'search',
    labelKey: 'ai.slash.search',
    descriptionKey: 'ai.slash.search_desc',
    icon: 'Search',
    category: 'discovery',
    systemPromptModifier:
      'The user wants to find files, search logs, or locate information. Use grep_search, list_directory, or terminal_exec with find/grep to locate the requested data. Be thorough in searching.',
  },

  // ── Meta (client-only) ──
  {
    name: 'help',
    labelKey: 'ai.slash.help',
    descriptionKey: 'ai.slash.help_desc',
    icon: 'HelpCircle',
    category: 'meta',
    clientOnly: true,
  },
  {
    name: 'clear',
    labelKey: 'ai.slash.clear',
    descriptionKey: 'ai.slash.clear_desc',
    icon: 'Trash2',
    category: 'meta',
    clientOnly: true,
  },
  {
    name: 'compact',
    labelKey: 'ai.slash.compact',
    descriptionKey: 'ai.slash.compact_desc',
    icon: 'Archive',
    category: 'meta',
    clientOnly: true,
  },
  {
    name: 'tools',
    labelKey: 'ai.slash.tools',
    descriptionKey: 'ai.slash.tools_desc',
    icon: 'Boxes',
    category: 'meta',
    clientOnly: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Lookup Helpers
// ═══════════════════════════════════════════════════════════════════════════

const commandMap = new Map(SLASH_COMMANDS.map(c => [c.name, c]));

/** Resolve a command name to its definition. Returns undefined for unknown commands. */
export function resolveSlashCommand(name: string): SlashCommandDef | undefined {
  return commandMap.get(name);
}

/** Filter commands by partial name for autocomplete. */
export function filterSlashCommands(partial: string): SlashCommandDef[] {
  const lower = partial.toLowerCase();
  return SLASH_COMMANDS.filter(c => c.name.startsWith(lower));
}

/** Group commands by category for autocomplete display. */
export function groupSlashCommandsByCategory(): Map<SlashCommandCategory, SlashCommandDef[]> {
  const groups = new Map<SlashCommandCategory, SlashCommandDef[]>();
  for (const cmd of SLASH_COMMANDS) {
    const list = groups.get(cmd.category) || [];
    list.push(cmd);
    groups.set(cmd.category, list);
  }
  return groups;
}

/**
 * Model alias mapping for Claude models
 */
export const CLAUDE_MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-5-20251101',
} as const;

/**
 * Default models per provider
 */
export const DEFAULT_MODELS = {
  claude: 'claude-opus-4-5-20251101',
} as const;

export type ModelAlias = keyof typeof CLAUDE_MODEL_MAP;

/**
 * AgentModel - Available AI models
 * Includes Claude models and GLM models
 */
export type AgentModel = ModelAlias | 'GLM-4.7';

/**
 * MCP Configuration Conversion Utility
 *
 * Converts MCP server configurations from storage format to Claude SDK format.
 *
 * Storage format uses a discriminated union with 'type' field for TypeScript:
 * - StdioMcpConfig: { type: 'stdio', command, args, env? }
 * - HttpMcpConfig: { type: 'http', url, headers? }
 *
 * SDK format (matches @anthropic-ai/claude-agent-sdk types):
 * - Stdio: { type?: 'stdio', command, args?, env? } - 'type' optional
 * - HTTP: { type: 'http', url, headers? } - 'type' REQUIRED
 *
 * This utility:
 * 1. Filters MCP servers to only those explicitly enabled for a task
 * 2. Converts each config to SDK-compatible format
 * 3. Returns a Record<serverId, config> for direct use with Claude SDK
 */

import type { McpServerConfig, StdioMcpConfig, HttpMcpConfig } from '@automaker/types';
import type { McpSdkConfig, StdioMcpSdkConfig, HttpMcpSdkConfig } from '../providers/types.js';

/**
 * Convert a stdio transport configuration to SDK format.
 * Note: 'type' field is optional for stdio in SDK (defaults to 'stdio').
 *
 * @param config - Stdio MCP transport configuration
 * @returns SDK-compatible stdio configuration
 */
function convertStdioConfig(config: StdioMcpConfig): StdioMcpSdkConfig {
  const sdkConfig: StdioMcpSdkConfig = {
    // Explicitly include type: 'stdio' to ensure proper transport detection
    // While the SDK documentation says 'type' is optional for stdio, including it
    // may help with edge cases and cross-platform compatibility
    type: 'stdio',
    command: config.command,
    args: config.args,
  };

  // Only include env if it has values (avoid empty objects in SDK config)
  if (config.env && Object.keys(config.env).length > 0) {
    sdkConfig.env = config.env;
  }

  return sdkConfig;
}

/**
 * Convert an HTTP transport configuration to SDK format.
 * Note: 'type' field is REQUIRED for HTTP configs in SDK.
 *
 * @param config - HTTP MCP transport configuration
 * @returns SDK-compatible HTTP configuration
 */
function convertHttpConfig(config: HttpMcpConfig): HttpMcpSdkConfig {
  const sdkConfig: HttpMcpSdkConfig = {
    type: 'http',
    url: config.url,
  };

  // Only include headers if they exist (avoid empty objects in SDK config)
  if (config.headers && Object.keys(config.headers).length > 0) {
    sdkConfig.headers = config.headers;
  }

  return sdkConfig;
}

/**
 * Convert a single MCP server transport configuration to SDK format.
 * Uses the 'type' discriminator to determine conversion path.
 *
 * @param transport - Transport configuration (stdio or http)
 * @returns SDK-compatible configuration
 */
function convertTransportToSdk(transport: StdioMcpConfig | HttpMcpConfig): McpSdkConfig {
  if (transport.type === 'stdio') {
    return convertStdioConfig(transport);
  } else {
    return convertHttpConfig(transport);
  }
}

/**
 * Convert MCP server configurations from storage format to Claude SDK format.
 *
 * This is the main entry point for MCP config conversion. It:
 * 1. Filters to only servers whose IDs are in the enabledIds list
 * 2. Converts each server's transport config to SDK format (strips 'type' field)
 * 3. Returns a keyed object using server IDs as keys
 *
 * @param configs - Array of MCP server configurations from global settings
 * @param enabledIds - Array of server IDs that should be enabled for this task
 * @returns Record mapping server IDs to SDK-compatible configurations
 *
 * @example
 * ```typescript
 * // Storage format input
 * const configs: McpServerConfig[] = [
 *   {
 *     id: 'fs',
 *     name: 'Filesystem',
 *     transport: { type: 'stdio', command: 'npx', args: ['-y', '@mcp/server-fs'] },
 *     enabled: true,
 *     createdAt: '2024-01-01T00:00:00Z',
 *     updatedAt: '2024-01-01T00:00:00Z'
 *   },
 *   {
 *     id: 'remote',
 *     name: 'Remote API',
 *     transport: { type: 'http', url: 'https://mcp.example.com' },
 *     enabled: true,
 *     createdAt: '2024-01-01T00:00:00Z',
 *     updatedAt: '2024-01-01T00:00:00Z'
 *   }
 * ];
 *
 * // SDK format output (note: 'type' omitted for stdio, required for http)
 * const result = convertMcpConfigsToSdkFormat(configs, ['fs', 'remote']);
 * // {
 * //   'fs': { command: 'npx', args: ['-y', '@mcp/server-fs'] },
 * //   'remote': { type: 'http', url: 'https://mcp.example.com' }
 * // }
 * ```
 */
export function convertMcpConfigsToSdkFormat(
  configs: McpServerConfig[],
  enabledIds: string[]
): Record<string, McpSdkConfig> {
  // Early return for empty inputs
  if (!configs || configs.length === 0 || !enabledIds || enabledIds.length === 0) {
    return {};
  }

  // Create a Set for O(1) lookup of enabled IDs
  const enabledIdSet = new Set(enabledIds);

  // Build the SDK config object
  const result: Record<string, McpSdkConfig> = {};

  for (const config of configs) {
    // Only include servers that are in the enabled list for this task
    if (enabledIdSet.has(config.id)) {
      result[config.id] = convertTransportToSdk(config.transport);
    }
  }

  return result;
}

/**
 * Get the list of enabled MCP server IDs based on global defaults.
 *
 * When creating a new task, this returns the IDs of servers that have
 * their 'enabled' flag set to true in global settings, providing
 * sensible defaults for the task creation dialog.
 *
 * @param configs - Array of MCP server configurations from global settings
 * @returns Array of server IDs that are enabled by default
 *
 * @example
 * ```typescript
 * const configs: McpServerConfig[] = [
 *   { id: 'fs', name: 'Filesystem', enabled: true, ... },
 *   { id: 'remote', name: 'Remote API', enabled: false, ... }
 * ];
 *
 * const defaults = getDefaultEnabledMcpServerIds(configs);
 * // ['fs']
 * ```
 */
export function getDefaultEnabledMcpServerIds(configs: McpServerConfig[]): string[] {
  if (!configs || configs.length === 0) {
    return [];
  }

  return configs.filter((config) => config.enabled).map((config) => config.id);
}

/**
 * Validate that all enabled IDs reference existing MCP server configurations.
 *
 * Use this to detect stale references (e.g., when a server was deleted but
 * a task still references its ID).
 *
 * @param configs - Array of MCP server configurations from global settings
 * @param enabledIds - Array of server IDs to validate
 * @returns Object with valid IDs and any invalid (orphaned) IDs
 *
 * @example
 * ```typescript
 * const configs: McpServerConfig[] = [
 *   { id: 'fs', name: 'Filesystem', ... }
 * ];
 *
 * const result = validateMcpServerIds(configs, ['fs', 'deleted-server']);
 * // { validIds: ['fs'], invalidIds: ['deleted-server'] }
 * ```
 */
export function validateMcpServerIds(
  configs: McpServerConfig[],
  enabledIds: string[]
): { validIds: string[]; invalidIds: string[] } {
  if (!enabledIds || enabledIds.length === 0) {
    return { validIds: [], invalidIds: [] };
  }

  const configIdSet = new Set(configs?.map((c) => c.id) ?? []);
  const validIds: string[] = [];
  const invalidIds: string[] = [];

  for (const id of enabledIds) {
    if (configIdSet.has(id)) {
      validIds.push(id);
    } else {
      invalidIds.push(id);
    }
  }

  return { validIds, invalidIds };
}

/**
 * Build a system prompt section containing custom instructions for enabled MCP servers.
 *
 * This function extracts customPrompt fields from enabled MCP servers and formats them
 * into a structured section that can be appended to the AI's system prompt. This allows
 * users to provide high-level guidance to the AI on when and how to use specific MCP servers.
 *
 * @param configs - Array of MCP server configurations from global settings
 * @param enabledIds - Array of server IDs that are enabled for this task
 * @returns A formatted string containing MCP server instructions, or empty string if none
 *
 * @example
 * ```typescript
 * const configs: McpServerConfig[] = [
 *   {
 *     id: 'fs',
 *     name: 'Filesystem',
 *     customPrompt: 'Use this server for file operations. Always confirm before deleting.',
 *     transport: { type: 'stdio', command: 'npx', args: ['-y', '@mcp/server-fs'] },
 *     enabled: true,
 *     createdAt: '2024-01-01T00:00:00Z',
 *     updatedAt: '2024-01-01T00:00:00Z'
 *   }
 * ];
 *
 * const promptSection = buildMcpCustomPromptsSection(configs, ['fs']);
 * // Returns:
 * // ## MCP Server Instructions
 * //
 * // ### Filesystem
 * // Use this server for file operations. Always confirm before deleting.
 * ```
 */
export function buildMcpCustomPromptsSection(
  configs: McpServerConfig[],
  enabledIds: string[]
): string {
  // Early return for empty inputs
  if (!configs || configs.length === 0 || !enabledIds || enabledIds.length === 0) {
    return '';
  }

  // Create a Set for O(1) lookup of enabled IDs
  const enabledIdSet = new Set(enabledIds);

  // Collect custom prompts from enabled servers
  const serverPrompts: Array<{ name: string; customPrompt: string }> = [];

  for (const config of configs) {
    // Only include servers that are enabled for this task AND have a custom prompt
    if (enabledIdSet.has(config.id) && config.customPrompt?.trim()) {
      serverPrompts.push({
        name: config.name,
        customPrompt: config.customPrompt.trim(),
      });
    }
  }

  // Return empty string if no custom prompts found
  if (serverPrompts.length === 0) {
    return '';
  }

  // Build the formatted section
  const lines: string[] = ['## MCP Server Instructions', ''];

  for (const { name, customPrompt } of serverPrompts) {
    lines.push(`### ${name}`);
    lines.push(customPrompt);
    lines.push('');
  }

  return lines.join('\n');
}

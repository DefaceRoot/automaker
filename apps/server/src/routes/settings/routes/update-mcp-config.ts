/**
 * PUT /api/settings/mcp-config - Update MCP server configuration from raw JSON
 *
 * Accepts a JSON string containing the MCP servers array configuration.
 * Validates the JSON structure and updates the global settings.
 * Returns the updated configuration.
 *
 * Request body: `{ config: string }` - JSON string of McpServerConfig[]
 * Response: `{ "success": true, "config": string, "servers": McpServerConfig[] }`
 */

import type { Request, Response } from 'express';
import type { SettingsService } from '../../../services/settings-service.js';
import type { McpServerConfig, StdioMcpConfig, HttpMcpConfig } from '@automaker/types';
import { getErrorMessage, logError } from '../common.js';

/**
 * Validate a single MCP server configuration
 */
function validateMcpServerConfig(server: unknown, index: number): string | null {
  if (!server || typeof server !== 'object') {
    return `Server at index ${index} must be an object`;
  }

  const s = server as Record<string, unknown>;

  // Required fields
  if (!s.id || typeof s.id !== 'string') {
    return `Server at index ${index} must have a string 'id' field`;
  }
  if (!s.name || typeof s.name !== 'string') {
    return `Server at index ${index} must have a string 'name' field`;
  }
  if (typeof s.enabled !== 'boolean') {
    return `Server at index ${index} must have a boolean 'enabled' field`;
  }

  // Transport validation
  if (!s.transport || typeof s.transport !== 'object') {
    return `Server at index ${index} must have a 'transport' object`;
  }

  const transport = s.transport as Record<string, unknown>;

  if (transport.type === 'stdio') {
    if (!transport.command || typeof transport.command !== 'string') {
      return `Server '${s.name}' (stdio) must have a string 'command' in transport`;
    }
    if (!Array.isArray(transport.args)) {
      return `Server '${s.name}' (stdio) must have an 'args' array in transport`;
    }
    // Validate args are all strings
    for (let i = 0; i < transport.args.length; i++) {
      if (typeof transport.args[i] !== 'string') {
        return `Server '${s.name}' (stdio) args[${i}] must be a string`;
      }
    }
    // Optional env validation
    if (transport.env !== undefined) {
      if (typeof transport.env !== 'object' || transport.env === null) {
        return `Server '${s.name}' (stdio) 'env' must be an object if provided`;
      }
      for (const [key, value] of Object.entries(transport.env as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          return `Server '${s.name}' (stdio) env.${key} must be a string`;
        }
      }
    }
  } else if (transport.type === 'http') {
    if (!transport.url || typeof transport.url !== 'string') {
      return `Server '${s.name}' (http) must have a string 'url' in transport`;
    }
    // Validate URL format
    try {
      new URL(transport.url);
    } catch {
      return `Server '${s.name}' (http) has an invalid URL: ${transport.url}`;
    }
    // Optional headers validation
    if (transport.headers !== undefined) {
      if (typeof transport.headers !== 'object' || transport.headers === null) {
        return `Server '${s.name}' (http) 'headers' must be an object if provided`;
      }
      for (const [key, value] of Object.entries(transport.headers as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          return `Server '${s.name}' (http) headers.${key} must be a string`;
        }
      }
    }
  } else {
    return `Server '${s.name}' has invalid transport type: ${transport.type}. Must be 'stdio' or 'http'`;
  }

  return null;
}

/**
 * Normalize a server config, adding missing fields with defaults
 */
function normalizeServerConfig(server: Record<string, unknown>): McpServerConfig {
  const now = new Date().toISOString();
  const transport = server.transport as StdioMcpConfig | HttpMcpConfig;

  return {
    id: server.id as string,
    name: server.name as string,
    description: (server.description as string) || undefined,
    transport,
    enabled: server.enabled as boolean,
    createdAt: (server.createdAt as string) || now,
    updatedAt: now,
    lastTestResult: server.lastTestResult as McpServerConfig['lastTestResult'],
  };
}

/**
 * Create handler factory for PUT /api/settings/mcp-config
 *
 * @param settingsService - Instance of SettingsService for file I/O
 * @returns Express request handler
 */
export function createUpdateMcpConfigHandler(settingsService: SettingsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { config } = req.body as { config?: string };

      if (!config || typeof config !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Request body must include a "config" string field containing JSON',
        });
        return;
      }

      // Parse the JSON
      let parsedConfig: unknown[];
      try {
        parsedConfig = JSON.parse(config);
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        res.status(400).json({
          success: false,
          error: `Invalid JSON: ${message}`,
        });
        return;
      }

      // Validate it's an array
      if (!Array.isArray(parsedConfig)) {
        res.status(400).json({
          success: false,
          error: 'MCP config must be a JSON array of server configurations',
        });
        return;
      }

      // Validate each server configuration
      for (let i = 0; i < parsedConfig.length; i++) {
        const validationError = validateMcpServerConfig(parsedConfig[i], i);
        if (validationError) {
          res.status(400).json({
            success: false,
            error: validationError,
          });
          return;
        }
      }

      // Check for duplicate IDs
      const ids = parsedConfig.map((s) => (s as { id: string }).id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        res.status(400).json({
          success: false,
          error: `Duplicate server IDs found: ${[...new Set(duplicateIds)].join(', ')}`,
        });
        return;
      }

      // Check for duplicate names
      const names = parsedConfig.map((s) => (s as { name: string }).name.toLowerCase());
      const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicateNames.length > 0) {
        res.status(400).json({
          success: false,
          error: `Duplicate server names found: ${[...new Set(duplicateNames)].join(', ')}`,
        });
        return;
      }

      // Normalize the configurations
      const normalizedServers = parsedConfig.map((s) =>
        normalizeServerConfig(s as Record<string, unknown>)
      );

      // Update the global settings with the new MCP servers
      const settings = await settingsService.updateGlobalSettings({
        mcpServers: normalizedServers,
      });

      res.json({
        success: true,
        config: JSON.stringify(settings.mcpServers, null, 2),
        servers: settings.mcpServers,
      });
    } catch (error) {
      logError(error, 'Update MCP config failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

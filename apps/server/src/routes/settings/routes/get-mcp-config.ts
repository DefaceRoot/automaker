/**
 * GET /api/settings/mcp-config - Retrieve raw MCP server configuration JSON
 *
 * Returns the raw MCP servers array from global settings as a JSON string.
 * This allows users to view, copy, and edit the entire MCP configuration.
 *
 * Response: `{ "success": true, "config": string, "servers": McpServerConfig[] }`
 */

import type { Request, Response } from 'express';
import type { SettingsService } from '../../../services/settings-service.js';
import { getErrorMessage, logError } from '../common.js';

/**
 * Create handler factory for GET /api/settings/mcp-config
 *
 * @param settingsService - Instance of SettingsService for file I/O
 * @returns Express request handler
 */
export function createGetMcpConfigHandler(settingsService: SettingsService) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings = await settingsService.getGlobalSettings();
      const mcpServers = settings.mcpServers || [];

      // Return both the raw JSON string (for editing) and parsed array (for display)
      res.json({
        success: true,
        config: JSON.stringify(mcpServers, null, 2),
        servers: mcpServers,
      });
    } catch (error) {
      logError(error, 'Get MCP config failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

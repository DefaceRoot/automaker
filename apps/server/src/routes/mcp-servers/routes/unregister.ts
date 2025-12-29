/**
 * POST /api/mcp-servers/unregister - Unregister an MCP server
 *
 * Removes an MCP server configuration from a project.
 *
 * Request body: { projectPath: string, serverId: string }
 * Response: { success: true } or { success: false, error: string }
 */

import type { Request, Response } from 'express';
import type { MCPServerService } from '../../../services/mcp-server-service.js';
import { getErrorMessage, logError } from '../common.js';

/**
 * Create handler for POST /api/mcp-servers/unregister
 *
 * @param mcpServerService - Instance of MCPServerService
 * @returns Express request handler
 */
export function createUnregisterServerHandler(mcpServerService: MCPServerService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, serverId } = req.body;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      if (!serverId || typeof serverId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'serverId is required and must be a string',
        });
        return;
      }

      const result = await mcpServerService.unregisterServer(projectPath, serverId);

      if (result) {
        res.json({
          success: true,
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Server "${serverId}" not found`,
        });
      }
    } catch (error) {
      logError(error, 'Unregister MCP server failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /api/mcp-servers/get - Get a specific MCP server by ID
 *
 * Returns the configuration and current state of a specific MCP server.
 *
 * Request body: { projectPath: string, serverId: string }
 * Response: { success: true, server: MCPServerState } or { success: false, error: string }
 */

import type { Request, Response } from 'express';
import type { MCPServerService } from '../../../services/mcp-server-service.js';
import { getErrorMessage, logError } from '../common.js';

/**
 * Create handler for POST /api/mcp-servers/get
 *
 * @param mcpServerService - Instance of MCPServerService
 * @returns Express request handler
 */
export function createGetServerHandler(mcpServerService: MCPServerService) {
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

      const server = await mcpServerService.getServer(projectPath, serverId);

      if (server) {
        // Also get state if available
        const state = mcpServerService.getServerState(projectPath, serverId);

        res.json({
          success: true,
          server: state || {
            config: server,
            status: 'stopped',
          },
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Server "${serverId}" not found`,
        });
      }
    } catch (error) {
      logError(error, 'Get MCP server failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

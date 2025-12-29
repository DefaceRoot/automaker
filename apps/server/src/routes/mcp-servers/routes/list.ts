/**
 * POST /api/mcp-servers/list - List all MCP servers for a project
 *
 * Returns the list of configured MCP servers along with their current states.
 *
 * Request body: { projectPath: string }
 * Response: { success: true, servers: MCPServerState[] }
 */

import type { Request, Response } from 'express';
import type { MCPServerService } from '../../../services/mcp-server-service.js';
import { getErrorMessage, logError } from '../common.js';

/**
 * Create handler for POST /api/mcp-servers/list
 *
 * @param mcpServerService - Instance of MCPServerService
 * @returns Express request handler
 */
export function createListServersHandler(mcpServerService: MCPServerService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath } = req.body;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const servers = await mcpServerService.getAllServerStates(projectPath);

      res.json({
        success: true,
        servers,
      });
    } catch (error) {
      logError(error, 'List MCP servers failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

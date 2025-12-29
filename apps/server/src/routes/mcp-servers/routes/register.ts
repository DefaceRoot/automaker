/**
 * POST /api/mcp-servers/register - Register a new MCP server
 *
 * Registers a new MCP server configuration for a project.
 *
 * Request body: { projectPath: string, server: MCPServerConfig }
 * Response: { success: true, serverId: string } or { success: false, error: string }
 */

import type { Request, Response } from 'express';
import type { MCPServerService } from '../../../services/mcp-server-service.js';
import type { MCPServerConfig } from '@automaker/types';
import { getErrorMessage, logError } from '../common.js';

/**
 * Validate server configuration
 */
function validateServerConfig(server: unknown): { valid: boolean; error?: string } {
  if (!server || typeof server !== 'object') {
    return { valid: false, error: 'server configuration is required' };
  }

  const config = server as Partial<MCPServerConfig>;

  if (!config.id || typeof config.id !== 'string') {
    return { valid: false, error: 'server.id is required and must be a string' };
  }

  if (!config.name || typeof config.name !== 'string') {
    return { valid: false, error: 'server.name is required and must be a string' };
  }

  if (!config.transport || !['stdio', 'sse'].includes(config.transport)) {
    return { valid: false, error: 'server.transport must be "stdio" or "sse"' };
  }

  if (config.transport === 'stdio' && !config.command) {
    return { valid: false, error: 'server.command is required for stdio transport' };
  }

  if (config.transport === 'sse' && !config.url) {
    return { valid: false, error: 'server.url is required for sse transport' };
  }

  if (typeof config.enabled !== 'boolean') {
    return { valid: false, error: 'server.enabled must be a boolean' };
  }

  return { valid: true };
}

/**
 * Create handler for POST /api/mcp-servers/register
 *
 * @param mcpServerService - Instance of MCPServerService
 * @returns Express request handler
 */
export function createRegisterServerHandler(mcpServerService: MCPServerService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, server } = req.body;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const validation = validateServerConfig(server);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error,
        });
        return;
      }

      const result = await mcpServerService.registerServer(projectPath, server as MCPServerConfig);

      if (result.success) {
        res.json({
          success: true,
          serverId: result.serverId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logError(error, 'Register MCP server failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

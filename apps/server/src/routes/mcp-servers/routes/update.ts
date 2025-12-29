/**
 * POST /api/mcp-servers/update - Update an MCP server configuration
 *
 * Updates an existing MCP server configuration for a project.
 *
 * Request body: { projectPath: string, serverId: string, updates: Partial<MCPServerConfig> }
 * Response: { success: true } or { success: false, error: string }
 */

import type { Request, Response } from 'express';
import type { MCPServerService } from '../../../services/mcp-server-service.js';
import type { MCPServerConfig } from '@automaker/types';
import { getErrorMessage, logError } from '../common.js';

/**
 * Validate update fields
 */
function validateUpdates(updates: unknown): { valid: boolean; error?: string } {
  if (!updates || typeof updates !== 'object') {
    return { valid: false, error: 'updates object is required' };
  }

  const config = updates as Partial<MCPServerConfig>;

  // Prevent ID changes via update
  if ('id' in config && config.id !== undefined) {
    return { valid: false, error: 'Server ID cannot be changed via update' };
  }

  // Validate transport if provided
  if (config.transport && !['stdio', 'sse'].includes(config.transport)) {
    return { valid: false, error: 'transport must be "stdio" or "sse"' };
  }

  // Validate enabled if provided
  if ('enabled' in config && typeof config.enabled !== 'boolean') {
    return { valid: false, error: 'enabled must be a boolean' };
  }

  return { valid: true };
}

/**
 * Create handler for POST /api/mcp-servers/update
 *
 * @param mcpServerService - Instance of MCPServerService
 * @returns Express request handler
 */
export function createUpdateServerHandler(mcpServerService: MCPServerService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, serverId, updates } = req.body;

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

      const validation = validateUpdates(updates);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error,
        });
        return;
      }

      const result = await mcpServerService.updateServer(
        projectPath,
        serverId,
        updates as Partial<MCPServerConfig>
      );

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
      logError(error, 'Update MCP server failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

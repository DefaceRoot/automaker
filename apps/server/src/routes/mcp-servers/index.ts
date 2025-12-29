/**
 * MCP Servers routes - HTTP API for MCP server management
 *
 * Provides endpoints for:
 * - Listing all configured MCP servers for a project
 * - Getting a specific MCP server configuration
 * - Registering new MCP servers
 * - Updating existing MCP server configurations
 * - Unregistering (removing) MCP servers
 *
 * All endpoints use handler factories that receive the MCPServerService instance.
 * Mounted at /api/mcp-servers in the main server.
 */

import { Router } from 'express';
import type { MCPServerService } from '../../services/mcp-server-service.js';
import { validatePathParams } from '../../middleware/validate-paths.js';
import { createListServersHandler } from './routes/list.js';
import { createGetServerHandler } from './routes/get.js';
import { createRegisterServerHandler } from './routes/register.js';
import { createUpdateServerHandler } from './routes/update.js';
import { createUnregisterServerHandler } from './routes/unregister.js';

/**
 * Create MCP servers router with all endpoints
 *
 * Registers handlers for all MCP server-related HTTP endpoints.
 * Each handler is created with the provided MCPServerService instance.
 *
 * Endpoints:
 * - POST /list - List all MCP servers for a project
 * - POST /get - Get a specific MCP server by ID
 * - POST /register - Register a new MCP server
 * - POST /update - Update an existing MCP server configuration
 * - POST /unregister - Remove an MCP server
 *
 * Note: All endpoints use POST to allow projectPath in request body
 * for consistent security validation.
 *
 * @param mcpServerService - Instance of MCPServerService for server management
 * @returns Express Router configured with all MCP server endpoints
 */
export function createMcpServersRoutes(mcpServerService: MCPServerService): Router {
  const router = Router();

  // List all servers for a project
  router.post(
    '/list',
    validatePathParams('projectPath'),
    createListServersHandler(mcpServerService)
  );

  // Get a specific server
  router.post('/get', validatePathParams('projectPath'), createGetServerHandler(mcpServerService));

  // Register a new server
  router.post(
    '/register',
    validatePathParams('projectPath'),
    createRegisterServerHandler(mcpServerService)
  );

  // Update an existing server
  router.post(
    '/update',
    validatePathParams('projectPath'),
    createUpdateServerHandler(mcpServerService)
  );

  // Unregister (remove) a server
  router.post(
    '/unregister',
    validatePathParams('projectPath'),
    createUnregisterServerHandler(mcpServerService)
  );

  return router;
}

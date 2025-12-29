/**
 * MCP Server Service - Manages MCP (Model Context Protocol) server lifecycle
 *
 * Provides:
 * - Server registration and configuration management
 * - Server initialization and shutdown
 * - Server state tracking
 * - Integration with task execution
 *
 * MCP servers provide additional tools and resources that can be
 * injected into agent tasks for extended functionality.
 *
 * @see https://modelcontextprotocol.io
 */

import path from 'path';
import { createLogger } from '@automaker/utils';
import { getAutomakerDir } from '@automaker/platform';
import * as secureFs from '../lib/secure-fs.js';
import type { EventEmitter } from '../lib/events.js';
import type {
  MCPServerConfig,
  MCPServerState,
  MCPServerStatus,
  MCPServersConfiguration,
  MCPServerRegistrationResult,
  MCPServerEventPayload,
} from '@automaker/types';
import { DEFAULT_MCP_SERVERS_CONFIGURATION, MCP_SERVERS_CONFIG_VERSION } from '@automaker/types';

const logger = createLogger('MCPServerService');

/**
 * Atomic file write - write to temp file then rename
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  const content = JSON.stringify(data, null, 2);

  try {
    await secureFs.writeFile(tempPath, content, 'utf-8');
    await secureFs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await secureFs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Safely read JSON file with fallback to default
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = (await secureFs.readFile(filePath, 'utf-8')) as string;
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }
    logger.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

/**
 * Get the MCP servers configuration file path for a project
 */
function getMcpServersConfigPath(projectPath: string): string {
  return path.join(getAutomakerDir(projectPath), 'mcp-servers.json');
}

/**
 * MCPServerService - Manages MCP server lifecycle and configuration
 *
 * This service provides the foundation for MCP server integration:
 * - Server configuration management (register, update, remove)
 * - Server state tracking (running, stopped, error)
 * - Event emission for server lifecycle changes
 *
 * Future enhancements will add:
 * - Actual server process management (spawn, kill)
 * - Server tool/resource discovery
 * - Connection health monitoring
 */
export class MCPServerService {
  private events: EventEmitter;

  /**
   * In-memory cache of server states per project
   * Key: projectPath, Value: Map of serverId -> MCPServerState
   */
  private serverStates = new Map<string, Map<string, MCPServerState>>();

  /**
   * Create a new MCPServerService instance
   *
   * @param events - Event emitter for lifecycle events
   */
  constructor(events: EventEmitter) {
    this.events = events;
  }

  /**
   * Initialize the service
   * Currently a no-op, but can be used for startup tasks in the future
   */
  async initialize(): Promise<void> {
    logger.info('MCPServerService initialized');
  }

  /**
   * Get MCP servers configuration for a project
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Promise resolving to the MCP servers configuration
   */
  async getConfiguration(projectPath: string): Promise<MCPServersConfiguration> {
    const configPath = getMcpServersConfigPath(projectPath);
    const config = await readJsonFile<MCPServersConfiguration>(
      configPath,
      DEFAULT_MCP_SERVERS_CONFIGURATION
    );

    // Apply defaults for any missing fields (forward compatibility)
    return {
      ...DEFAULT_MCP_SERVERS_CONFIGURATION,
      ...config,
      version: config.version || MCP_SERVERS_CONFIG_VERSION,
    };
  }

  /**
   * Save MCP servers configuration for a project
   *
   * @param projectPath - Absolute path to the project directory
   * @param config - Configuration to save
   */
  async saveConfiguration(projectPath: string, config: MCPServersConfiguration): Promise<void> {
    const configPath = getMcpServersConfigPath(projectPath);
    const automakerDir = getAutomakerDir(projectPath);

    // Ensure .automaker directory exists
    await secureFs.mkdir(automakerDir, { recursive: true });

    // Save with current version
    const configToSave: MCPServersConfiguration = {
      ...config,
      version: MCP_SERVERS_CONFIG_VERSION,
    };

    await atomicWriteJson(configPath, configToSave);
    logger.info(`Saved MCP servers configuration for ${projectPath}`);
  }

  /**
   * Register a new MCP server for a project
   *
   * @param projectPath - Absolute path to the project directory
   * @param serverConfig - Server configuration to register
   * @returns Promise resolving to registration result
   */
  async registerServer(
    projectPath: string,
    serverConfig: MCPServerConfig
  ): Promise<MCPServerRegistrationResult> {
    try {
      const config = await this.getConfiguration(projectPath);

      // Check if server with same ID already exists
      const existingIndex = config.servers.findIndex((s) => s.id === serverConfig.id);
      if (existingIndex >= 0) {
        return {
          success: false,
          error: `Server with ID "${serverConfig.id}" already exists`,
        };
      }

      // Add the new server
      config.servers.push(serverConfig);
      await this.saveConfiguration(projectPath, config);

      // Initialize server state
      this.initializeServerState(projectPath, serverConfig);

      // Emit event
      this.emitServerEvent({
        type: 'mcp:server:registered',
        serverId: serverConfig.id,
        serverName: serverConfig.name,
      });

      logger.info(`Registered MCP server "${serverConfig.name}" (${serverConfig.id})`);

      return {
        success: true,
        serverId: serverConfig.id,
      };
    } catch (error) {
      logger.error(`Failed to register MCP server:`, error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Update an existing MCP server configuration
   *
   * @param projectPath - Absolute path to the project directory
   * @param serverId - ID of the server to update
   * @param updates - Partial configuration updates
   * @returns Promise resolving to true if successful
   */
  async updateServer(
    projectPath: string,
    serverId: string,
    updates: Partial<MCPServerConfig>
  ): Promise<boolean> {
    try {
      const config = await this.getConfiguration(projectPath);

      const serverIndex = config.servers.findIndex((s) => s.id === serverId);
      if (serverIndex < 0) {
        logger.warn(`Server "${serverId}" not found for update`);
        return false;
      }

      // Apply updates (preserve ID)
      config.servers[serverIndex] = {
        ...config.servers[serverIndex],
        ...updates,
        id: serverId, // Ensure ID cannot be changed
      };

      await this.saveConfiguration(projectPath, config);

      // Update state if exists
      const projectStates = this.serverStates.get(projectPath);
      if (projectStates?.has(serverId)) {
        const state = projectStates.get(serverId)!;
        state.config = config.servers[serverIndex];
      }

      logger.info(`Updated MCP server "${serverId}"`);
      return true;
    } catch (error) {
      logger.error(`Failed to update MCP server "${serverId}":`, error);
      return false;
    }
  }

  /**
   * Unregister (remove) an MCP server from a project
   *
   * @param projectPath - Absolute path to the project directory
   * @param serverId - ID of the server to remove
   * @returns Promise resolving to true if successful
   */
  async unregisterServer(projectPath: string, serverId: string): Promise<boolean> {
    try {
      const config = await this.getConfiguration(projectPath);

      const serverIndex = config.servers.findIndex((s) => s.id === serverId);
      if (serverIndex < 0) {
        logger.warn(`Server "${serverId}" not found for removal`);
        return false;
      }

      const serverName = config.servers[serverIndex].name;

      // Remove from configuration
      config.servers.splice(serverIndex, 1);
      await this.saveConfiguration(projectPath, config);

      // Remove from state cache
      const projectStates = this.serverStates.get(projectPath);
      if (projectStates) {
        projectStates.delete(serverId);
        if (projectStates.size === 0) {
          this.serverStates.delete(projectPath);
        }
      }

      // Emit event
      this.emitServerEvent({
        type: 'mcp:server:unregistered',
        serverId,
        serverName,
      });

      logger.info(`Unregistered MCP server "${serverName}" (${serverId})`);
      return true;
    } catch (error) {
      logger.error(`Failed to unregister MCP server "${serverId}":`, error);
      return false;
    }
  }

  /**
   * Get all registered servers for a project
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Promise resolving to array of server configurations
   */
  async getServers(projectPath: string): Promise<MCPServerConfig[]> {
    const config = await this.getConfiguration(projectPath);
    return config.servers;
  }

  /**
   * Get a specific server by ID
   *
   * @param projectPath - Absolute path to the project directory
   * @param serverId - ID of the server to get
   * @returns Promise resolving to server configuration or null if not found
   */
  async getServer(projectPath: string, serverId: string): Promise<MCPServerConfig | null> {
    const servers = await this.getServers(projectPath);
    return servers.find((s) => s.id === serverId) || null;
  }

  /**
   * Get the current state of a server
   *
   * @param projectPath - Absolute path to the project directory
   * @param serverId - ID of the server
   * @returns Server state or null if not initialized
   */
  getServerState(projectPath: string, serverId: string): MCPServerState | null {
    const projectStates = this.serverStates.get(projectPath);
    return projectStates?.get(serverId) || null;
  }

  /**
   * Get states of all servers for a project
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Array of server states
   */
  async getAllServerStates(projectPath: string): Promise<MCPServerState[]> {
    // Ensure all servers have initialized states
    const servers = await this.getServers(projectPath);
    const states: MCPServerState[] = [];

    for (const server of servers) {
      let state = this.getServerState(projectPath, server.id);
      if (!state) {
        state = this.initializeServerState(projectPath, server);
      }
      states.push(state);
    }

    return states;
  }

  /**
   * Get enabled servers for a project (for injection into tasks)
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Promise resolving to array of enabled server configurations
   */
  async getEnabledServers(projectPath: string): Promise<MCPServerConfig[]> {
    const servers = await this.getServers(projectPath);
    return servers.filter((s) => s.enabled);
  }

  /**
   * Build MCP servers configuration for Claude Agent SDK
   *
   * This method transforms our server configurations into the format
   * expected by the Claude Agent SDK's mcpServers option.
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Promise resolving to SDK-compatible mcpServers configuration
   */
  async buildSdkMcpServersConfig(
    projectPath: string
  ): Promise<Record<string, unknown> | undefined> {
    const enabledServers = await this.getEnabledServers(projectPath);

    if (enabledServers.length === 0) {
      return undefined;
    }

    const mcpServers: Record<string, unknown> = {};

    for (const server of enabledServers) {
      if (server.transport === 'stdio') {
        // Stdio transport configuration
        mcpServers[server.id] = {
          command: server.command,
          args: server.args || [],
          env: server.env || {},
        };
      } else if (server.transport === 'sse') {
        // SSE transport configuration
        mcpServers[server.id] = {
          url: server.url,
        };
      }
    }

    return Object.keys(mcpServers).length > 0 ? mcpServers : undefined;
  }

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    // Future: Stop all running server processes
    this.serverStates.clear();
    logger.info('MCPServerService cleaned up');
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Initialize server state in the cache
   */
  private initializeServerState(projectPath: string, config: MCPServerConfig): MCPServerState {
    if (!this.serverStates.has(projectPath)) {
      this.serverStates.set(projectPath, new Map());
    }

    const state: MCPServerState = {
      config,
      status: 'stopped',
    };

    this.serverStates.get(projectPath)!.set(config.id, state);
    return state;
  }

  /**
   * Update server status in the cache
   */
  private updateServerStatus(
    projectPath: string,
    serverId: string,
    status: MCPServerStatus,
    error?: string
  ): void {
    const projectStates = this.serverStates.get(projectPath);
    if (!projectStates) return;

    const state = projectStates.get(serverId);
    if (!state) return;

    state.status = status;
    state.error = error;

    if (status === 'running') {
      state.startedAt = new Date().toISOString();
      state.stoppedAt = undefined;
    } else if (status === 'stopped') {
      state.stoppedAt = new Date().toISOString();
    }
  }

  /**
   * Emit an MCP server event
   */
  private emitServerEvent(payload: MCPServerEventPayload): void {
    this.events.emit('mcp-server:event', payload);
  }
}

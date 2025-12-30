/**
 * MCP Server Manager Service
 *
 * Provides lifecycle management for MCP (Model Context Protocol) server connections.
 * This service handles:
 * - Server initialization and connection
 * - Connection caching and reuse
 * - Graceful shutdown and cleanup
 * - Health monitoring and reconnection
 * - Tool discovery and caching
 *
 * Architecture:
 * - Each MCP server has a unique ID and configuration
 * - Connections are cached to avoid repeated connection overhead
 * - Failed connections are tracked with retry limits
 * - Graceful shutdown ensures all connections are properly closed
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig, StdioMcpConfig, HttpMcpConfig, McpToolInfo } from '@automaker/types';
import { createLogger } from '@automaker/utils';

/** Type for HTTP-based MCP transports */
type HttpMcpTransport = StreamableHTTPClientTransport | SSEClientTransport;

const logger = createLogger('mcp-server-manager');

/**
 * Additional Windows environment variables that the MCP SDK's default list is missing.
 * These are critical for proper command resolution on Windows.
 *
 * The MCP SDK's StdioClientTransport only inherits a limited set of env vars on Windows:
 * APPDATA, HOMEDRIVE, HOMEPATH, LOCALAPPDATA, PATH, PROCESSOR_ARCHITECTURE,
 * SYSTEMDRIVE, SYSTEMROOT, TEMP, USERNAME, USERPROFILE, PROGRAMFILES
 *
 * Missing critically:
 * - PATHEXT: Needed for Windows to resolve .cmd, .bat, .exe, etc. (used by npx, npm, etc.)
 * - COMSPEC: Path to cmd.exe (some tools need this)
 */
const WINDOWS_EXTRA_ENV_VARS = ['PATHEXT', 'COMSPEC'];

/**
 * Get additional Windows environment variables that should be passed to stdio transports.
 * These are merged with the user-provided env and the SDK's default env.
 */
function getWindowsExtraEnv(): Record<string, string> {
  if (process.platform !== 'win32') {
    return {};
  }

  const extraEnv: Record<string, string> = {};
  for (const key of WINDOWS_EXTRA_ENV_VARS) {
    const value = process.env[key];
    if (value) {
      extraEnv[key] = value;
    }
  }
  return extraEnv;
}

/** Connection states for tracking server lifecycle */
export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'closing';

/**
 * Information about an active MCP server connection
 */
export interface McpServerConnection {
  /** Unique server ID */
  id: string;
  /** Server configuration */
  config: McpServerConfig;
  /** MCP client instance */
  client: Client;
  /** Transport layer (stdio, SSE, or Streamable HTTP) */
  transport: StdioClientTransport | HttpMcpTransport;
  /** Current connection state */
  state: McpConnectionState;
  /** Timestamp of last connection attempt */
  lastConnectionAttempt: Date;
  /** Number of consecutive connection failures */
  failureCount: number;
  /** Cached list of tools from the server */
  tools?: McpToolInfo[];
  /** Server information from handshake */
  serverInfo?: {
    name: string;
    version: string;
  };
  /** Error message from last failed connection */
  lastError?: string;
}

/**
 * Options for connecting to an MCP server
 */
export interface McpConnectOptions {
  /** Timeout in milliseconds for connection attempt */
  timeoutMs?: number;
  /** Whether to force reconnection even if already connected */
  forceReconnect?: boolean;
  /** Whether to cache tools on successful connection */
  cacheTools?: boolean;
}

/**
 * Result of a connection attempt
 */
export interface McpConnectResult {
  /** Whether the connection was successful */
  success: boolean;
  /** Server ID */
  serverId: string;
  /** Connection state after attempt */
  state: McpConnectionState;
  /** Available tools if connection succeeded */
  tools?: McpToolInfo[];
  /** Server information if connection succeeded */
  serverInfo?: { name: string; version: string };
  /** Error message if connection failed */
  error?: string;
  /** Time taken for connection in milliseconds */
  latencyMs: number;
}

/**
 * Options for the MCP Server Manager
 */
export interface McpServerManagerOptions {
  /** Default connection timeout in milliseconds */
  defaultTimeoutMs?: number;
  /** Maximum number of consecutive failures before giving up */
  maxFailureCount?: number;
  /** Whether to automatically reconnect on failure */
  autoReconnect?: boolean;
}

/** Default connection timeout (10 seconds) */
const DEFAULT_TIMEOUT_MS = 10000;
/** Maximum number of consecutive failures before giving up */
const DEFAULT_MAX_FAILURES = 3;

/**
 * MCP Server Manager Service
 *
 * Manages the lifecycle of MCP server connections, including initialization,
 * connection caching, health monitoring, and graceful shutdown.
 *
 * @example
 * ```typescript
 * const manager = new McpServerManager();
 *
 * // Connect to a server
 * const result = await manager.connect(serverConfig);
 * if (result.success) {
 *   console.log(`Connected to ${result.serverId} with ${result.tools?.length} tools`);
 * }
 *
 * // Get a connected server
 * const connection = manager.getConnection(serverId);
 *
 * // Disconnect all servers on shutdown
 * await manager.disconnectAll();
 * ```
 */
export class McpServerManager {
  /** Map of server ID to connection */
  private connections: Map<string, McpServerConnection> = new Map();

  /** Manager options */
  private options: Required<McpServerManagerOptions>;

  /** Whether the manager is shutting down */
  private isShuttingDown: boolean = false;

  /**
   * Create a new MCP Server Manager
   *
   * @param options - Manager configuration options
   */
  constructor(options: McpServerManagerOptions = {}) {
    this.options = {
      defaultTimeoutMs: options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxFailureCount: options.maxFailureCount ?? DEFAULT_MAX_FAILURES,
      autoReconnect: options.autoReconnect ?? false,
    };

    logger.info('MCP Server Manager initialized');
  }

  /**
   * Connect to an MCP server
   *
   * If already connected and forceReconnect is false, returns the cached connection.
   * Otherwise, establishes a new connection to the server.
   *
   * @param config - MCP server configuration
   * @param options - Connection options
   * @returns Connection result with success status and server info
   */
  async connect(
    config: McpServerConfig,
    options: McpConnectOptions = {}
  ): Promise<McpConnectResult> {
    const startTime = Date.now();
    const serverId = config.id;
    const timeoutMs = options.timeoutMs ?? this.options.defaultTimeoutMs;
    const forceReconnect = options.forceReconnect ?? false;
    const cacheTools = options.cacheTools ?? true;

    // Check if shutting down
    if (this.isShuttingDown) {
      return {
        success: false,
        serverId,
        state: 'disconnected',
        error: 'Manager is shutting down',
        latencyMs: Date.now() - startTime,
      };
    }

    // Check for existing connection
    const existing = this.connections.get(serverId);
    if (existing && existing.state === 'connected' && !forceReconnect) {
      logger.debug(`Using cached connection for ${config.name} (${serverId})`);
      return {
        success: true,
        serverId,
        state: 'connected',
        tools: existing.tools,
        serverInfo: existing.serverInfo,
        latencyMs: Date.now() - startTime,
      };
    }

    // Check failure count
    if (existing && existing.failureCount >= this.options.maxFailureCount && !forceReconnect) {
      logger.warn(
        `Server ${config.name} (${serverId}) has exceeded max failure count (${existing.failureCount})`
      );
      return {
        success: false,
        serverId,
        state: 'failed',
        error: `Exceeded max failure count (${existing.failureCount})`,
        latencyMs: Date.now() - startTime,
      };
    }

    // Disconnect existing if forcing reconnect
    if (existing && forceReconnect) {
      await this.disconnect(serverId);
    }

    logger.info(`Connecting to MCP server: ${config.name} (${serverId})`);

    let client: Client | null = null;
    let transport: StdioClientTransport | HttpMcpTransport | null = null;

    try {
      // Handle stdio transport differently from HTTP
      if (config.transport.type === 'stdio') {
        // Create stdio transport
        const stdioConfig = config.transport as StdioMcpConfig;
        logger.debug(
          `Creating stdio transport: ${stdioConfig.command} ${stdioConfig.args.join(' ')}`
        );

        // Merge Windows-specific env vars with user-provided env
        // This ensures PATHEXT and COMSPEC are available for proper command resolution
        const envWithWindowsVars = {
          ...getWindowsExtraEnv(),
          ...stdioConfig.env,
        };

        transport = new StdioClientTransport({
          command: stdioConfig.command,
          args: stdioConfig.args,
          env: Object.keys(envWithWindowsVars).length > 0 ? envWithWindowsVars : undefined,
        });

        // Create client
        client = new Client(
          {
            name: 'automaker-mcp-manager',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        // Update connection state
        const connection: McpServerConnection = {
          id: serverId,
          config,
          client,
          transport,
          state: 'connecting',
          lastConnectionAttempt: new Date(),
          failureCount: existing?.failureCount ?? 0,
        };
        this.connections.set(serverId, connection);

        // Connect with timeout
        const connectPromise = client.connect(transport);
        const connectTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
        });

        await Promise.race([connectPromise, connectTimeout]);
      } else {
        // For HTTP transport, try Streamable HTTP first, then fall back to SSE
        const httpConfig = config.transport as HttpMcpConfig;
        const url = new URL(httpConfig.url);
        const requestInit = httpConfig.headers ? { headers: httpConfig.headers } : undefined;

        // Create client first
        client = new Client(
          {
            name: 'automaker-mcp-manager',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        // Try Streamable HTTP transport first (modern servers)
        logger.debug(`Trying Streamable HTTP transport: ${httpConfig.url}`);
        transport = new StreamableHTTPClientTransport(url, { requestInit });

        // Update connection state
        const connection: McpServerConnection = {
          id: serverId,
          config,
          client,
          transport,
          state: 'connecting',
          lastConnectionAttempt: new Date(),
          failureCount: existing?.failureCount ?? 0,
        };
        this.connections.set(serverId, connection);

        try {
          const connectPromise = client.connect(transport);
          const connectTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
          });

          await Promise.race([connectPromise, connectTimeout]);
          logger.info(`Connected via Streamable HTTP transport: ${config.name}`);
        } catch (streamableError) {
          // Check if it's a 4xx error indicating the server doesn't support Streamable HTTP
          const errorMessage =
            streamableError instanceof Error ? streamableError.message : String(streamableError);
          const is4xxError =
            errorMessage.includes('405') ||
            errorMessage.includes('404') ||
            errorMessage.includes('400') ||
            errorMessage.includes('4');

          if (is4xxError || errorMessage.includes('SSE') || errorMessage.includes('sse')) {
            // Try to clean up the failed transport
            try {
              await client.close();
            } catch {
              // Ignore cleanup errors
            }

            // Fall back to SSE transport (legacy servers)
            logger.debug(
              `Streamable HTTP failed, falling back to SSE transport: ${httpConfig.url}`
            );
            transport = new SSEClientTransport(url, { requestInit });

            // Create a new client for SSE
            client = new Client(
              {
                name: 'automaker-mcp-manager',
                version: '1.0.0',
              },
              {
                capabilities: {},
              }
            );

            // Update connection with new client/transport
            connection.client = client;
            connection.transport = transport;

            const sseConnectPromise = client.connect(transport);
            const sseConnectTimeout = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
            });

            await Promise.race([sseConnectPromise, sseConnectTimeout]);
            logger.info(`Connected via SSE transport (fallback): ${config.name}`);
          } else {
            // Re-throw if it's not a transport compatibility issue
            throw streamableError;
          }
        }
      }

      // Get the connection from the map (it was set in the if/else blocks above)
      const connection = this.connections.get(serverId)!;

      // Get server info
      const serverInfo = client.getServerVersion();
      connection.serverInfo = serverInfo
        ? { name: serverInfo.name, version: serverInfo.version }
        : undefined;

      // Get tools if requested
      let tools: McpToolInfo[] = [];
      if (cacheTools) {
        try {
          const toolsResponse = await client.listTools();
          tools = toolsResponse.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as object | undefined,
          }));
          connection.tools = tools;
        } catch (toolsError) {
          logger.debug(`Could not list tools for ${config.name}: ${toolsError}`);
        }
      }

      // Update connection state to connected
      connection.state = 'connected';
      connection.failureCount = 0;
      connection.lastError = undefined;

      const latencyMs = Date.now() - startTime;
      logger.info(
        `Connected to MCP server ${config.name} (${serverId}) in ${latencyMs}ms with ${tools.length} tools`
      );

      return {
        success: true,
        serverId,
        state: 'connected',
        tools,
        serverInfo: connection.serverInfo,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Failed to connect to MCP server ${config.name}: ${errorMessage}`);

      // Update or create failed connection entry
      const failedConnection: McpServerConnection = {
        id: serverId,
        config,
        client: client!,
        transport: transport!,
        state: 'failed',
        lastConnectionAttempt: new Date(),
        failureCount: (existing?.failureCount ?? 0) + 1,
        lastError: errorMessage,
      };
      this.connections.set(serverId, failedConnection);

      // Try to clean up
      try {
        if (client) {
          await client.close();
        }
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        serverId,
        state: 'failed',
        error: errorMessage,
        latencyMs,
      };
    }
  }

  /**
   * Connect to multiple MCP servers in parallel
   *
   * @param configs - Array of server configurations
   * @param options - Connection options for all servers
   * @returns Map of server ID to connection result
   */
  async connectMultiple(
    configs: McpServerConfig[],
    options: McpConnectOptions = {}
  ): Promise<Map<string, McpConnectResult>> {
    logger.info(`Connecting to ${configs.length} MCP servers...`);

    const results = new Map<string, McpConnectResult>();

    // Connect in parallel
    const connectPromises = configs.map(async (config) => {
      const result = await this.connect(config, options);
      return { id: config.id, result };
    });

    const connectResults = await Promise.all(connectPromises);

    for (const { id, result } of connectResults) {
      results.set(id, result);
    }

    const successCount = Array.from(results.values()).filter((r) => r.success).length;
    logger.info(`Connected to ${successCount}/${configs.length} MCP servers`);

    return results;
  }

  /**
   * Disconnect from an MCP server
   *
   * @param serverId - ID of the server to disconnect
   * @returns true if disconnected successfully, false if not found
   */
  async disconnect(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      logger.debug(`Server ${serverId} not found for disconnect`);
      return false;
    }

    logger.info(`Disconnecting from MCP server: ${connection.config.name} (${serverId})`);

    connection.state = 'closing';

    try {
      await connection.client.close();
    } catch (error) {
      logger.warn(`Error closing connection to ${serverId}: ${error}`);
    }

    this.connections.delete(serverId);
    logger.info(`Disconnected from MCP server: ${connection.config.name} (${serverId})`);

    return true;
  }

  /**
   * Disconnect from all MCP servers
   *
   * Used during graceful shutdown to ensure all connections are properly closed.
   */
  async disconnectAll(): Promise<void> {
    this.isShuttingDown = true;

    const serverIds = Array.from(this.connections.keys());
    logger.info(`Disconnecting from ${serverIds.length} MCP servers...`);

    await Promise.all(serverIds.map((id) => this.disconnect(id)));

    logger.info('All MCP servers disconnected');
    this.isShuttingDown = false;
  }

  /**
   * Get a connection by server ID
   *
   * @param serverId - ID of the server
   * @returns Connection info or undefined if not found
   */
  getConnection(serverId: string): McpServerConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Get all active connections
   *
   * @returns Map of server ID to connection
   */
  getAllConnections(): Map<string, McpServerConnection> {
    return new Map(this.connections);
  }

  /**
   * Get connection state for a server
   *
   * @param serverId - ID of the server
   * @returns Connection state or 'disconnected' if not found
   */
  getConnectionState(serverId: string): McpConnectionState {
    return this.connections.get(serverId)?.state ?? 'disconnected';
  }

  /**
   * Get cached tools for a connected server
   *
   * @param serverId - ID of the server
   * @returns Array of tools or undefined if not connected/cached
   */
  getCachedTools(serverId: string): McpToolInfo[] | undefined {
    const connection = this.connections.get(serverId);
    if (connection?.state === 'connected') {
      return connection.tools;
    }
    return undefined;
  }

  /**
   * Refresh tools for a connected server
   *
   * @param serverId - ID of the server
   * @returns Updated list of tools or undefined if not connected
   */
  async refreshTools(serverId: string): Promise<McpToolInfo[] | undefined> {
    const connection = this.connections.get(serverId);
    if (!connection || connection.state !== 'connected') {
      return undefined;
    }

    try {
      const toolsResponse = await connection.client.listTools();
      const tools = toolsResponse.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as object | undefined,
      }));
      connection.tools = tools;
      logger.debug(`Refreshed ${tools.length} tools for ${connection.config.name}`);
      return tools;
    } catch (error) {
      logger.error(`Failed to refresh tools for ${serverId}: ${error}`);
      return connection.tools;
    }
  }

  /**
   * Check if a server is connected and healthy
   *
   * @param serverId - ID of the server
   * @returns true if connected
   */
  isConnected(serverId: string): boolean {
    return this.getConnectionState(serverId) === 'connected';
  }

  /**
   * Reset failure count for a server
   *
   * Call this after manually fixing issues to allow reconnection attempts.
   *
   * @param serverId - ID of the server
   */
  resetFailureCount(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.failureCount = 0;
      connection.lastError = undefined;
      logger.debug(`Reset failure count for ${serverId}`);
    }
  }

  /**
   * Get manager statistics
   *
   * @returns Statistics about current connections
   */
  getStats(): {
    total: number;
    connected: number;
    connecting: number;
    failed: number;
    disconnected: number;
  } {
    const connections = Array.from(this.connections.values());
    return {
      total: connections.length,
      connected: connections.filter((c) => c.state === 'connected').length,
      connecting: connections.filter((c) => c.state === 'connecting').length,
      failed: connections.filter((c) => c.state === 'failed').length,
      disconnected: connections.filter((c) => c.state === 'disconnected').length,
    };
  }
}

/**
 * Singleton instance of MCP Server Manager
 *
 * Use this for application-wide MCP server management.
 */
let mcpServerManagerInstance: McpServerManager | null = null;

/**
 * Get the singleton MCP Server Manager instance
 *
 * @param options - Options for creating the manager (only used on first call)
 * @returns MCP Server Manager instance
 */
export function getMcpServerManager(options?: McpServerManagerOptions): McpServerManager {
  if (!mcpServerManagerInstance) {
    mcpServerManagerInstance = new McpServerManager(options);
  }
  return mcpServerManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMcpServerManager(): void {
  if (mcpServerManagerInstance) {
    mcpServerManagerInstance.disconnectAll().catch(() => {});
    mcpServerManagerInstance = null;
  }
}

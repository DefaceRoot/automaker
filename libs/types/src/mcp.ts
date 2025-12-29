/**
 * MCP (Model Context Protocol) Server Types
 *
 * Types and interfaces for MCP server integration.
 * MCP servers provide additional tools and resources that can be
 * injected into agent tasks for extended functionality.
 *
 * @see https://modelcontextprotocol.io
 */

/**
 * Transport type for MCP server connections
 */
export type MCPTransportType = 'stdio' | 'sse';

/**
 * Configuration for an MCP server
 */
export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;

  /** Human-readable name for the server */
  name: string;

  /** Transport type used to communicate with the server */
  transport: MCPTransportType;

  /**
   * For stdio transport: Command to execute (e.g., "npx", "node", "python")
   * For sse transport: Not used
   */
  command?: string;

  /**
   * For stdio transport: Arguments to pass to the command
   * For sse transport: Not used
   */
  args?: string[];

  /**
   * For stdio transport: Environment variables to set
   * For sse transport: Not used
   */
  env?: Record<string, string>;

  /**
   * For sse transport: URL to connect to
   * For stdio transport: Not used
   */
  url?: string;

  /** Whether this server is enabled */
  enabled: boolean;

  /** Optional description of the server's purpose */
  description?: string;

  /**
   * Optional tags for categorization
   * Examples: ["database", "filesystem", "api"]
   */
  tags?: string[];
}

/**
 * Status of an MCP server instance
 */
export type MCPServerStatus =
  | 'stopped' // Server is not running
  | 'starting' // Server is in the process of starting
  | 'running' // Server is running and ready
  | 'error' // Server encountered an error
  | 'stopping'; // Server is in the process of stopping

/**
 * Runtime state of an MCP server instance
 */
export interface MCPServerState {
  /** Configuration for this server */
  config: MCPServerConfig;

  /** Current status of the server */
  status: MCPServerStatus;

  /** Error message if status is 'error' */
  error?: string;

  /** Timestamp when the server was last started */
  startedAt?: string;

  /** Timestamp when the server was last stopped */
  stoppedAt?: string;

  /** Process ID if running via stdio transport */
  pid?: number;

  /** Available tools exposed by the server (populated after initialization) */
  tools?: MCPServerTool[];

  /** Available resources exposed by the server (populated after initialization) */
  resources?: MCPServerResource[];
}

/**
 * Tool definition from an MCP server
 */
export interface MCPServerTool {
  /** Tool name */
  name: string;

  /** Human-readable description */
  description?: string;

  /** JSON schema for the tool's input parameters */
  inputSchema?: Record<string, unknown>;
}

/**
 * Resource definition from an MCP server
 */
export interface MCPServerResource {
  /** Resource URI */
  uri: string;

  /** Human-readable name */
  name?: string;

  /** Description of the resource */
  description?: string;

  /** MIME type of the resource */
  mimeType?: string;
}

/**
 * MCP servers configuration for a project
 * Stored in {projectPath}/.automaker/mcp-servers.json
 */
export interface MCPServersConfiguration {
  /** Version of the configuration format */
  version: number;

  /** List of configured MCP servers */
  servers: MCPServerConfig[];
}

/**
 * Default MCP servers configuration
 */
export const DEFAULT_MCP_SERVERS_CONFIGURATION: MCPServersConfiguration = {
  version: 1,
  servers: [],
};

/**
 * MCP servers configuration version
 */
export const MCP_SERVERS_CONFIG_VERSION = 1;

/**
 * Result of registering an MCP server
 */
export interface MCPServerRegistrationResult {
  success: boolean;
  serverId?: string;
  error?: string;
}

/**
 * Event types for MCP server lifecycle
 */
export type MCPServerEventType =
  | 'mcp:server:registered'
  | 'mcp:server:unregistered'
  | 'mcp:server:starting'
  | 'mcp:server:started'
  | 'mcp:server:stopping'
  | 'mcp:server:stopped'
  | 'mcp:server:error';

/**
 * Payload for MCP server events
 */
export interface MCPServerEventPayload {
  /** Event type */
  type: MCPServerEventType;

  /** Server ID */
  serverId: string;

  /** Server name */
  serverName?: string;

  /** Optional error message */
  error?: string;

  /** Optional additional data */
  data?: Record<string, unknown>;
}

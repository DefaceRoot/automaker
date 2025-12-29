/**
 * MCP Test Service
 *
 * Provides functionality to test MCP server connections and list available tools.
 * Supports stdio, SSE, and HTTP transport types.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPServerConfig, MCPToolInfo } from '@automaker/types';
import type { SettingsService } from './settings-service.js';

const DEFAULT_TIMEOUT = 30000; // 30 seconds (increased for slower-starting servers)

export interface MCPTestResult {
  success: boolean;
  tools?: MCPToolInfo[];
  error?: string;
  connectionTime?: number;
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

/**
 * MCP Test Service for testing server connections and listing tools
 */
export class MCPTestService {
  private settingsService: SettingsService;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  /**
   * Test connection to an MCP server and list its tools
   */
  async testServer(serverConfig: MCPServerConfig): Promise<MCPTestResult> {
    const startTime = Date.now();
    let client: Client | null = null;
    let transport:
      | StdioClientTransport
      | SSEClientTransport
      | StreamableHTTPClientTransport
      | null = null;

    try {
      client = new Client({
        name: 'automaker-mcp-test',
        version: '1.0.0',
      });

      // Create transport based on server type
      transport = await this.createTransport(serverConfig);

      // Connect with timeout
      await Promise.race([
        client.connect(transport),
        this.timeout(DEFAULT_TIMEOUT, 'Connection timeout'),
      ]);

      // List tools with timeout
      const toolsResult = await Promise.race([
        client.listTools(),
        this.timeout<{
          tools: Array<{
            name: string;
            description?: string;
            inputSchema?: Record<string, unknown>;
          }>;
        }>(DEFAULT_TIMEOUT, 'List tools timeout'),
      ]);

      const connectionTime = Date.now() - startTime;

      // Convert tools to MCPToolInfo format
      const tools: MCPToolInfo[] = (toolsResult.tools || []).map(
        (tool: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          enabled: true,
        })
      );

      return {
        success: true,
        tools,
        connectionTime,
        serverInfo: {
          name: serverConfig.name,
          version: undefined, // Could be extracted from server info if available
        },
      };
    } catch (error) {
      const connectionTime = Date.now() - startTime;
      let errorMessage = this.getErrorMessage(error);

      // Check if we have stderr output that can provide more context
      if (transport && 'stderr' in transport) {
        const stderrMessage = (transport as StdioClientTransport & { _lastStderr?: string })
          ._lastStderr;
        if (stderrMessage) {
          errorMessage = `${errorMessage} - Server output: ${stderrMessage}`;
        }
      }

      return {
        success: false,
        error: errorMessage,
        connectionTime,
      };
    } finally {
      // Clean up client connection
      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Test server by ID (looks up config from settings)
   */
  async testServerById(serverId: string): Promise<MCPTestResult> {
    try {
      const globalSettings = await this.settingsService.getGlobalSettings();
      const serverConfig = globalSettings.mcpServers?.find((s) => s.id === serverId);

      if (!serverConfig) {
        return {
          success: false,
          error: `Server with ID "${serverId}" not found`,
        };
      }

      return this.testServer(serverConfig);
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /**
   * Create appropriate transport based on server type
   */
  private async createTransport(
    config: MCPServerConfig
  ): Promise<StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport> {
    if (config.type === 'sse') {
      if (!config.url) {
        throw new Error('URL is required for SSE transport');
      }
      // Use eventSourceInit workaround for SSE headers (SDK bug workaround)
      // See: https://github.com/modelcontextprotocol/typescript-sdk/issues/436
      const headers = config.headers;
      return new SSEClientTransport(new URL(config.url), {
        requestInit: headers ? { headers } : undefined,
        eventSourceInit: headers
          ? {
              fetch: (url: string | URL | Request, init?: RequestInit) => {
                const fetchHeaders = new Headers(init?.headers || {});
                for (const [key, value] of Object.entries(headers)) {
                  fetchHeaders.set(key, value);
                }
                return fetch(url, { ...init, headers: fetchHeaders });
              },
            }
          : undefined,
      });
    }

    if (config.type === 'http') {
      if (!config.url) {
        throw new Error('URL is required for HTTP transport');
      }
      return new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: config.headers
          ? {
              headers: config.headers,
            }
          : undefined,
      });
    }

    // Default to stdio
    if (!config.command) {
      throw new Error('Command is required for stdio transport');
    }

    // Merge config.env with process.env to inherit PATH and other essential variables
    // This ensures commands like 'uvx', 'npx', etc. can be found on Windows
    const mergedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        mergedEnv[key] = value;
      }
    }
    // Config env takes precedence over process.env
    if (config.env) {
      Object.assign(mergedEnv, config.env);
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: mergedEnv,
      stderr: 'pipe', // Capture stderr for better error messages
    });

    // Capture stderr output to provide better error messages
    transport.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[MCP:${config.name}] stderr:`, message);
        // Store the last stderr message for error reporting
        (transport as StdioClientTransport & { _lastStderr?: string })._lastStderr = message;
      }
    });

    return transport;
  }

  /**
   * Create a timeout promise
   */
  private timeout<T>(ms: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Extract error message from unknown error
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

/**
 * MCP Test Service
 *
 * Provides functionality to test MCP server connections and discover available tools.
 * Used to validate MCP server configurations before they are used in tasks.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig, StdioMcpConfig, HttpMcpConfig } from '@automaker/types';
import { createLogger } from '@automaker/utils';

/** Type for HTTP-based MCP transports */
type HttpMcpTransport = StreamableHTTPClientTransport | SSEClientTransport;

const logger = createLogger('mcp-test-service');

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

/**
 * Information about a tool discovered from an MCP server
 */
export interface McpToolInfo {
  /** Tool name (used for invocation) */
  name: string;
  /** Human-readable description */
  description?: string;
  /** JSON Schema for tool input parameters */
  inputSchema?: object;
}

/**
 * Result of testing an MCP server connection
 */
export interface McpTestResult {
  /** Whether the connection was successful */
  success: boolean;
  /** Connection status */
  status: 'connected' | 'failed' | 'timeout';
  /** Server information (name, version) if connected */
  serverInfo?: {
    name: string;
    version: string;
  };
  /** List of available tools if connected */
  tools?: McpToolInfo[];
  /** Error message if connection failed */
  error?: string;
  /** Time taken to complete the test in milliseconds */
  latencyMs: number;
  /** Timestamp of when the test was performed */
  testedAt: string;
}

/** Default timeout for MCP connection tests (10 seconds) */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Test an MCP server connection and discover its tools
 *
 * @param config - The MCP server configuration to test
 * @param timeoutMs - Maximum time to wait for connection (default: 10s)
 * @returns Promise resolving to test result with connection status and tools
 */
export async function testMcpServer(
  config: McpServerConfig,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<McpTestResult> {
  const startTime = Date.now();
  const testedAt = new Date().toISOString();

  logger.info(`Testing MCP server: ${config.name} (${config.id})`);

  let client: Client | null = null;
  let transport: StdioClientTransport | HttpMcpTransport | null = null;

  try {
    // Create transport based on config type
    if (config.transport.type === 'stdio') {
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
          name: 'automaker-mcp-tester',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect with timeout
      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
      });

      await Promise.race([connectPromise, timeoutPromise]);
    } else {
      // For HTTP transport, try Streamable HTTP first, then fall back to SSE
      const httpConfig = config.transport as HttpMcpConfig;
      const url = new URL(httpConfig.url);
      const requestInit = httpConfig.headers ? { headers: httpConfig.headers } : undefined;

      // Create client first
      client = new Client(
        {
          name: 'automaker-mcp-tester',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Try Streamable HTTP transport first (modern servers)
      logger.debug(`Trying Streamable HTTP transport: ${httpConfig.url}`);
      transport = new StreamableHTTPClientTransport(url, { requestInit });

      try {
        const connectPromise = client.connect(transport);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
        });

        await Promise.race([connectPromise, timeoutPromise]);
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
          logger.debug(`Streamable HTTP failed, falling back to SSE transport: ${httpConfig.url}`);
          transport = new SSEClientTransport(url, { requestInit });

          // Create a new client for SSE
          client = new Client(
            {
              name: 'automaker-mcp-tester',
              version: '1.0.0',
            },
            {
              capabilities: {},
            }
          );

          const sseConnectPromise = client.connect(transport);
          const sseTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
          });

          await Promise.race([sseConnectPromise, sseTimeoutPromise]);
          logger.info(`Connected via SSE transport (fallback): ${config.name}`);
        } else {
          // Re-throw if it's not a transport compatibility issue
          throw streamableError;
        }
      }
    }

    logger.info(`Connected to MCP server: ${config.name}`);

    // Get server info
    const serverInfo = client.getServerVersion();

    // List available tools
    let tools: McpToolInfo[] = [];
    try {
      const toolsResponse = await client.listTools();
      tools = toolsResponse.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as object | undefined,
      }));
      logger.info(`Discovered ${tools.length} tools from ${config.name}`);
    } catch (toolsError) {
      // Some servers may not support tools, which is fine
      logger.debug(`Could not list tools: ${toolsError}`);
    }

    // Close the connection
    await client.close();

    const latencyMs = Date.now() - startTime;
    logger.info(`MCP server test completed in ${latencyMs}ms: ${config.name} - SUCCESS`);

    return {
      success: true,
      status: 'connected',
      serverInfo: serverInfo
        ? {
            name: serverInfo.name,
            version: serverInfo.version,
          }
        : undefined,
      tools,
      latencyMs,
      testedAt,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('timeout');

    logger.error(`MCP server test failed: ${config.name} - ${errorMessage}`);

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
      status: isTimeout ? 'timeout' : 'failed',
      error: errorMessage,
      latencyMs,
      testedAt,
    };
  }
}

/**
 * Test multiple MCP servers in parallel
 *
 * @param configs - Array of MCP server configurations to test
 * @param timeoutMs - Maximum time to wait for each connection
 * @returns Promise resolving to map of server ID to test result
 */
export async function testMcpServers(
  configs: McpServerConfig[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Map<string, McpTestResult>> {
  logger.info(`Testing ${configs.length} MCP servers...`);

  const results = new Map<string, McpTestResult>();

  // Test servers in parallel for efficiency
  const testPromises = configs.map(async (config) => {
    const result = await testMcpServer(config, timeoutMs);
    return { id: config.id, result };
  });

  const testResults = await Promise.all(testPromises);

  for (const { id, result } of testResults) {
    results.set(id, result);
  }

  const successCount = Array.from(results.values()).filter((r) => r.success).length;
  logger.info(`MCP server tests complete: ${successCount}/${configs.length} connected`);

  return results;
}

/**
 * MCP Test Service class for dependency injection
 */
export class McpTestService {
  /**
   * Test a single MCP server connection
   */
  async testServer(config: McpServerConfig, timeoutMs?: number): Promise<McpTestResult> {
    return testMcpServer(config, timeoutMs);
  }

  /**
   * Test multiple MCP servers in parallel
   */
  async testServers(
    configs: McpServerConfig[],
    timeoutMs?: number
  ): Promise<Map<string, McpTestResult>> {
    return testMcpServers(configs, timeoutMs);
  }
}

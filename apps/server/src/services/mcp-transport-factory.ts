/**
 * MCP Transport Factory
 *
 * Provides a unified factory for creating MCP transport instances.
 * Supports both stdio (local process) and HTTP/SSE (remote) transports.
 *
 * Features:
 * - Unified interface for creating any transport type
 * - Configuration validation before transport creation
 * - Environment variable expansion for secrets
 * - Error handling and meaningful error messages
 * - Transport type detection utilities
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig, StdioMcpConfig, HttpMcpConfig } from '@automaker/types';
import { createLogger } from '@automaker/utils';

const logger = createLogger('mcp-transport-factory');

/**
 * Transport types supported by the factory
 */
export type McpTransportType = 'stdio' | 'http';

/**
 * Union type for all supported transports
 */
export type McpTransport =
  | StdioClientTransport
  | SSEClientTransport
  | StreamableHTTPClientTransport;

/**
 * HTTP transport variant - streamable-http (recommended) or sse (legacy)
 */
export type HttpTransportVariant = 'streamable-http' | 'sse';

/**
 * Result of transport creation
 */
export interface TransportCreateResult {
  /** Whether creation was successful */
  success: boolean;
  /** The created transport instance (if successful) */
  transport?: McpTransport;
  /** Error message (if failed) */
  error?: string;
  /** Transport type that was created */
  type: McpTransportType;
}

/**
 * Options for transport creation
 */
export interface TransportCreateOptions {
  /** Whether to expand environment variables in config */
  expandEnvVars?: boolean;
  /** Additional environment variables to merge */
  additionalEnv?: Record<string, string>;
  /** Additional headers to merge (for HTTP transport) */
  additionalHeaders?: Record<string, string>;
  /**
   * Preferred HTTP transport variant.
   * - 'streamable-http': Use the newer Streamable HTTP transport (recommended for modern MCP servers)
   * - 'sse': Use the legacy SSE transport (for older servers)
   * Default: 'streamable-http'
   */
  httpTransportVariant?: HttpTransportVariant;
}

/**
 * Validation result for transport configuration
 */
export interface TransportValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
}

/**
 * MCP Transport Factory
 *
 * Creates and validates MCP transport instances for both stdio and HTTP transports.
 *
 * @example
 * ```typescript
 * // Create a stdio transport
 * const result = McpTransportFactory.create(serverConfig);
 * if (result.success) {
 *   const client = new Client(...);
 *   await client.connect(result.transport!);
 * }
 *
 * // Validate configuration before creating
 * const validation = McpTransportFactory.validate(serverConfig);
 * if (!validation.valid) {
 *   console.error('Invalid config:', validation.errors);
 * }
 * ```
 */
export class McpTransportFactory {
  /**
   * Create a transport instance from a server configuration
   *
   * @param config - MCP server configuration
   * @param options - Creation options
   * @returns Result containing transport or error
   */
  static create(
    config: McpServerConfig,
    options: TransportCreateOptions = {}
  ): TransportCreateResult {
    const transportType = this.getTransportType(config);

    try {
      // Validate configuration first
      const validation = this.validate(config);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join('; '),
          type: transportType,
        };
      }

      // Log any warnings
      for (const warning of validation.warnings) {
        logger.warn(`Transport config warning for ${config.name}: ${warning}`);
      }

      // Create the appropriate transport
      if (transportType === 'stdio') {
        const transport = this.createStdioTransport(config.transport as StdioMcpConfig, options);
        return { success: true, transport, type: 'stdio' };
      } else {
        const transport = this.createHttpTransport(config.transport as HttpMcpConfig, options);
        return { success: true, transport, type: 'http' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create transport for ${config.name}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        type: transportType,
      };
    }
  }

  /**
   * Validate a server configuration
   *
   * @param config - MCP server configuration to validate
   * @returns Validation result with errors and warnings
   */
  static validate(config: McpServerConfig): TransportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!config.id) {
      errors.push('Server ID is required');
    }

    if (!config.name) {
      errors.push('Server name is required');
    }

    if (!config.transport) {
      errors.push('Transport configuration is required');
      return { valid: false, errors, warnings };
    }

    // Validate based on transport type
    if (config.transport.type === 'stdio') {
      this.validateStdioConfig(config.transport, errors, warnings);
    } else if (config.transport.type === 'http') {
      this.validateHttpConfig(config.transport, errors, warnings);
    } else {
      errors.push(`Unknown transport type: ${(config.transport as { type: string }).type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get the transport type from a configuration
   *
   * @param config - MCP server configuration
   * @returns Transport type
   */
  static getTransportType(config: McpServerConfig): McpTransportType {
    return config.transport.type;
  }

  /**
   * Check if a configuration is for stdio transport
   *
   * @param config - MCP server configuration
   * @returns true if stdio transport
   */
  static isStdioTransport(config: McpServerConfig): boolean {
    return config.transport.type === 'stdio';
  }

  /**
   * Check if a configuration is for HTTP transport
   *
   * @param config - MCP server configuration
   * @returns true if HTTP transport
   */
  static isHttpTransport(config: McpServerConfig): boolean {
    return config.transport.type === 'http';
  }

  /**
   * Create stdio transport with options
   */
  private static createStdioTransport(
    config: StdioMcpConfig,
    options: TransportCreateOptions
  ): StdioClientTransport {
    // Merge environment variables
    let env = config.env ? { ...config.env } : undefined;

    // Expand environment variables if requested
    if (options.expandEnvVars && env) {
      env = this.expandEnvironmentVariables(env);
    }

    // Merge additional environment variables
    if (options.additionalEnv) {
      env = { ...env, ...options.additionalEnv };
    }

    logger.debug(`Creating stdio transport: ${config.command} ${config.args.join(' ')}`);

    return new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: env && Object.keys(env).length > 0 ? env : undefined,
    });
  }

  /**
   * Create HTTP transport with options
   * Supports both Streamable HTTP (modern) and SSE (legacy) transports
   */
  private static createHttpTransport(
    config: HttpMcpConfig,
    options: TransportCreateOptions
  ): StreamableHTTPClientTransport | SSEClientTransport {
    const variant = options.httpTransportVariant ?? 'streamable-http';

    // Merge headers
    let headers = config.headers ? { ...config.headers } : undefined;

    // Expand environment variables in headers if requested
    if (options.expandEnvVars && headers) {
      headers = this.expandEnvironmentVariables(headers);
    }

    // Merge additional headers
    if (options.additionalHeaders) {
      headers = { ...headers, ...options.additionalHeaders };
    }

    const url = new URL(config.url);
    const requestInit = headers && Object.keys(headers).length > 0 ? { headers } : undefined;

    if (variant === 'streamable-http') {
      logger.debug(`Creating Streamable HTTP transport: ${config.url}`);
      return new StreamableHTTPClientTransport(url, {
        requestInit,
      });
    } else {
      logger.debug(`Creating SSE transport: ${config.url}`);
      return new SSEClientTransport(url, {
        requestInit,
      });
    }
  }

  /**
   * Create Streamable HTTP transport specifically
   * Used when you need the modern transport directly
   */
  static createStreamableHttpTransport(
    config: HttpMcpConfig,
    options: TransportCreateOptions = {}
  ): StreamableHTTPClientTransport {
    // Merge headers
    let headers = config.headers ? { ...config.headers } : undefined;

    // Expand environment variables in headers if requested
    if (options.expandEnvVars && headers) {
      headers = this.expandEnvironmentVariables(headers);
    }

    // Merge additional headers
    if (options.additionalHeaders) {
      headers = { ...headers, ...options.additionalHeaders };
    }

    const url = new URL(config.url);
    logger.debug(`Creating Streamable HTTP transport: ${config.url}`);

    return new StreamableHTTPClientTransport(url, {
      requestInit: headers && Object.keys(headers).length > 0 ? { headers } : undefined,
    });
  }

  /**
   * Create SSE transport specifically (legacy)
   * Used when you need the legacy SSE transport directly
   */
  static createSseTransport(
    config: HttpMcpConfig,
    options: TransportCreateOptions = {}
  ): SSEClientTransport {
    // Merge headers
    let headers = config.headers ? { ...config.headers } : undefined;

    // Expand environment variables in headers if requested
    if (options.expandEnvVars && headers) {
      headers = this.expandEnvironmentVariables(headers);
    }

    // Merge additional headers
    if (options.additionalHeaders) {
      headers = { ...headers, ...options.additionalHeaders };
    }

    const url = new URL(config.url);
    logger.debug(`Creating SSE transport: ${config.url}`);

    return new SSEClientTransport(url, {
      requestInit: headers && Object.keys(headers).length > 0 ? { headers } : undefined,
    });
  }

  /**
   * Validate stdio transport configuration
   */
  private static validateStdioConfig(
    config: StdioMcpConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (!config.command) {
      errors.push('Stdio transport requires a command');
    } else if (typeof config.command !== 'string') {
      errors.push('Stdio transport command must be a string');
    }

    if (!config.args) {
      errors.push('Stdio transport requires args array');
    } else if (!Array.isArray(config.args)) {
      errors.push('Stdio transport args must be an array');
    } else {
      // Check for empty args
      if (config.args.length === 0) {
        warnings.push('Stdio transport has no arguments');
      }

      // Check for invalid arg types
      for (let i = 0; i < config.args.length; i++) {
        if (typeof config.args[i] !== 'string') {
          errors.push(`Stdio transport arg at index ${i} must be a string`);
        }
      }
    }

    // Validate env if present
    if (config.env) {
      if (typeof config.env !== 'object') {
        errors.push('Stdio transport env must be an object');
      } else {
        for (const [key, value] of Object.entries(config.env)) {
          if (typeof value !== 'string') {
            errors.push(`Stdio transport env value for '${key}' must be a string`);
          }
        }
      }
    }

    // Check for common commands that might need special handling
    if (config.command === 'npx' && config.args[0] !== '-y') {
      warnings.push('Using npx without -y flag may cause interactive prompts');
    }
  }

  /**
   * Validate HTTP transport configuration
   */
  private static validateHttpConfig(
    config: HttpMcpConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (!config.url) {
      errors.push('HTTP transport requires a URL');
      return;
    }

    if (typeof config.url !== 'string') {
      errors.push('HTTP transport URL must be a string');
      return;
    }

    // Validate URL format
    try {
      const url = new URL(config.url);

      // Check for HTTPS
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        errors.push('HTTP transport URL must use http or https protocol');
      }

      if (url.protocol === 'http:' && !url.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
        warnings.push('HTTP transport using insecure http:// for non-localhost URL');
      }
    } catch {
      errors.push(`HTTP transport URL is invalid: ${config.url}`);
    }

    // Validate headers if present
    if (config.headers) {
      if (typeof config.headers !== 'object') {
        errors.push('HTTP transport headers must be an object');
      } else {
        for (const [key, value] of Object.entries(config.headers)) {
          if (typeof value !== 'string') {
            errors.push(`HTTP transport header value for '${key}' must be a string`);
          }
        }
      }
    }
  }

  /**
   * Expand environment variable references in values
   *
   * Replaces ${VAR_NAME} patterns with values from process.env
   */
  private static expandEnvironmentVariables(vars: Record<string, string>): Record<string, string> {
    const expanded: Record<string, string> = {};

    for (const [key, value] of Object.entries(vars)) {
      expanded[key] = value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        const envValue = process.env[varName];
        if (envValue === undefined) {
          logger.warn(`Environment variable ${varName} not found, using empty string`);
          return '';
        }
        return envValue;
      });
    }

    return expanded;
  }
}

/**
 * Helper function to quickly create a transport
 *
 * @param config - MCP server configuration
 * @param options - Creation options
 * @returns Transport instance
 * @throws Error if transport creation fails
 */
export function createMcpTransport(
  config: McpServerConfig,
  options: TransportCreateOptions = {}
): McpTransport {
  const result = McpTransportFactory.create(config, options);
  if (!result.success) {
    throw new Error(`Failed to create MCP transport: ${result.error}`);
  }
  return result.transport!;
}

/**
 * Helper function to validate a transport configuration
 *
 * @param config - MCP server configuration
 * @returns true if valid
 */
export function validateMcpTransport(config: McpServerConfig): boolean {
  return McpTransportFactory.validate(config).valid;
}

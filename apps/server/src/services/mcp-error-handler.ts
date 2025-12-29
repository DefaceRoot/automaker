/**
 * MCP Error Handler
 *
 * Provides error classification, handling, and recovery strategies for MCP connections.
 *
 * Features:
 * - Error classification by type (transport, timeout, authentication, capability)
 * - Retry strategies based on error type
 * - Graceful degradation when servers are unavailable
 * - Error logging and reporting
 * - Recovery suggestions for common errors
 */

import { createLogger } from '@automaker/utils';

const logger = createLogger('mcp-error-handler');

/**
 * Categories of MCP errors
 */
export enum McpErrorCategory {
  /** Transport layer errors (process spawn, network issues) */
  Transport = 'transport',
  /** Connection timeout errors */
  Timeout = 'timeout',
  /** Authentication/authorization errors */
  Auth = 'auth',
  /** Capability/feature not supported errors */
  Capability = 'capability',
  /** Protocol errors (invalid messages, version mismatch) */
  Protocol = 'protocol',
  /** Tool execution errors */
  ToolExecution = 'tool_execution',
  /** Resource errors (file not found, permission denied) */
  Resource = 'resource',
  /** Configuration errors */
  Configuration = 'configuration',
  /** Unknown/unclassified errors */
  Unknown = 'unknown',
}

/**
 * Severity levels for MCP errors
 */
export enum McpErrorSeverity {
  /** Recoverable with retry */
  Transient = 'transient',
  /** Recoverable with configuration change */
  Recoverable = 'recoverable',
  /** Cannot recover automatically */
  Permanent = 'permanent',
}

/**
 * Retry strategy for error recovery
 */
export interface RetryStrategy {
  /** Whether to retry */
  shouldRetry: boolean;
  /** Number of retry attempts */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  delayMs: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Classified MCP error with metadata
 */
export interface ClassifiedMcpError {
  /** Original error */
  originalError: Error;
  /** Error category */
  category: McpErrorCategory;
  /** Error severity */
  severity: McpErrorSeverity;
  /** Human-readable error message */
  message: string;
  /** Detailed error description */
  details?: string;
  /** Recovery suggestion for the user */
  recoverySuggestion?: string;
  /** Retry strategy for this error */
  retryStrategy: RetryStrategy;
  /** Whether this error should be reported */
  shouldReport: boolean;
}

/**
 * Error pattern for classification
 */
interface ErrorPattern {
  pattern: RegExp;
  category: McpErrorCategory;
  severity: McpErrorSeverity;
  recoverySuggestion?: string;
}

/**
 * Error patterns for classification
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // Timeout errors
  {
    pattern: /timeout|timed out|ETIMEDOUT/i,
    category: McpErrorCategory.Timeout,
    severity: McpErrorSeverity.Transient,
    recoverySuggestion:
      'The server is taking too long to respond. Try increasing the timeout or check if the server is overloaded.',
  },

  // Connection refused/reset
  {
    pattern: /ECONNREFUSED|connection refused/i,
    category: McpErrorCategory.Transport,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion:
      'The server refused the connection. Ensure the MCP server is running and accessible.',
  },
  {
    pattern: /ECONNRESET|connection reset/i,
    category: McpErrorCategory.Transport,
    severity: McpErrorSeverity.Transient,
    recoverySuggestion:
      'The connection was reset. This may be a temporary network issue. Try again.',
  },

  // Network errors
  {
    pattern: /ENOTFOUND|DNS|network|host not found/i,
    category: McpErrorCategory.Transport,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion:
      'Cannot resolve the server address. Check the URL and your network connection.',
  },

  // Process spawn errors
  {
    pattern: /ENOENT|command not found|not found/i,
    category: McpErrorCategory.Transport,
    severity: McpErrorSeverity.Permanent,
    recoverySuggestion:
      'The command was not found. Ensure the MCP server package is installed (e.g., npm install -g @modelcontextprotocol/server-filesystem).',
  },
  {
    pattern: /EACCES|permission denied/i,
    category: McpErrorCategory.Resource,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion:
      'Permission denied. Check file permissions or run with appropriate privileges.',
  },
  {
    pattern: /spawn|child process/i,
    category: McpErrorCategory.Transport,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion: 'Failed to start the MCP server process. Check the command and arguments.',
  },

  // Authentication errors
  {
    pattern: /401|unauthorized|authentication|invalid.*token|invalid.*key/i,
    category: McpErrorCategory.Auth,
    severity: McpErrorSeverity.Permanent,
    recoverySuggestion:
      'Authentication failed. Check your API key or credentials in the server configuration.',
  },
  {
    pattern: /403|forbidden|access denied/i,
    category: McpErrorCategory.Auth,
    severity: McpErrorSeverity.Permanent,
    recoverySuggestion:
      'Access forbidden. You may not have permission to use this server or resource.',
  },

  // Protocol errors
  {
    pattern: /protocol|version.*mismatch|unsupported.*version|invalid.*message/i,
    category: McpErrorCategory.Protocol,
    severity: McpErrorSeverity.Permanent,
    recoverySuggestion: 'Protocol error. The server may be using an incompatible MCP version.',
  },
  {
    pattern: /JSON|parse|syntax/i,
    category: McpErrorCategory.Protocol,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion:
      'Invalid response from server. The server may be misconfigured or not an MCP server.',
  },

  // Capability errors
  {
    pattern: /not.*supported|capability|feature.*not.*available/i,
    category: McpErrorCategory.Capability,
    severity: McpErrorSeverity.Permanent,
    recoverySuggestion: 'The requested capability is not supported by this server.',
  },

  // Tool execution errors
  {
    pattern: /tool.*not.*found|unknown.*tool|invalid.*tool/i,
    category: McpErrorCategory.ToolExecution,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion: 'The requested tool is not available. Refresh the tool list.',
  },
  {
    pattern: /tool.*execution|tool.*failed|tool.*error/i,
    category: McpErrorCategory.ToolExecution,
    severity: McpErrorSeverity.Transient,
    recoverySuggestion: 'Tool execution failed. Check the tool input and try again.',
  },

  // Resource errors
  {
    pattern: /file.*not.*found|no.*such.*file|resource.*not.*found/i,
    category: McpErrorCategory.Resource,
    severity: McpErrorSeverity.Recoverable,
    recoverySuggestion: 'The requested resource was not found. Check the path or identifier.',
  },

  // Configuration errors
  {
    pattern: /invalid.*config|configuration.*error|missing.*required/i,
    category: McpErrorCategory.Configuration,
    severity: McpErrorSeverity.Permanent,
    recoverySuggestion: 'Invalid server configuration. Check the transport settings.',
  },
];

/**
 * Default retry strategies by error category
 */
const DEFAULT_RETRY_STRATEGIES: Record<McpErrorCategory, RetryStrategy> = {
  [McpErrorCategory.Transport]: {
    shouldRetry: true,
    maxRetries: 2,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
  [McpErrorCategory.Timeout]: {
    shouldRetry: true,
    maxRetries: 2,
    delayMs: 2000,
    backoffMultiplier: 1.5,
  },
  [McpErrorCategory.Auth]: {
    shouldRetry: false,
    maxRetries: 0,
    delayMs: 0,
    backoffMultiplier: 1,
  },
  [McpErrorCategory.Capability]: {
    shouldRetry: false,
    maxRetries: 0,
    delayMs: 0,
    backoffMultiplier: 1,
  },
  [McpErrorCategory.Protocol]: {
    shouldRetry: false,
    maxRetries: 0,
    delayMs: 0,
    backoffMultiplier: 1,
  },
  [McpErrorCategory.ToolExecution]: {
    shouldRetry: true,
    maxRetries: 1,
    delayMs: 500,
    backoffMultiplier: 1,
  },
  [McpErrorCategory.Resource]: {
    shouldRetry: false,
    maxRetries: 0,
    delayMs: 0,
    backoffMultiplier: 1,
  },
  [McpErrorCategory.Configuration]: {
    shouldRetry: false,
    maxRetries: 0,
    delayMs: 0,
    backoffMultiplier: 1,
  },
  [McpErrorCategory.Unknown]: {
    shouldRetry: true,
    maxRetries: 1,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
};

/**
 * MCP Error Handler
 *
 * Classifies errors, determines recovery strategies, and provides
 * helpful error messages and suggestions.
 *
 * @example
 * ```typescript
 * const handler = new McpErrorHandler();
 *
 * try {
 *   await connect(server);
 * } catch (error) {
 *   const classified = handler.classify(error);
 *   console.log(`Error category: ${classified.category}`);
 *   console.log(`Recovery suggestion: ${classified.recoverySuggestion}`);
 *
 *   if (classified.retryStrategy.shouldRetry) {
 *     // Retry with delay
 *   }
 * }
 * ```
 */
export class McpErrorHandler {
  /**
   * Classify an error and determine handling strategy
   *
   * @param error - The error to classify
   * @param context - Optional context for better classification
   * @returns Classified error with metadata
   */
  classify(error: unknown, context?: string): ClassifiedMcpError {
    const normalizedError = this.normalizeError(error);
    const errorMessage = normalizedError.message;

    // Try to match against known patterns
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(errorMessage)) {
        return this.createClassifiedError(
          normalizedError,
          pattern.category,
          pattern.severity,
          pattern.recoverySuggestion
        );
      }
    }

    // Default to unknown category
    return this.createClassifiedError(
      normalizedError,
      McpErrorCategory.Unknown,
      McpErrorSeverity.Transient,
      context
        ? `An unexpected error occurred while ${context}. Please try again.`
        : 'An unexpected error occurred. Please try again.'
    );
  }

  /**
   * Handle an error with logging and optional recovery
   *
   * @param error - The error to handle
   * @param context - Context for logging
   * @returns Classified error
   */
  handle(error: unknown, context?: string): ClassifiedMcpError {
    const classified = this.classify(error, context);

    // Log based on severity
    if (classified.severity === McpErrorSeverity.Permanent) {
      logger.error(
        `[${classified.category}] ${classified.message}${context ? ` (${context})` : ''}`
      );
    } else if (classified.severity === McpErrorSeverity.Recoverable) {
      logger.warn(
        `[${classified.category}] ${classified.message}${context ? ` (${context})` : ''}`
      );
    } else {
      logger.debug(
        `[${classified.category}] ${classified.message}${context ? ` (${context})` : ''}`
      );
    }

    return classified;
  }

  /**
   * Check if an error is retryable
   *
   * @param error - The error to check
   * @returns true if the error is retryable
   */
  isRetryable(error: unknown): boolean {
    const classified = this.classify(error);
    return classified.retryStrategy.shouldRetry;
  }

  /**
   * Get the retry delay for an error
   *
   * @param error - The error
   * @param attempt - Current retry attempt (1-based)
   * @returns Delay in milliseconds, or 0 if should not retry
   */
  getRetryDelay(error: unknown, attempt: number): number {
    const classified = this.classify(error);
    const strategy = classified.retryStrategy;

    if (!strategy.shouldRetry || attempt > strategy.maxRetries) {
      return 0;
    }

    return Math.round(strategy.delayMs * Math.pow(strategy.backoffMultiplier, attempt - 1));
  }

  /**
   * Execute a function with automatic retry on transient errors
   *
   * @param fn - Function to execute
   * @param context - Context for error handling
   * @returns Result of the function
   * @throws Last error if all retries fail
   */
  async withRetry<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: unknown;
    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        attempt++;

        const delay = this.getRetryDelay(error, attempt);
        if (delay === 0) {
          // No more retries
          throw error;
        }

        logger.debug(
          `Retry attempt ${attempt} after ${delay}ms${context ? ` for ${context}` : ''}`
        );
        await this.sleep(delay);
      }
    }
  }

  /**
   * Get a user-friendly error message
   *
   * @param error - The error
   * @returns User-friendly message
   */
  getUserMessage(error: unknown): string {
    const classified = this.classify(error);
    return classified.recoverySuggestion || classified.message;
  }

  /**
   * Get error category
   *
   * @param error - The error
   * @returns Error category
   */
  getCategory(error: unknown): McpErrorCategory {
    return this.classify(error).category;
  }

  /**
   * Normalize any error to an Error instance
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    if (typeof error === 'string') {
      return new Error(error);
    }
    if (typeof error === 'object' && error !== null) {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === 'string') {
        return new Error(message);
      }
    }
    return new Error(String(error));
  }

  /**
   * Create a classified error
   */
  private createClassifiedError(
    error: Error,
    category: McpErrorCategory,
    severity: McpErrorSeverity,
    recoverySuggestion?: string
  ): ClassifiedMcpError {
    return {
      originalError: error,
      category,
      severity,
      message: error.message,
      details: error.stack,
      recoverySuggestion,
      retryStrategy: { ...DEFAULT_RETRY_STRATEGIES[category] },
      shouldReport: severity === McpErrorSeverity.Permanent,
    };
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance of MCP Error Handler
 */
let mcpErrorHandlerInstance: McpErrorHandler | null = null;

/**
 * Get the singleton MCP Error Handler instance
 *
 * @returns MCP Error Handler instance
 */
export function getMcpErrorHandler(): McpErrorHandler {
  if (!mcpErrorHandlerInstance) {
    mcpErrorHandlerInstance = new McpErrorHandler();
  }
  return mcpErrorHandlerInstance;
}

/**
 * Helper function to classify an error
 *
 * @param error - The error to classify
 * @returns Classified error
 */
export function classifyMcpError(error: unknown): ClassifiedMcpError {
  return getMcpErrorHandler().classify(error);
}

/**
 * Helper function to check if an error is retryable
 *
 * @param error - The error to check
 * @returns true if retryable
 */
export function isMcpErrorRetryable(error: unknown): boolean {
  return getMcpErrorHandler().isRetryable(error);
}

/**
 * Helper function to get user-friendly error message
 *
 * @param error - The error
 * @returns User-friendly message
 */
export function getMcpUserErrorMessage(error: unknown): string {
  return getMcpErrorHandler().getUserMessage(error);
}

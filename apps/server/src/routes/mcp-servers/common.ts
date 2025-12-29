/**
 * Common utilities for MCP server routes
 *
 * Provides logger and error handling utilities shared across all MCP server endpoints.
 */

import { createLogger } from '@automaker/utils';
import { getErrorMessage as getErrorMessageShared, createLogError } from '../common.js';

/** Logger instance for MCP server operations */
export const logger = createLogger('MCPServers');

/**
 * Extract user-friendly error message from error objects
 *
 * Re-exported from parent routes common module for consistency.
 */
export { getErrorMessageShared as getErrorMessage };

/**
 * Log error with automatic logger binding
 *
 * Convenience function for logging errors with the MCPServers logger.
 */
export const logError = createLogError(logger);

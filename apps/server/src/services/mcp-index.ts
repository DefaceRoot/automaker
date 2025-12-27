/**
 * MCP Infrastructure Module
 *
 * Centralized exports for all MCP (Model Context Protocol) server integration
 * services. This module provides the foundation for loading, managing, and
 * injecting MCP servers into tasks.
 *
 * Components:
 * - McpServerManager: Lifecycle management for MCP connections
 * - McpTransportFactory: Unified transport creation
 * - McpErrorHandler: Error classification and recovery
 * - McpTestService: Connection testing and validation
 *
 * @module mcp
 */

// MCP Server Manager - Lifecycle management
export {
  McpServerManager,
  getMcpServerManager,
  resetMcpServerManager,
  type McpServerConnection,
  type McpConnectOptions,
  type McpConnectResult,
  type McpServerManagerOptions,
  type McpConnectionState,
} from './mcp-server-manager.js';

// MCP Transport Factory - Transport creation
export {
  McpTransportFactory,
  createMcpTransport,
  validateMcpTransport,
  type McpTransport,
  type TransportCreateResult,
  type TransportCreateOptions,
  type TransportValidationResult,
  type McpTransportType,
} from './mcp-transport-factory.js';

// MCP Error Handler - Error classification
export {
  McpErrorHandler,
  getMcpErrorHandler,
  classifyMcpError,
  isMcpErrorRetryable,
  getMcpUserErrorMessage,
  McpErrorCategory,
  McpErrorSeverity,
  type ClassifiedMcpError,
  type RetryStrategy,
} from './mcp-error-handler.js';

// MCP Test Service - Connection testing (existing)
export {
  McpTestService,
  testMcpServer,
  testMcpServers,
  type McpTestResult,
} from './mcp-test-service.js';

// Re-export types from @automaker/types for convenience
export type {
  McpServerConfig,
  StdioMcpConfig,
  HttpMcpConfig,
  McpToolInfo,
  McpServerStatus,
} from '@automaker/types';

/**
 * MCP Task Isolation Service
 *
 * Provides strict isolation boundaries for MCP servers at the task level.
 * Ensures that when MCP servers are enabled/disabled for specific tasks,
 * there is no leakage between parallel running tasks.
 *
 * Key features:
 * - Task-scoped MCP contexts with unique identifiers
 * - Runtime validation of MCP server access
 * - Isolation boundary logging and debugging
 * - Support for parallel task execution without cross-contamination
 *
 * Architecture:
 * - Each task gets a unique TaskMcpContext with its enabled servers
 * - Contexts are tracked by taskId in an isolated Map
 * - Contexts are automatically cleaned up when tasks complete
 * - Validation helpers ensure servers are only accessed within their task scope
 */

import { createLogger } from '@automaker/utils';
import type { McpServerConfig } from '@automaker/types';
import type { McpSdkConfig } from '../providers/types.js';
import { convertMcpConfigsToSdkFormat, validateMcpServerIds } from '../lib/mcp-config.js';

const logger = createLogger('mcp-task-isolation');

/**
 * Represents an isolated MCP context for a specific task
 */
export interface TaskMcpContext {
  /** Unique task identifier */
  taskId: string;
  /** Feature ID associated with this task */
  featureId: string;
  /** List of MCP server IDs enabled for this task */
  enabledServerIds: string[];
  /** Converted SDK-format MCP configs (ready for provider) */
  sdkConfigs: Record<string, McpSdkConfig>;
  /** Timestamp when context was created */
  createdAt: Date;
  /** Whether this context is still active */
  active: boolean;
  /** Working directory for this task */
  workDir: string;
}

/**
 * Result of validating MCP server access within a task context
 */
export interface McpAccessValidation {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for denial if not allowed */
  reason?: string;
  /** The task context if found */
  context?: TaskMcpContext;
}

/**
 * MCP Task Isolation Service
 *
 * Manages isolated MCP contexts for parallel task execution.
 * Each task maintains its own MCP server context with no leakage
 * between concurrent tasks.
 */
export class McpTaskIsolationService {
  /** Map of taskId to TaskMcpContext */
  private taskContexts: Map<string, TaskMcpContext> = new Map();

  /** Reference to global MCP server configurations */
  private globalMcpServers: McpServerConfig[] = [];

  constructor() {
    logger.info('MCP Task Isolation Service initialized');
  }

  /**
   * Update the global MCP server configurations
   * Called when global settings change
   *
   * @param servers - Array of global MCP server configurations
   */
  updateGlobalServers(servers: McpServerConfig[]): void {
    this.globalMcpServers = servers;
    logger.debug(`Updated global MCP servers: ${servers.length} configured`);
  }

  /**
   * Create an isolated MCP context for a task
   *
   * This is the primary entry point for task isolation. Each task gets
   * its own context with only the MCP servers it has enabled.
   *
   * @param taskId - Unique identifier for this task execution
   * @param featureId - Feature ID being executed
   * @param enabledServerIds - Array of MCP server IDs enabled for this task
   * @param workDir - Working directory for the task
   * @returns The created TaskMcpContext
   */
  createTaskContext(
    taskId: string,
    featureId: string,
    enabledServerIds: string[],
    workDir: string
  ): TaskMcpContext {
    // Validate that we're not creating duplicate contexts
    if (this.taskContexts.has(taskId)) {
      logger.warn(`Task context already exists for taskId: ${taskId}, replacing`);
      this.releaseTaskContext(taskId);
    }

    // Validate server IDs against global config
    const { validIds, invalidIds } = validateMcpServerIds(this.globalMcpServers, enabledServerIds);

    if (invalidIds.length > 0) {
      logger.warn(`Task ${taskId} references non-existent MCP servers: [${invalidIds.join(', ')}]`);
    }

    // Convert to SDK format (only valid, enabled servers)
    const sdkConfigs = convertMcpConfigsToSdkFormat(this.globalMcpServers, validIds);

    const context: TaskMcpContext = {
      taskId,
      featureId,
      enabledServerIds: validIds,
      sdkConfigs,
      createdAt: new Date(),
      active: true,
      workDir,
    };

    this.taskContexts.set(taskId, context);

    logger.info(
      `Created isolated MCP context for task ${taskId} (feature: ${featureId}) with servers: [${validIds.join(', ')}]`
    );

    return context;
  }

  /**
   * Get the MCP context for a task
   *
   * @param taskId - Task identifier
   * @returns TaskMcpContext if found and active, undefined otherwise
   */
  getTaskContext(taskId: string): TaskMcpContext | undefined {
    const context = this.taskContexts.get(taskId);
    if (context && !context.active) {
      logger.warn(`Attempted to access inactive context for task ${taskId}`);
      return undefined;
    }
    return context;
  }

  /**
   * Get SDK-format MCP configs for a task
   *
   * This is the main method used by the auto-mode service to get
   * the isolated MCP configuration for a task.
   *
   * @param taskId - Task identifier
   * @returns SDK configs if context exists, empty object otherwise
   */
  getTaskMcpConfigs(taskId: string): Record<string, McpSdkConfig> {
    const context = this.getTaskContext(taskId);
    if (!context) {
      logger.debug(`No MCP context found for task ${taskId}`);
      return {};
    }
    return context.sdkConfigs;
  }

  /**
   * Validate that a task can access a specific MCP server
   *
   * Use this to enforce isolation boundaries at runtime.
   *
   * @param taskId - Task identifier
   * @param serverId - MCP server ID to validate access for
   * @returns Validation result with allowed status and reason
   */
  validateServerAccess(taskId: string, serverId: string): McpAccessValidation {
    const context = this.getTaskContext(taskId);

    if (!context) {
      return {
        allowed: false,
        reason: `No active MCP context for task ${taskId}`,
      };
    }

    if (!context.enabledServerIds.includes(serverId)) {
      return {
        allowed: false,
        reason: `MCP server '${serverId}' is not enabled for task ${taskId}. Enabled servers: [${context.enabledServerIds.join(', ')}]`,
        context,
      };
    }

    return {
      allowed: true,
      context,
    };
  }

  /**
   * Release a task's MCP context
   *
   * Call this when a task completes (success or failure) to clean up
   * the isolated context and prevent memory leaks.
   *
   * @param taskId - Task identifier
   * @returns true if context was released, false if not found
   */
  releaseTaskContext(taskId: string): boolean {
    const context = this.taskContexts.get(taskId);
    if (!context) {
      logger.debug(`No context to release for task ${taskId}`);
      return false;
    }

    // Mark as inactive before deletion
    context.active = false;

    this.taskContexts.delete(taskId);
    logger.info(
      `Released MCP context for task ${taskId} (feature: ${context.featureId}), ` +
        `was active for ${Date.now() - context.createdAt.getTime()}ms`
    );

    return true;
  }

  /**
   * Get statistics about current task isolation state
   *
   * Useful for debugging and monitoring.
   */
  getStats(): {
    activeContexts: number;
    totalServersInUse: number;
    taskIds: string[];
    serverUsage: Record<string, number>;
  } {
    const taskIds: string[] = [];
    const serverUsage: Record<string, number> = {};
    let totalServersInUse = 0;

    for (const [taskId, context] of this.taskContexts) {
      if (context.active) {
        taskIds.push(taskId);
        for (const serverId of context.enabledServerIds) {
          serverUsage[serverId] = (serverUsage[serverId] || 0) + 1;
          totalServersInUse++;
        }
      }
    }

    return {
      activeContexts: taskIds.length,
      totalServersInUse,
      taskIds,
      serverUsage,
    };
  }

  /**
   * Clean up all task contexts
   *
   * Call this during server shutdown.
   */
  cleanup(): void {
    const count = this.taskContexts.size;
    for (const [taskId, context] of this.taskContexts) {
      context.active = false;
    }
    this.taskContexts.clear();
    logger.info(`Cleaned up ${count} MCP task contexts`);
  }

  /**
   * Check if any tasks are currently using a specific MCP server
   *
   * Useful for determining if a server can be safely modified/removed.
   *
   * @param serverId - MCP server ID to check
   * @returns Array of task IDs using this server
   */
  getTasksUsingServer(serverId: string): string[] {
    const taskIds: string[] = [];
    for (const [taskId, context] of this.taskContexts) {
      if (context.active && context.enabledServerIds.includes(serverId)) {
        taskIds.push(taskId);
      }
    }
    return taskIds;
  }
}

/**
 * Singleton instance of the MCP Task Isolation Service
 */
let mcpTaskIsolationInstance: McpTaskIsolationService | null = null;

/**
 * Get the singleton MCP Task Isolation Service instance
 *
 * @returns McpTaskIsolationService instance
 */
export function getMcpTaskIsolationService(): McpTaskIsolationService {
  if (!mcpTaskIsolationInstance) {
    mcpTaskIsolationInstance = new McpTaskIsolationService();
  }
  return mcpTaskIsolationInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMcpTaskIsolationService(): void {
  if (mcpTaskIsolationInstance) {
    mcpTaskIsolationInstance.cleanup();
    mcpTaskIsolationInstance = null;
  }
}

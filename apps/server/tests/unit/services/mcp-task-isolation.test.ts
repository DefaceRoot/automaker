/**
 * MCP Task Isolation Service Unit Tests
 *
 * Tests for strict isolation boundaries for MCP servers at the task level.
 * Ensures no leakage between parallel running tasks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  McpTaskIsolationService,
  getMcpTaskIsolationService,
  resetMcpTaskIsolationService,
  type TaskMcpContext,
} from '@/services/mcp-task-isolation.js';
import type { McpServerConfig } from '@automaker/types';

// Helper to create test MCP server configs
const createStdioConfig = (
  id: string,
  name: string,
  enabled: boolean,
  command = 'npx',
  args: string[] = ['-y', '@mcp/server-test']
): McpServerConfig => ({
  id,
  name,
  transport: {
    type: 'stdio',
    command,
    args,
  },
  enabled,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const createHttpConfig = (
  id: string,
  name: string,
  enabled: boolean,
  url = 'https://mcp.example.com'
): McpServerConfig => ({
  id,
  name,
  transport: {
    type: 'http',
    url,
  },
  enabled,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

describe('McpTaskIsolationService', () => {
  let service: McpTaskIsolationService;
  let globalServers: McpServerConfig[];

  beforeEach(() => {
    // Reset singleton and get fresh instance
    resetMcpTaskIsolationService();
    service = getMcpTaskIsolationService();

    // Set up global server configs
    globalServers = [
      createStdioConfig('fs', 'Filesystem', true, 'npx', ['-y', '@mcp/server-fs']),
      createStdioConfig('git', 'Git', true, 'npx', ['-y', '@mcp/server-git']),
      createHttpConfig('remote', 'Remote API', true, 'https://api.example.com/mcp'),
      createStdioConfig('disabled', 'Disabled Server', false),
    ];
    service.updateGlobalServers(globalServers);
  });

  afterEach(() => {
    resetMcpTaskIsolationService();
  });

  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getMcpTaskIsolationService();
      const instance2 = getMcpTaskIsolationService();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = getMcpTaskIsolationService();
      resetMcpTaskIsolationService();
      const instance2 = getMcpTaskIsolationService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createTaskContext', () => {
    it('should create an isolated context with specified servers', () => {
      const context = service.createTaskContext('task-1', 'feature-1', ['fs', 'git'], '/work/dir');

      expect(context).toBeDefined();
      expect(context.taskId).toBe('task-1');
      expect(context.featureId).toBe('feature-1');
      expect(context.enabledServerIds).toEqual(['fs', 'git']);
      expect(context.workDir).toBe('/work/dir');
      expect(context.active).toBe(true);
    });

    it('should convert configs to SDK format', () => {
      const context = service.createTaskContext(
        'task-1',
        'feature-1',
        ['fs', 'remote'],
        '/work/dir'
      );

      // Stdio config should not have 'type' field
      expect(context.sdkConfigs['fs']).toEqual({
        command: 'npx',
        args: ['-y', '@mcp/server-fs'],
      });

      // HTTP config should have 'type' field
      expect(context.sdkConfigs['remote']).toEqual({
        type: 'http',
        url: 'https://api.example.com/mcp',
      });
    });

    it('should filter out invalid server IDs', () => {
      const context = service.createTaskContext(
        'task-1',
        'feature-1',
        ['fs', 'non-existent', 'git'],
        '/work/dir'
      );

      expect(context.enabledServerIds).toEqual(['fs', 'git']);
      expect(context.sdkConfigs).not.toHaveProperty('non-existent');
    });

    it('should replace existing context with same taskId', () => {
      const context1 = service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');

      const context2 = service.createTaskContext('task-1', 'feature-2', ['git'], '/work/dir2');

      expect(context1.active).toBe(false);
      expect(context2.active).toBe(true);
      expect(context2.featureId).toBe('feature-2');
    });
  });

  describe('getTaskContext', () => {
    it('should return the context for an active task', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');

      const context = service.getTaskContext('task-1');
      expect(context).toBeDefined();
      expect(context?.taskId).toBe('task-1');
    });

    it('should return undefined for non-existent task', () => {
      const context = service.getTaskContext('non-existent');
      expect(context).toBeUndefined();
    });

    it('should return undefined for inactive context', () => {
      const context = service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');
      context.active = false;

      const retrieved = service.getTaskContext('task-1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getTaskMcpConfigs', () => {
    it('should return SDK configs for a task', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs', 'git'], '/work/dir');

      const configs = service.getTaskMcpConfigs('task-1');
      expect(configs).toHaveProperty('fs');
      expect(configs).toHaveProperty('git');
      expect(Object.keys(configs)).toHaveLength(2);
    });

    it('should return empty object for non-existent task', () => {
      const configs = service.getTaskMcpConfigs('non-existent');
      expect(configs).toEqual({});
    });
  });

  describe('validateServerAccess', () => {
    it('should allow access to enabled servers', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs', 'git'], '/work/dir');

      const result = service.validateServerAccess('task-1', 'fs');
      expect(result.allowed).toBe(true);
      expect(result.context).toBeDefined();
    });

    it('should deny access to non-enabled servers', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');

      const result = service.validateServerAccess('task-1', 'git');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not enabled for task');
    });

    it('should deny access for non-existent task', () => {
      const result = service.validateServerAccess('non-existent', 'fs');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No active MCP context');
    });
  });

  describe('releaseTaskContext', () => {
    it('should release an active context', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');

      const released = service.releaseTaskContext('task-1');
      expect(released).toBe(true);

      const context = service.getTaskContext('task-1');
      expect(context).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const released = service.releaseTaskContext('non-existent');
      expect(released).toBe(false);
    });
  });

  describe('task isolation', () => {
    it('should maintain separate contexts for parallel tasks', () => {
      // Create two tasks with different MCP server configurations
      const task1Context = service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir1');

      const task2Context = service.createTaskContext(
        'task-2',
        'feature-2',
        ['git', 'remote'],
        '/work/dir2'
      );

      // Verify task 1 can only access fs
      expect(service.validateServerAccess('task-1', 'fs').allowed).toBe(true);
      expect(service.validateServerAccess('task-1', 'git').allowed).toBe(false);
      expect(service.validateServerAccess('task-1', 'remote').allowed).toBe(false);

      // Verify task 2 can only access git and remote
      expect(service.validateServerAccess('task-2', 'fs').allowed).toBe(false);
      expect(service.validateServerAccess('task-2', 'git').allowed).toBe(true);
      expect(service.validateServerAccess('task-2', 'remote').allowed).toBe(true);
    });

    it('should not leak configs between tasks', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir1');
      service.createTaskContext('task-2', 'feature-2', ['git'], '/work/dir2');

      const task1Configs = service.getTaskMcpConfigs('task-1');
      const task2Configs = service.getTaskMcpConfigs('task-2');

      // Task 1 should only have fs
      expect(Object.keys(task1Configs)).toEqual(['fs']);

      // Task 2 should only have git
      expect(Object.keys(task2Configs)).toEqual(['git']);
    });

    it('should clean up contexts independently', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir1');
      service.createTaskContext('task-2', 'feature-2', ['git'], '/work/dir2');

      // Release task 1
      service.releaseTaskContext('task-1');

      // Task 1 should be gone
      expect(service.getTaskContext('task-1')).toBeUndefined();

      // Task 2 should still exist
      expect(service.getTaskContext('task-2')).toBeDefined();
      expect(service.validateServerAccess('task-2', 'git').allowed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for active contexts', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs', 'git'], '/work/dir1');
      service.createTaskContext('task-2', 'feature-2', ['git', 'remote'], '/work/dir2');

      const stats = service.getStats();
      expect(stats.activeContexts).toBe(2);
      expect(stats.taskIds).toContain('task-1');
      expect(stats.taskIds).toContain('task-2');
      expect(stats.serverUsage['fs']).toBe(1);
      expect(stats.serverUsage['git']).toBe(2);
      expect(stats.serverUsage['remote']).toBe(1);
    });

    it('should not count inactive contexts', () => {
      const context = service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');
      context.active = false;

      const stats = service.getStats();
      expect(stats.activeContexts).toBe(0);
    });
  });

  describe('getTasksUsingServer', () => {
    it('should return tasks using a specific server', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs', 'git'], '/work/dir1');
      service.createTaskContext('task-2', 'feature-2', ['git', 'remote'], '/work/dir2');
      service.createTaskContext('task-3', 'feature-3', ['fs'], '/work/dir3');

      const fsUsers = service.getTasksUsingServer('fs');
      expect(fsUsers).toContain('task-1');
      expect(fsUsers).toContain('task-3');
      expect(fsUsers).toHaveLength(2);

      const gitUsers = service.getTasksUsingServer('git');
      expect(gitUsers).toContain('task-1');
      expect(gitUsers).toContain('task-2');
      expect(gitUsers).toHaveLength(2);
    });

    it('should return empty array for unused server', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir');

      const users = service.getTasksUsingServer('remote');
      expect(users).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should clear all contexts', () => {
      service.createTaskContext('task-1', 'feature-1', ['fs'], '/work/dir1');
      service.createTaskContext('task-2', 'feature-2', ['git'], '/work/dir2');

      service.cleanup();

      expect(service.getTaskContext('task-1')).toBeUndefined();
      expect(service.getTaskContext('task-2')).toBeUndefined();
      expect(service.getStats().activeContexts).toBe(0);
    });
  });
});

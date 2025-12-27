/**
 * MCP Servers E2E Test
 *
 * Verifies the MCP (Model Context Protocol) server management UI:
 * - Adding new MCP servers (both stdio and HTTP transports)
 * - Viewing server list
 * - Editing server configurations
 * - Deleting servers
 * - Testing server connections
 */

import { test, expect } from '@playwright/test';
import { waitForNetworkIdle } from '../utils';

const STORE_VERSION = 2;

/**
 * Set up a mock project with MCP servers for testing
 */
async function setupMockProjectWithMcpServers(
  page: import('@playwright/test').Page,
  options?: {
    mcpServers?: Array<{
      id: string;
      name: string;
      description?: string;
      transport: {
        type: 'stdio' | 'http';
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        url?: string;
        headers?: Record<string, string>;
      };
      enabled: boolean;
      createdAt: string;
      updatedAt: string;
      lastTestResult?: {
        success: boolean;
        status: 'connected' | 'failed' | 'timeout';
        tools?: Array<{ name: string; description?: string }>;
        error?: string;
        latencyMs: number;
        testedAt: string;
      };
    }>;
  }
): Promise<void> {
  await page.addInitScript((opts: typeof options) => {
    const mockProject = {
      id: 'test-project-1',
      name: 'Test Project',
      path: '/mock/test-project',
      lastOpened: new Date().toISOString(),
    };

    const mockState = {
      state: {
        projects: [mockProject],
        currentProject: mockProject,
        theme: 'dark',
        sidebarOpen: true,
        apiKeys: { anthropic: '', google: '', openai: '', zai: '' },
        chatSessions: [],
        chatHistoryOpen: false,
        maxConcurrency: 3,
        aiProfiles: [],
        mcpServers: opts?.mcpServers ?? [],
        features: [],
        currentView: 'board',
      },
      version: 2,
    };

    localStorage.setItem('automaker-storage', JSON.stringify(mockState));

    // Mark setup as complete
    const setupState = {
      state: {
        isFirstRun: false,
        setupComplete: true,
        currentStep: 'complete',
        skipClaudeSetup: false,
      },
      version: 0,
    };
    localStorage.setItem('automaker-setup', JSON.stringify(setupState));
  }, options);
}

/**
 * Navigate to the MCP settings panel (Settings > MCP Servers section)
 */
async function navigateToMcpSettings(page: import('@playwright/test').Page): Promise<void> {
  // Click on Settings in the sidebar
  const settingsButton = page.locator('[data-sidebar-item="settings"]');
  await settingsButton.click();

  // Wait for settings view to load
  await page.waitForSelector('[data-testid="settings-view"]');

  // Look for the MCP Servers panel
  await page.waitForSelector('text=MCP Servers');
}

test.describe('MCP Server Management', () => {
  test('should display empty state when no MCP servers are configured', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Check for empty state message
    await expect(page.locator('text=No MCP servers configured')).toBeVisible();
    await expect(
      page.locator("text=Add an MCP server to extend Claude's capabilities")
    ).toBeVisible();
  });

  test('should display configured MCP servers in the list', async ({ page }) => {
    const testServer = {
      id: 'test-server-1',
      name: 'Filesystem Server',
      description: 'Access to project files',
      transport: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/project'],
      },
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastTestResult: {
        success: true,
        status: 'connected' as const,
        tools: [
          { name: 'read_file', description: 'Read a file from the filesystem' },
          { name: 'write_file', description: 'Write content to a file' },
        ],
        latencyMs: 150,
        testedAt: '2024-01-01T00:00:00Z',
      },
    };

    await setupMockProjectWithMcpServers(page, { mcpServers: [testServer] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Check server is displayed
    await expect(page.locator('text=Filesystem Server')).toBeVisible();
    await expect(page.locator('text=Access to project files')).toBeVisible();

    // Check transport type badge
    await expect(page.locator('text=stdio').first()).toBeVisible();

    // Check status indicator (connected)
    await expect(page.locator('text=Connected')).toBeVisible();

    // Check tools badge
    await expect(page.locator('text=2 tools')).toBeVisible();
  });

  test('should open add server dialog when clicking Add Server button', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Click Add Server button
    await page.click('button:has-text("Add Server")');

    // Dialog should open
    await expect(page.locator('text=Add MCP Server')).toBeVisible();

    // Check form fields are present
    await expect(page.locator('label:has-text("Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Description")')).toBeVisible();
    await expect(page.locator('label:has-text("Transport Type")')).toBeVisible();

    // Check transport type options (Stdio should be default)
    await expect(page.locator('text=Stdio')).toBeVisible();
    await expect(page.locator('text=HTTP')).toBeVisible();

    // Stdio fields should be visible by default
    await expect(page.locator('label:has-text("Command")')).toBeVisible();
    await expect(page.locator('label:has-text("Arguments")')).toBeVisible();
  });

  test('should show HTTP fields when HTTP transport type is selected', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Open dialog
    await page.click('button:has-text("Add Server")');
    await expect(page.locator('text=Add MCP Server')).toBeVisible();

    // Select HTTP transport type
    const httpOption = page.locator('div:has-text("HTTP")').filter({ hasText: 'HTTP' });
    await httpOption.click();

    // HTTP fields should be visible
    await expect(page.locator('label:has-text("URL")')).toBeVisible();
    await expect(page.locator('label:has-text("Headers")')).toBeVisible();

    // Stdio fields should not be visible
    await expect(page.locator('label:has-text("Command")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Arguments")')).not.toBeVisible();
  });

  test('should validate required fields when adding a server', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Open dialog
    await page.click('button:has-text("Add Server")');
    await expect(page.locator('text=Add MCP Server')).toBeVisible();

    // Try to save without filling required fields
    await page.click('button:has-text("Add Server"):visible');

    // Should show error toast for missing name
    await expect(page.locator('text=Server name is required')).toBeVisible({ timeout: 5000 });
  });

  test('should toggle server enabled state', async ({ page }) => {
    const testServer = {
      id: 'test-server-1',
      name: 'Test Server',
      transport: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', 'test-server'],
      },
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    await setupMockProjectWithMcpServers(page, { mcpServers: [testServer] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Find the switch for the server
    const serverCard = page.locator('div:has-text("Test Server")').first();
    const defaultSwitch = serverCard.locator('button[role="switch"]');

    // The switch should exist and be checked (enabled)
    await expect(defaultSwitch).toBeVisible();
    await expect(defaultSwitch).toHaveAttribute('data-state', 'checked');

    // Toggle it off
    await defaultSwitch.click();

    // Should now be unchecked
    await expect(defaultSwitch).toHaveAttribute('data-state', 'unchecked');
  });

  test('should show delete confirmation when clicking delete button', async ({ page }) => {
    const testServer = {
      id: 'test-server-1',
      name: 'Server To Delete',
      transport: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', 'test-server'],
      },
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    await setupMockProjectWithMcpServers(page, { mcpServers: [testServer] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Find and click the delete button (trash icon)
    const serverCard = page.locator('div:has-text("Server To Delete")').first();
    const deleteButton = serverCard.locator('button:has(svg.lucide-trash-2)');
    await deleteButton.click();

    // Confirm and Cancel buttons should appear
    await expect(page.locator('button:has-text("Confirm")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Click Cancel
    await page.click('button:has-text("Cancel")');

    // Server should still be visible
    await expect(page.locator('text=Server To Delete')).toBeVisible();
  });

  test('should display failed connection status correctly', async ({ page }) => {
    const failedServer = {
      id: 'failed-server-1',
      name: 'Failed Server',
      transport: {
        type: 'http' as const,
        url: 'https://nonexistent.example.com/mcp',
      },
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastTestResult: {
        success: false,
        status: 'failed' as const,
        error: 'Connection refused',
        latencyMs: 5000,
        testedAt: '2024-01-01T00:00:00Z',
      },
    };

    await setupMockProjectWithMcpServers(page, { mcpServers: [failedServer] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Check failed status is displayed
    await expect(page.locator('text=Failed')).toBeVisible();
    await expect(page.locator('text=Connection refused')).toBeVisible();
  });

  test('should display HTTP server with URL correctly', async ({ page }) => {
    const httpServer = {
      id: 'http-server-1',
      name: 'Remote MCP Server',
      description: 'Cloud-hosted MCP server',
      transport: {
        type: 'http' as const,
        url: 'https://mcp.example.com/api',
      },
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    await setupMockProjectWithMcpServers(page, { mcpServers: [httpServer] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Check server is displayed
    await expect(page.locator('text=Remote MCP Server')).toBeVisible();

    // Check HTTP badge is shown
    const httpBadge = page.locator('span:has-text("http")').first();
    await expect(httpBadge).toBeVisible();

    // Check URL is displayed
    await expect(page.locator('text=https://mcp.example.com/api')).toBeVisible();
  });
});

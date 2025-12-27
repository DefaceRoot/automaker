/**
 * MCP JSON Config Editor E2E Test
 *
 * Verifies the MCP JSON configuration editor feature:
 * - Opening the JSON editor dialog
 * - Viewing current config as JSON
 * - Editing JSON configuration
 * - JSON validation
 * - Saving configurations
 * - Copy to clipboard functionality
 */

import { test, expect } from '@playwright/test';
import { waitForNetworkIdle } from '../utils';

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

test.describe('MCP JSON Config Editor', () => {
  test('should display Import/Export button in MCP settings header', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Check for Import/Export button
    const importExportButton = page.locator('button:has-text("Import/Export")');
    await expect(importExportButton).toBeVisible();
  });

  test('should open JSON editor dialog when clicking Import/Export button', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Click Import/Export button
    await page.click('button:has-text("Import/Export")');

    // Dialog should open
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Check dialog description is present
    await expect(
      page.locator('text=Edit the raw JSON configuration for all MCP servers')
    ).toBeVisible();

    // Check textarea is present
    const textarea = page.locator('textarea#json-config');
    await expect(textarea).toBeVisible();
  });

  test('should display existing MCP servers as JSON in the editor', async ({ page }) => {
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
    };

    await setupMockProjectWithMcpServers(page, { mcpServers: [testServer] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Click Import/Export button
    await page.click('button:has-text("Import/Export")');

    // Wait for dialog to open
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Wait a moment for the JSON to load
    await page.waitForTimeout(500);

    // Check that the textarea contains JSON with the server info
    const textarea = page.locator('textarea#json-config');
    const value = await textarea.inputValue();

    // Parse and verify the JSON contains our server
    const parsed = JSON.parse(value);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0].name).toBe('Filesystem Server');
    expect(parsed[0].transport.type).toBe('stdio');
  });

  test('should have copy button that copies JSON to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);

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

    // Open dialog
    await page.click('button:has-text("Import/Export")');
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Wait for JSON to load
    await page.waitForTimeout(500);

    // Click copy button
    await page.click('button:has-text("Copy")');

    // Should show success toast
    await expect(page.locator('text=Configuration copied to clipboard')).toBeVisible({
      timeout: 5000,
    });

    // Button text should change to "Copied!"
    await expect(page.locator('button:has-text("Copied!")')).toBeVisible();
  });

  test('should validate JSON on save and show error for invalid JSON', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Open dialog
    await page.click('button:has-text("Import/Export")');
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Enter invalid JSON
    const textarea = page.locator('textarea#json-config');
    await textarea.fill('{ invalid json }');

    // Click save
    await page.click('button:has-text("Save Configuration")');

    // Should show error
    await expect(page.locator('text=JSON Parse Error')).toBeVisible({ timeout: 5000 });
  });

  test('should validate that config must be an array', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Open dialog
    await page.click('button:has-text("Import/Export")');
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Enter valid JSON but not an array
    const textarea = page.locator('textarea#json-config');
    await textarea.fill('{"name": "test"}');

    // Click save
    await page.click('button:has-text("Save Configuration")');

    // Should show error about array requirement
    await expect(page.locator('text=Configuration must be a JSON array')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should close dialog when Cancel button is clicked', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Open dialog
    await page.click('button:has-text("Import/Export")');
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Click Cancel
    await page.click('button:has-text("Cancel")');

    // Dialog should be closed
    await expect(page.locator('text=MCP Server Configuration (JSON)')).not.toBeVisible();
  });

  test('should display help text about required fields', async ({ page }) => {
    await setupMockProjectWithMcpServers(page, { mcpServers: [] });
    await page.goto('/');
    await waitForNetworkIdle(page);
    await navigateToMcpSettings(page);

    // Open dialog
    await page.click('button:has-text("Import/Export")');
    await expect(page.locator('text=MCP Server Configuration (JSON)')).toBeVisible();

    // Check for help text
    await expect(page.locator('text=Required fields:')).toBeVisible();
    await expect(page.locator('text=Transport types:')).toBeVisible();
  });
});

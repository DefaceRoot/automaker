import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SettingsService } from '@/services/settings-service.js';
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_CREDENTIALS,
  DEFAULT_PROJECT_SETTINGS,
  SETTINGS_VERSION,
  CREDENTIALS_VERSION,
  PROJECT_SETTINGS_VERSION,
  type GlobalSettings,
  type Credentials,
  type ProjectSettings,
} from '@/types/settings.js';
import type { McpServerConfig } from '@automaker/types';

describe('settings-service.ts', () => {
  let testDataDir: string;
  let testProjectDir: string;
  let settingsService: SettingsService;

  beforeEach(async () => {
    testDataDir = path.join(os.tmpdir(), `settings-test-${Date.now()}`);
    testProjectDir = path.join(os.tmpdir(), `project-test-${Date.now()}`);
    await fs.mkdir(testDataDir, { recursive: true });
    await fs.mkdir(testProjectDir, { recursive: true });
    settingsService = new SettingsService(testDataDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getGlobalSettings', () => {
    it('should return default settings when file does not exist', async () => {
      const settings = await settingsService.getGlobalSettings();
      expect(settings).toEqual(DEFAULT_GLOBAL_SETTINGS);
    });

    it('should read and return existing settings', async () => {
      const customSettings: GlobalSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        theme: 'light',
        sidebarOpen: false,
        maxConcurrency: 5,
      };
      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(customSettings, null, 2));

      const settings = await settingsService.getGlobalSettings();
      expect(settings.theme).toBe('light');
      expect(settings.sidebarOpen).toBe(false);
      expect(settings.maxConcurrency).toBe(5);
    });

    it('should merge with defaults for missing properties', async () => {
      const partialSettings = {
        version: SETTINGS_VERSION,
        theme: 'dark',
      };
      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(partialSettings, null, 2));

      const settings = await settingsService.getGlobalSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.sidebarOpen).toBe(DEFAULT_GLOBAL_SETTINGS.sidebarOpen);
      expect(settings.maxConcurrency).toBe(DEFAULT_GLOBAL_SETTINGS.maxConcurrency);
    });

    it('should merge keyboard shortcuts deeply', async () => {
      const customSettings: GlobalSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        keyboardShortcuts: {
          ...DEFAULT_GLOBAL_SETTINGS.keyboardShortcuts,
          board: 'B',
        },
      };
      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(customSettings, null, 2));

      const settings = await settingsService.getGlobalSettings();
      expect(settings.keyboardShortcuts.board).toBe('B');
      expect(settings.keyboardShortcuts.agent).toBe(
        DEFAULT_GLOBAL_SETTINGS.keyboardShortcuts.agent
      );
    });
  });

  describe('updateGlobalSettings', () => {
    it('should create settings file with updates', async () => {
      const updates: Partial<GlobalSettings> = {
        theme: 'light',
        sidebarOpen: false,
      };

      const updated = await settingsService.updateGlobalSettings(updates);

      expect(updated.theme).toBe('light');
      expect(updated.sidebarOpen).toBe(false);
      expect(updated.version).toBe(SETTINGS_VERSION);

      const settingsPath = path.join(testDataDir, 'settings.json');
      const fileContent = await fs.readFile(settingsPath, 'utf-8');
      const saved = JSON.parse(fileContent);
      expect(saved.theme).toBe('light');
      expect(saved.sidebarOpen).toBe(false);
    });

    it('should merge updates with existing settings', async () => {
      const initial: GlobalSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        theme: 'dark',
        maxConcurrency: 3,
      };
      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(initial, null, 2));

      const updates: Partial<GlobalSettings> = {
        theme: 'light',
      };

      const updated = await settingsService.updateGlobalSettings(updates);

      expect(updated.theme).toBe('light');
      expect(updated.maxConcurrency).toBe(3); // Preserved from initial
    });

    it('should deep merge keyboard shortcuts', async () => {
      const updates: Partial<GlobalSettings> = {
        keyboardShortcuts: {
          board: 'B',
        },
      };

      const updated = await settingsService.updateGlobalSettings(updates);

      expect(updated.keyboardShortcuts.board).toBe('B');
      expect(updated.keyboardShortcuts.agent).toBe(DEFAULT_GLOBAL_SETTINGS.keyboardShortcuts.agent);
    });

    it('should create data directory if it does not exist', async () => {
      const newDataDir = path.join(os.tmpdir(), `new-data-dir-${Date.now()}`);
      const newService = new SettingsService(newDataDir);

      await newService.updateGlobalSettings({ theme: 'light' });

      const stats = await fs.stat(newDataDir);
      expect(stats.isDirectory()).toBe(true);

      await fs.rm(newDataDir, { recursive: true, force: true });
    });
  });

  describe('hasGlobalSettings', () => {
    it('should return false when settings file does not exist', async () => {
      const exists = await settingsService.hasGlobalSettings();
      expect(exists).toBe(false);
    });

    it('should return true when settings file exists', async () => {
      await settingsService.updateGlobalSettings({ theme: 'light' });
      const exists = await settingsService.hasGlobalSettings();
      expect(exists).toBe(true);
    });
  });

  describe('getCredentials', () => {
    it('should return default credentials when file does not exist', async () => {
      const credentials = await settingsService.getCredentials();
      expect(credentials).toEqual(DEFAULT_CREDENTIALS);
    });

    it('should read and return existing credentials', async () => {
      const customCredentials: Credentials = {
        ...DEFAULT_CREDENTIALS,
        apiKeys: {
          anthropic: 'sk-test-key',
        },
      };
      const credentialsPath = path.join(testDataDir, 'credentials.json');
      await fs.writeFile(credentialsPath, JSON.stringify(customCredentials, null, 2));

      const credentials = await settingsService.getCredentials();
      expect(credentials.apiKeys.anthropic).toBe('sk-test-key');
    });

    it('should merge with defaults for missing api keys', async () => {
      const partialCredentials = {
        version: CREDENTIALS_VERSION,
        apiKeys: {
          anthropic: 'sk-test',
        },
      };
      const credentialsPath = path.join(testDataDir, 'credentials.json');
      await fs.writeFile(credentialsPath, JSON.stringify(partialCredentials, null, 2));

      const credentials = await settingsService.getCredentials();
      expect(credentials.apiKeys.anthropic).toBe('sk-test');
    });
  });

  describe('updateCredentials', () => {
    it('should create credentials file with updates', async () => {
      const updates: Partial<Credentials> = {
        apiKeys: {
          anthropic: 'sk-test-key',
        },
      };

      const updated = await settingsService.updateCredentials(updates);

      expect(updated.apiKeys.anthropic).toBe('sk-test-key');
      expect(updated.version).toBe(CREDENTIALS_VERSION);

      const credentialsPath = path.join(testDataDir, 'credentials.json');
      const fileContent = await fs.readFile(credentialsPath, 'utf-8');
      const saved = JSON.parse(fileContent);
      expect(saved.apiKeys.anthropic).toBe('sk-test-key');
    });

    it('should merge updates with existing credentials', async () => {
      const initial: Credentials = {
        ...DEFAULT_CREDENTIALS,
        apiKeys: {
          anthropic: 'sk-initial',
        },
      };
      const credentialsPath = path.join(testDataDir, 'credentials.json');
      await fs.writeFile(credentialsPath, JSON.stringify(initial, null, 2));

      const updates: Partial<Credentials> = {
        apiKeys: {
          anthropic: 'sk-updated',
        },
      };

      const updated = await settingsService.updateCredentials(updates);

      expect(updated.apiKeys.anthropic).toBe('sk-updated');
    });

    it('should deep merge api keys', async () => {
      const initial: Credentials = {
        ...DEFAULT_CREDENTIALS,
        apiKeys: {
          anthropic: 'sk-anthropic',
        },
      };
      const credentialsPath = path.join(testDataDir, 'credentials.json');
      await fs.writeFile(credentialsPath, JSON.stringify(initial, null, 2));

      const updates: Partial<Credentials> = {
        apiKeys: {
          anthropic: 'sk-updated-anthropic',
        },
      };

      const updated = await settingsService.updateCredentials(updates);

      expect(updated.apiKeys.anthropic).toBe('sk-updated-anthropic');
    });
  });

  describe('getMaskedCredentials', () => {
    it('should return masked credentials for empty keys', async () => {
      const masked = await settingsService.getMaskedCredentials();
      expect(masked.anthropic.configured).toBe(false);
      expect(masked.anthropic.masked).toBe('');
    });

    it('should mask keys correctly', async () => {
      await settingsService.updateCredentials({
        apiKeys: {
          anthropic: 'sk-ant-api03-1234567890abcdef',
        },
      });

      const masked = await settingsService.getMaskedCredentials();
      expect(masked.anthropic.configured).toBe(true);
      expect(masked.anthropic.masked).toBe('sk-a...cdef');
    });

    it('should handle short keys', async () => {
      await settingsService.updateCredentials({
        apiKeys: {
          anthropic: 'short',
        },
      });

      const masked = await settingsService.getMaskedCredentials();
      expect(masked.anthropic.configured).toBe(true);
      expect(masked.anthropic.masked).toBe('');
    });
  });

  describe('hasCredentials', () => {
    it('should return false when credentials file does not exist', async () => {
      const exists = await settingsService.hasCredentials();
      expect(exists).toBe(false);
    });

    it('should return true when credentials file exists', async () => {
      await settingsService.updateCredentials({
        apiKeys: { anthropic: 'test' },
      });
      const exists = await settingsService.hasCredentials();
      expect(exists).toBe(true);
    });
  });

  describe('getProjectSettings', () => {
    it('should return default settings when file does not exist', async () => {
      const settings = await settingsService.getProjectSettings(testProjectDir);
      expect(settings).toEqual(DEFAULT_PROJECT_SETTINGS);
    });

    it('should read and return existing project settings', async () => {
      const customSettings: ProjectSettings = {
        ...DEFAULT_PROJECT_SETTINGS,
        theme: 'light',
        useWorktrees: true,
      };
      const automakerDir = path.join(testProjectDir, '.automaker');
      await fs.mkdir(automakerDir, { recursive: true });
      const settingsPath = path.join(automakerDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(customSettings, null, 2));

      const settings = await settingsService.getProjectSettings(testProjectDir);
      expect(settings.theme).toBe('light');
      expect(settings.useWorktrees).toBe(true);
    });

    it('should merge with defaults for missing properties', async () => {
      const partialSettings = {
        version: PROJECT_SETTINGS_VERSION,
        theme: 'dark',
      };
      const automakerDir = path.join(testProjectDir, '.automaker');
      await fs.mkdir(automakerDir, { recursive: true });
      const settingsPath = path.join(automakerDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(partialSettings, null, 2));

      const settings = await settingsService.getProjectSettings(testProjectDir);
      expect(settings.theme).toBe('dark');
      expect(settings.version).toBe(PROJECT_SETTINGS_VERSION);
    });
  });

  describe('updateProjectSettings', () => {
    it('should create project settings file with updates', async () => {
      const updates: Partial<ProjectSettings> = {
        theme: 'light',
        useWorktrees: true,
      };

      const updated = await settingsService.updateProjectSettings(testProjectDir, updates);

      expect(updated.theme).toBe('light');
      expect(updated.useWorktrees).toBe(true);
      expect(updated.version).toBe(PROJECT_SETTINGS_VERSION);

      const automakerDir = path.join(testProjectDir, '.automaker');
      const settingsPath = path.join(automakerDir, 'settings.json');
      const fileContent = await fs.readFile(settingsPath, 'utf-8');
      const saved = JSON.parse(fileContent);
      expect(saved.theme).toBe('light');
      expect(saved.useWorktrees).toBe(true);
    });

    it('should merge updates with existing project settings', async () => {
      const initial: ProjectSettings = {
        ...DEFAULT_PROJECT_SETTINGS,
        theme: 'dark',
        useWorktrees: false,
      };
      const automakerDir = path.join(testProjectDir, '.automaker');
      await fs.mkdir(automakerDir, { recursive: true });
      const settingsPath = path.join(automakerDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(initial, null, 2));

      const updates: Partial<ProjectSettings> = {
        theme: 'light',
      };

      const updated = await settingsService.updateProjectSettings(testProjectDir, updates);

      expect(updated.theme).toBe('light');
      expect(updated.useWorktrees).toBe(false); // Preserved
    });

    it('should deep merge board background', async () => {
      const initial: ProjectSettings = {
        ...DEFAULT_PROJECT_SETTINGS,
        boardBackground: {
          imagePath: '/path/to/image.jpg',
          cardOpacity: 0.8,
          columnOpacity: 0.9,
          columnBorderEnabled: true,
          cardGlassmorphism: false,
          cardBorderEnabled: true,
          cardBorderOpacity: 0.5,
          hideScrollbar: false,
        },
      };
      const automakerDir = path.join(testProjectDir, '.automaker');
      await fs.mkdir(automakerDir, { recursive: true });
      const settingsPath = path.join(automakerDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(initial, null, 2));

      const updates: Partial<ProjectSettings> = {
        boardBackground: {
          cardOpacity: 0.9,
        },
      };

      const updated = await settingsService.updateProjectSettings(testProjectDir, updates);

      expect(updated.boardBackground?.imagePath).toBe('/path/to/image.jpg');
      expect(updated.boardBackground?.cardOpacity).toBe(0.9);
      expect(updated.boardBackground?.columnOpacity).toBe(0.9);
    });

    it('should create .automaker directory if it does not exist', async () => {
      const newProjectDir = path.join(os.tmpdir(), `new-project-${Date.now()}`);

      await settingsService.updateProjectSettings(newProjectDir, { theme: 'light' });

      const automakerDir = path.join(newProjectDir, '.automaker');
      const stats = await fs.stat(automakerDir);
      expect(stats.isDirectory()).toBe(true);

      await fs.rm(newProjectDir, { recursive: true, force: true });
    });
  });

  describe('hasProjectSettings', () => {
    it('should return false when project settings file does not exist', async () => {
      const exists = await settingsService.hasProjectSettings(testProjectDir);
      expect(exists).toBe(false);
    });

    it('should return true when project settings file exists', async () => {
      await settingsService.updateProjectSettings(testProjectDir, { theme: 'light' });
      const exists = await settingsService.hasProjectSettings(testProjectDir);
      expect(exists).toBe(true);
    });
  });

  describe('migrateFromLocalStorage', () => {
    it('should migrate global settings from localStorage data', async () => {
      const localStorageData = {
        'automaker-storage': JSON.stringify({
          state: {
            theme: 'light',
            sidebarOpen: false,
            maxConcurrency: 5,
          },
        }),
      };

      const result = await settingsService.migrateFromLocalStorage(localStorageData);

      expect(result.success).toBe(true);
      expect(result.migratedGlobalSettings).toBe(true);
      expect(result.migratedCredentials).toBe(false);
      expect(result.migratedProjectCount).toBe(0);

      const settings = await settingsService.getGlobalSettings();
      expect(settings.theme).toBe('light');
      expect(settings.sidebarOpen).toBe(false);
      expect(settings.maxConcurrency).toBe(5);
    });

    it('should migrate credentials from localStorage data', async () => {
      const localStorageData = {
        'automaker-storage': JSON.stringify({
          state: {
            apiKeys: {
              anthropic: 'sk-test-key',
            },
          },
        }),
      };

      const result = await settingsService.migrateFromLocalStorage(localStorageData);

      expect(result.success).toBe(true);
      expect(result.migratedCredentials).toBe(true);

      const credentials = await settingsService.getCredentials();
      expect(credentials.apiKeys.anthropic).toBe('sk-test-key');
    });

    it('should migrate project settings from localStorage data', async () => {
      const localStorageData = {
        'automaker-storage': JSON.stringify({
          state: {
            projects: [
              {
                id: 'proj1',
                name: 'Project 1',
                path: testProjectDir,
                theme: 'light',
              },
            ],
            boardBackgroundByProject: {
              [testProjectDir]: {
                imagePath: '/path/to/image.jpg',
                cardOpacity: 0.8,
                columnOpacity: 0.9,
                columnBorderEnabled: true,
                cardGlassmorphism: false,
                cardBorderEnabled: true,
                cardBorderOpacity: 0.5,
                hideScrollbar: false,
              },
            },
          },
        }),
      };

      const result = await settingsService.migrateFromLocalStorage(localStorageData);

      expect(result.success).toBe(true);
      expect(result.migratedProjectCount).toBe(1);

      const projectSettings = await settingsService.getProjectSettings(testProjectDir);
      expect(projectSettings.theme).toBe('light');
      expect(projectSettings.boardBackground?.imagePath).toBe('/path/to/image.jpg');
    });

    it('should handle direct localStorage values', async () => {
      const localStorageData = {
        'automaker:lastProjectDir': '/path/to/project',
        'file-browser-recent-folders': JSON.stringify(['/path1', '/path2']),
        'worktree-panel-collapsed': 'true',
      };

      const result = await settingsService.migrateFromLocalStorage(localStorageData);

      expect(result.success).toBe(true);
      const settings = await settingsService.getGlobalSettings();
      expect(settings.lastProjectDir).toBe('/path/to/project');
      expect(settings.recentFolders).toEqual(['/path1', '/path2']);
      expect(settings.worktreePanelCollapsed).toBe(true);
    });

    it('should handle invalid JSON gracefully', async () => {
      const localStorageData = {
        'automaker-storage': 'invalid json',
        'file-browser-recent-folders': 'invalid json',
      };

      const result = await settingsService.migrateFromLocalStorage(localStorageData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle migration errors gracefully', async () => {
      // Create a read-only directory to cause write errors
      const readOnlyDir = path.join(os.tmpdir(), `readonly-${Date.now()}`);
      await fs.mkdir(readOnlyDir, { recursive: true });
      await fs.chmod(readOnlyDir, 0o444);

      const readOnlyService = new SettingsService(readOnlyDir);
      const localStorageData = {
        'automaker-storage': JSON.stringify({
          state: { theme: 'light' },
        }),
      };

      const result = await readOnlyService.migrateFromLocalStorage(localStorageData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      await fs.chmod(readOnlyDir, 0o755);
      await fs.rm(readOnlyDir, { recursive: true, force: true });
    });
  });

  describe('getDataDir', () => {
    it('should return the data directory path', () => {
      const dataDir = settingsService.getDataDir();
      expect(dataDir).toBe(testDataDir);
    });
  });

  describe('atomicWriteJson', () => {
    it('should handle write errors and clean up temp file', async () => {
      // Create a read-only directory to cause write errors
      const readOnlyDir = path.join(os.tmpdir(), `readonly-${Date.now()}`);
      await fs.mkdir(readOnlyDir, { recursive: true });
      await fs.chmod(readOnlyDir, 0o444);

      const readOnlyService = new SettingsService(readOnlyDir);

      await expect(readOnlyService.updateGlobalSettings({ theme: 'light' })).rejects.toThrow();

      await fs.chmod(readOnlyDir, 0o755);
      await fs.rm(readOnlyDir, { recursive: true, force: true });
    });
  });

  describe('MCP Server Configuration', () => {
    it('should include empty mcpServers array in default settings', async () => {
      const settings = await settingsService.getGlobalSettings();
      expect(settings.mcpServers).toEqual([]);
    });

    it('should read and return existing mcpServers configuration', async () => {
      const mcpServer: McpServerConfig = {
        id: 'test-server-1',
        name: 'Test MCP Server',
        description: 'A test MCP server',
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-test'],
        },
        enabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const customSettings: GlobalSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        mcpServers: [mcpServer],
      };
      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(customSettings, null, 2));

      const settings = await settingsService.getGlobalSettings();
      expect(settings.mcpServers).toHaveLength(1);
      expect(settings.mcpServers[0].id).toBe('test-server-1');
      expect(settings.mcpServers[0].name).toBe('Test MCP Server');
      expect(settings.mcpServers[0].transport.type).toBe('stdio');
    });

    it('should update mcpServers configuration', async () => {
      const mcpServer: McpServerConfig = {
        id: 'new-server',
        name: 'New MCP Server',
        transport: {
          type: 'http',
          url: 'https://mcp.example.com',
        },
        enabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const updated = await settingsService.updateGlobalSettings({
        mcpServers: [mcpServer],
      });

      expect(updated.mcpServers).toHaveLength(1);
      expect(updated.mcpServers[0].id).toBe('new-server');
      expect(updated.mcpServers[0].transport.type).toBe('http');
      if (updated.mcpServers[0].transport.type === 'http') {
        expect(updated.mcpServers[0].transport.url).toBe('https://mcp.example.com');
      }

      const settingsPath = path.join(testDataDir, 'settings.json');
      const fileContent = await fs.readFile(settingsPath, 'utf-8');
      const saved = JSON.parse(fileContent);
      expect(saved.mcpServers).toHaveLength(1);
      expect(saved.mcpServers[0].id).toBe('new-server');
    });

    it('should preserve mcpServers when updating other settings', async () => {
      const mcpServer: McpServerConfig = {
        id: 'preserved-server',
        name: 'Preserved Server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        enabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      await settingsService.updateGlobalSettings({
        mcpServers: [mcpServer],
      });

      const updated = await settingsService.updateGlobalSettings({
        theme: 'light',
      });

      expect(updated.theme).toBe('light');
      expect(updated.mcpServers).toHaveLength(1);
      expect(updated.mcpServers[0].id).toBe('preserved-server');
    });

    it('should support multiple MCP servers', async () => {
      const stdioServer: McpServerConfig = {
        id: 'stdio-server',
        name: 'Stdio Server',
        transport: {
          type: 'stdio',
          command: 'python',
          args: ['mcp_server.py'],
          env: { DEBUG: 'true' },
        },
        enabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const httpServer: McpServerConfig = {
        id: 'http-server',
        name: 'HTTP Server',
        transport: {
          type: 'http',
          url: 'https://api.example.com/mcp',
          headers: { Authorization: 'Bearer token123' },
        },
        enabled: false,
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      const updated = await settingsService.updateGlobalSettings({
        mcpServers: [stdioServer, httpServer],
      });

      expect(updated.mcpServers).toHaveLength(2);
      expect(updated.mcpServers[0].id).toBe('stdio-server');
      expect(updated.mcpServers[0].enabled).toBe(true);
      expect(updated.mcpServers[1].id).toBe('http-server');
      expect(updated.mcpServers[1].enabled).toBe(false);
    });

    it('should handle MCP server with optional description', async () => {
      const serverWithDescription: McpServerConfig = {
        id: 'desc-server',
        name: 'Server With Description',
        description: 'This server provides filesystem access',
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        },
        enabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const serverWithoutDescription: McpServerConfig = {
        id: 'no-desc-server',
        name: 'Server Without Description',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        enabled: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const updated = await settingsService.updateGlobalSettings({
        mcpServers: [serverWithDescription, serverWithoutDescription],
      });

      expect(updated.mcpServers[0].description).toBe('This server provides filesystem access');
      expect(updated.mcpServers[1].description).toBeUndefined();
    });
  });

  describe('Settings Version Migration', () => {
    it('should migrate v1 settings to v2 by adding mcpServers', async () => {
      const v1Settings = {
        version: 1,
        theme: 'dark',
        sidebarOpen: true,
        chatHistoryOpen: false,
        kanbanCardDetailLevel: 'standard',
        maxConcurrency: 3,
        defaultSkipTests: true,
        enableDependencyBlocking: true,
        useWorktrees: false,
        showProfilesOnly: false,
        defaultPlanningMode: 'skip',
        defaultRequirePlanApproval: false,
        defaultAIProfileId: null,
        muteDoneSound: false,
        enhancementModel: 'sonnet',
        keyboardShortcuts: DEFAULT_GLOBAL_SETTINGS.keyboardShortcuts,
        aiProfiles: [],
        projects: [],
        trashedProjects: [],
        projectHistory: [],
        projectHistoryIndex: -1,
        recentFolders: [],
        worktreePanelCollapsed: false,
        lastSelectedSessionByProject: {},
      };

      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(v1Settings, null, 2));

      const settings = await settingsService.getGlobalSettings();

      expect(settings.version).toBe(SETTINGS_VERSION);
      expect(settings.mcpServers).toEqual([]);
      expect(settings.theme).toBe('dark');
    });

    it('should migrate settings without version field to v2', async () => {
      const noVersionSettings = {
        theme: 'light',
        sidebarOpen: false,
      };

      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(noVersionSettings, null, 2));

      const settings = await settingsService.getGlobalSettings();

      expect(settings.version).toBe(SETTINGS_VERSION);
      expect(settings.mcpServers).toEqual([]);
      expect(settings.theme).toBe('light');
      expect(settings.sidebarOpen).toBe(false);
    });

    it('should preserve existing mcpServers during v1 to v2 migration', async () => {
      const v1SettingsWithMcp = {
        version: 1,
        theme: 'dark',
        mcpServers: [
          {
            id: 'existing-server',
            name: 'Existing Server',
            transport: { type: 'stdio', command: 'node', args: ['server.js'] },
            enabled: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(v1SettingsWithMcp, null, 2));

      const settings = await settingsService.getGlobalSettings();

      expect(settings.version).toBe(SETTINGS_VERSION);
      expect(settings.mcpServers).toHaveLength(1);
      expect(settings.mcpServers[0].id).toBe('existing-server');
    });

    it('should not re-migrate v2 settings', async () => {
      const v2Settings: GlobalSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        version: 2,
        mcpServers: [
          {
            id: 'v2-server',
            name: 'V2 Server',
            transport: { type: 'http', url: 'https://example.com' },
            enabled: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      const settingsPath = path.join(testDataDir, 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(v2Settings, null, 2));

      const settings = await settingsService.getGlobalSettings();

      expect(settings.version).toBe(2);
      expect(settings.mcpServers).toHaveLength(1);
      expect(settings.mcpServers[0].id).toBe('v2-server');
    });

    it('should verify SETTINGS_VERSION is 2 for MCP support', () => {
      expect(SETTINGS_VERSION).toBe(2);
    });
  });
});

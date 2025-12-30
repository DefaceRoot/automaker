import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import chokidar from 'chokidar';
import type { EventEmitter } from '../lib/events.js';
import { ClaudeUsage } from '../routes/claude/types.js';

/**
 * Usage entry extracted from JSONL files
 */
interface UsageEntry {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
}

/**
 * Claude Usage Service
 *
 * Fetches usage data by reading Claude Code's local JSONL log files directly.
 * This approach works on all platforms (Windows, Mac, Linux) without requiring
 * PTY or spawning CLI processes.
 *
 * Features:
 * - Cross-platform JSONL file reading
 * - Real-time updates via file watching
 * - 5-hour session and weekly usage aggregation
 *
 * References:
 * - ccusage: https://github.com/ryoppippi/ccusage
 * - Claude Code stores logs at: ~/.claude/projects/
 */
export class ClaudeUsageService {
  private dataDir: string | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private cachedUsage: ClaudeUsage | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache
  private events: EventEmitter | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(events?: EventEmitter) {
    this.events = events ?? null;
    this.dataDir = this.findClaudeDataDir();

    if (this.dataDir) {
      console.log(`[ClaudeUsageService] Found Claude data directory: ${this.dataDir}`);
      this.initFileWatcher();
    } else {
      console.log(
        '[ClaudeUsageService] Claude data directory not found - usage tracking unavailable'
      );
    }
  }

  /**
   * Find the Claude Code data directory (cross-platform)
   */
  private findClaudeDataDir(): string | null {
    const home = os.homedir();

    // Check these paths in order of preference
    const paths = [
      process.env.CLAUDE_CONFIG_DIR ? path.join(process.env.CLAUDE_CONFIG_DIR, 'projects') : null,
      path.join(home, '.claude', 'projects'),
      path.join(home, '.config', 'claude', 'projects'),
    ].filter((p): p is string => p !== null);

    for (const p of paths) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          return p;
        }
      } catch {
        // Ignore permission errors
      }
    }

    return null;
  }

  /**
   * Initialize file watcher for real-time updates
   */
  private initFileWatcher(): void {
    if (!this.dataDir || !this.events) return;

    try {
      this.watcher = chokidar.watch(this.dataDir, {
        persistent: true,
        ignoreInitial: true,
        depth: 10, // Deep enough for nested project directories
        usePolling: false, // Use native file watching (better performance)
        awaitWriteFinish: {
          stabilityThreshold: 500, // Wait for file to finish writing
          pollInterval: 100,
        },
      });

      // Watch for changes to JSONL files
      this.watcher.on('change', (filePath) => {
        if (filePath.endsWith('.jsonl')) {
          this.handleFileChange();
        }
      });

      this.watcher.on('add', (filePath) => {
        if (filePath.endsWith('.jsonl')) {
          this.handleFileChange();
        }
      });

      this.watcher.on('error', (error) => {
        console.error('[ClaudeUsageService] File watcher error:', error);
      });

      console.log('[ClaudeUsageService] File watcher initialized');
    } catch (error) {
      console.error('[ClaudeUsageService] Failed to initialize file watcher:', error);
    }
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(): void {
    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        // Invalidate cache
        this.cachedUsage = null;
        this.cacheTimestamp = 0;

        // Refresh usage and emit event
        const usage = await this.fetchUsageData();
        if (this.events) {
          this.events.emit('claude:usage-update', usage);
        }
      } catch (error) {
        console.error('[ClaudeUsageService] Error refreshing usage on file change:', error);
      }
    }, 1000);
  }

  /**
   * Check if Claude Code data directory exists
   */
  async isAvailable(): Promise<boolean> {
    return this.dataDir !== null;
  }

  /**
   * Fetch usage data from JSONL files
   */
  async fetchUsageData(): Promise<ClaudeUsage> {
    // Return cached data if still valid
    const now = Date.now();
    if (this.cachedUsage && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedUsage;
    }

    if (!this.dataDir) {
      return this.getDefaultUsage('Claude data directory not found');
    }

    try {
      const jsonlFiles = await this.discoverJsonlFiles();
      if (jsonlFiles.length === 0) {
        return this.getDefaultUsage('No usage data found');
      }

      const entries = await this.parseJsonlFiles(jsonlFiles);
      const usage = this.aggregateUsage(entries);

      // Cache the result
      this.cachedUsage = usage;
      this.cacheTimestamp = now;

      return usage;
    } catch (error) {
      console.error('[ClaudeUsageService] Error fetching usage data:', error);
      return this.getDefaultUsage(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Discover all JSONL files in the data directory
   */
  private async discoverJsonlFiles(): Promise<string[]> {
    if (!this.dataDir) return [];

    const files: string[] = [];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors for specific directories
        if ((error as NodeJS.ErrnoException).code !== 'EACCES') {
          console.warn(`[ClaudeUsageService] Error scanning ${dir}:`, error);
        }
      }
    };

    await scanDirectory(this.dataDir);
    return files;
  }

  /**
   * Parse JSONL files and extract usage entries
   */
  private async parseJsonlFiles(files: string[]): Promise<UsageEntry[]> {
    const entries: UsageEntry[] = [];
    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      try {
        // Check file modification time - skip old files for performance
        const stats = await fs.promises.stat(file);
        if (stats.mtimeMs < oneWeekAgo) {
          continue; // Skip files not modified in the last week
        }

        const fileEntries = await this.parseJsonlFile(file, fiveHoursAgo, oneWeekAgo);
        entries.push(...fileEntries);
      } catch (error) {
        // Ignore individual file errors
        console.warn(`[ClaudeUsageService] Error parsing ${file}:`, error);
      }
    }

    return entries;
  }

  /**
   * Parse a single JSONL file
   */
  private async parseJsonlFile(
    filePath: string,
    fiveHoursAgo: number,
    oneWeekAgo: number
  ): Promise<UsageEntry[]> {
    const entries: UsageEntry[] = [];

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line);

        // Extract timestamp
        const timestamp = json.timestamp || json.message?.timestamp;
        if (!timestamp) continue;

        const entryTime = new Date(timestamp).getTime();
        if (isNaN(entryTime) || entryTime < oneWeekAgo) continue;

        // Extract usage data from message.usage
        const usage = json.message?.usage;
        if (!usage) continue;

        const entry: UsageEntry = {
          timestamp,
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheCreationTokens: usage.cache_creation_input_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          model: json.message?.model || 'unknown',
        };

        // Only include if there's actual usage data
        if (entry.inputTokens > 0 || entry.outputTokens > 0) {
          entries.push(entry);
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return entries;
  }

  /**
   * Aggregate usage entries into session (5-hour) and weekly totals
   */
  private aggregateUsage(entries: UsageEntry[]): ClaudeUsage {
    const now = Date.now();
    const fiveHoursAgo = now - 5 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Session (5-hour) totals
    let sessionInputTokens = 0;
    let sessionOutputTokens = 0;
    let sessionCacheTokens = 0;
    let sessionFirstMessage: number | null = null;

    // Weekly totals
    let weeklyInputTokens = 0;
    let weeklyOutputTokens = 0;
    let weeklyCacheTokens = 0;

    // Model-specific tracking
    let opusTokens = 0;
    let sonnetTokens = 0;

    for (const entry of entries) {
      const entryTime = new Date(entry.timestamp).getTime();
      const totalTokens = entry.inputTokens + entry.outputTokens;

      // Weekly aggregation
      if (entryTime >= oneWeekAgo) {
        weeklyInputTokens += entry.inputTokens;
        weeklyOutputTokens += entry.outputTokens;
        weeklyCacheTokens += entry.cacheCreationTokens + entry.cacheReadTokens;

        // Track by model
        if (entry.model.toLowerCase().includes('opus')) {
          opusTokens += totalTokens;
        } else if (entry.model.toLowerCase().includes('sonnet')) {
          sonnetTokens += totalTokens;
        }
      }

      // Session (5-hour) aggregation
      if (entryTime >= fiveHoursAgo) {
        sessionInputTokens += entry.inputTokens;
        sessionOutputTokens += entry.outputTokens;
        sessionCacheTokens += entry.cacheCreationTokens + entry.cacheReadTokens;

        if (sessionFirstMessage === null || entryTime < sessionFirstMessage) {
          sessionFirstMessage = entryTime;
        }
      }
    }

    // Calculate totals
    const sessionTotal = sessionInputTokens + sessionOutputTokens;
    const weeklyTotal = weeklyInputTokens + weeklyOutputTokens;

    // Estimate limits based on MAX 20x plan (most generous)
    // These are rough estimates - actual limits depend on plan
    const SESSION_TOKEN_LIMIT = 2_000_000; // ~2M tokens per 5-hour window
    const WEEKLY_TOKEN_LIMIT = 50_000_000; // ~50M tokens per week

    const sessionPercentage = Math.min(100, Math.round((sessionTotal / SESSION_TOKEN_LIMIT) * 100));
    const weeklyPercentage = Math.min(100, Math.round((weeklyTotal / WEEKLY_TOKEN_LIMIT) * 100));
    const sonnetPercentage = Math.min(100, Math.round((sonnetTokens / WEEKLY_TOKEN_LIMIT) * 100));

    // Calculate reset times
    const sessionResetTime = this.calculateSessionResetTime(sessionFirstMessage);
    const weeklyResetTime = this.calculateWeeklyResetTime();

    return {
      sessionTokensUsed: sessionTotal,
      sessionLimit: SESSION_TOKEN_LIMIT,
      sessionPercentage,
      sessionResetTime: sessionResetTime.toISOString(),
      sessionResetText: this.formatResetText(sessionResetTime, 'session'),

      weeklyTokensUsed: weeklyTotal,
      weeklyLimit: WEEKLY_TOKEN_LIMIT,
      weeklyPercentage,
      weeklyResetTime: weeklyResetTime.toISOString(),
      weeklyResetText: this.formatResetText(weeklyResetTime, 'weekly'),

      sonnetWeeklyTokensUsed: sonnetTokens,
      sonnetWeeklyPercentage: sonnetPercentage,
      sonnetResetText: this.formatResetText(weeklyResetTime, 'weekly'),

      costUsed: null, // Cost calculation requires pricing data
      costLimit: null,
      costCurrency: null,

      lastUpdated: new Date().toISOString(),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Calculate when the session resets (5 hours from first message)
   */
  private calculateSessionResetTime(firstMessageTime: number | null): Date {
    if (firstMessageTime === null) {
      // No messages in current session - reset is 5 hours from now
      return new Date(Date.now() + 5 * 60 * 60 * 1000);
    }

    // Session resets 5 hours after first message
    return new Date(firstMessageTime + 5 * 60 * 60 * 1000);
  }

  /**
   * Calculate when the weekly limit resets (Monday at ~12:00 UTC)
   */
  private calculateWeeklyResetTime(): Date {
    const now = new Date();
    const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday

    // Calculate days until next Monday
    let daysUntilMonday = (1 + 7 - currentDay) % 7;
    if (daysUntilMonday === 0) {
      daysUntilMonday = 7; // If today is Monday, next reset is next Monday
    }

    const resetDate = new Date(now);
    resetDate.setUTCDate(resetDate.getUTCDate() + daysUntilMonday);
    resetDate.setUTCHours(12, 0, 0, 0); // 12:00 UTC

    return resetDate;
  }

  /**
   * Format reset time as human-readable text
   */
  private formatResetText(resetTime: Date, type: 'session' | 'weekly'): string {
    const now = Date.now();
    const resetMs = resetTime.getTime();
    const diffMs = resetMs - now;

    if (diffMs <= 0) {
      return 'Resetting soon';
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (type === 'session') {
      if (hours > 0) {
        return `Resets in ${hours}h ${minutes}m`;
      }
      return `Resets in ${minutes}m`;
    }

    // Weekly - show date
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    return `Resets ${formatter.format(resetTime)}`;
  }

  /**
   * Get default usage data when no data is available
   */
  private getDefaultUsage(message: string): ClaudeUsage {
    console.log(`[ClaudeUsageService] Returning default usage: ${message}`);

    return {
      sessionTokensUsed: 0,
      sessionLimit: 0,
      sessionPercentage: 0,
      sessionResetTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      sessionResetText: 'No usage data',

      weeklyTokensUsed: 0,
      weeklyLimit: 0,
      weeklyPercentage: 0,
      weeklyResetTime: this.calculateWeeklyResetTime().toISOString(),
      weeklyResetText: 'No usage data',

      sonnetWeeklyTokensUsed: 0,
      sonnetWeeklyPercentage: 0,
      sonnetResetText: 'No usage data',

      costUsed: null,
      costLimit: null,
      costCurrency: null,

      lastUpdated: new Date().toISOString(),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

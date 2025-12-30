import * as pty from 'node-pty';
import * as os from 'os';
import { spawn } from 'child_process';
import type { EventEmitter } from '../lib/events.js';
import type { ClaudeUsage } from '../routes/claude/types.js';

/**
 * Error types for Claude Usage Service
 */
export enum ClaudeUsageErrorCode {
  CLI_NOT_INSTALLED = 'CLI_NOT_INSTALLED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  TIMEOUT = 'TIMEOUT',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class ClaudeUsageError extends Error {
  constructor(
    public code: ClaudeUsageErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ClaudeUsageError';
  }
}

/**
 * Claude Usage Service - PTY-based implementation
 *
 * Fetches usage data by spawning Claude Code CLI via PTY,
 * sending the /usage command, and parsing the output.
 *
 * Features:
 * - Headless PTY operation (no visible terminal window)
 * - Rate-limited caching (30 second minimum between fetches)
 * - Cross-platform support (Windows ConPTY, Unix PTY)
 * - Structured error handling
 * - Real-time updates via EventEmitter
 */
export class ClaudeUsagePtyService {
  private cachedUsage: ClaudeUsage | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache
  private readonly COMMAND_TIMEOUT_MS = 20000; // 20 seconds timeout
  private events: EventEmitter | null = null;
  private isWindows: boolean;
  private fetchInProgress: boolean = false;
  private pendingFetchPromise: Promise<ClaudeUsage> | null = null;

  constructor(events?: EventEmitter) {
    this.events = events ?? null;
    this.isWindows = os.platform() === 'win32';
  }

  /**
   * Check if Claude CLI is installed and in PATH
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const command = this.isWindows ? 'where' : 'which';
      const proc = spawn(command, ['claude'], {
        shell: true,
        windowsHide: true,
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Fetch usage data from Claude CLI via PTY
   * Results are cached for 30 seconds to avoid excessive process spawning
   */
  async fetchUsageData(): Promise<ClaudeUsage> {
    // Return cached data if still valid
    const now = Date.now();
    if (this.cachedUsage && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedUsage;
    }

    // If a fetch is already in progress, wait for it
    if (this.fetchInProgress && this.pendingFetchPromise) {
      return this.pendingFetchPromise;
    }

    // Start new fetch
    this.fetchInProgress = true;
    this.pendingFetchPromise = this.doFetchUsageData();

    try {
      const result = await this.pendingFetchPromise;
      return result;
    } finally {
      this.fetchInProgress = false;
      this.pendingFetchPromise = null;
    }
  }

  /**
   * Internal method to actually fetch usage data
   */
  private async doFetchUsageData(): Promise<ClaudeUsage> {
    // Check if CLI is available first
    const available = await this.isAvailable();
    if (!available) {
      throw new ClaudeUsageError(
        ClaudeUsageErrorCode.CLI_NOT_INSTALLED,
        'Claude CLI is not installed. Please install Claude Code CLI and run "claude login" to authenticate.'
      );
    }

    return new Promise((resolve, reject) => {
      const shell = this.isWindows ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
      let rawOutput = '';
      let usageDataReceived = false;
      let commandSent = false;
      let enterSent = false;
      let resolved = false;

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: os.homedir(),
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      });

      // Timeout handler
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ptyProcess.kill();
          reject(
            new ClaudeUsageError(
              ClaudeUsageErrorCode.TIMEOUT,
              'Claude CLI command timed out. Please try again.'
            )
          );
        }
      }, this.COMMAND_TIMEOUT_MS);

      // Data handler
      ptyProcess.onData((data) => {
        rawOutput += data;

        const stripped = this.stripAnsiCodes(rawOutput);

        // Check for authentication errors
        if (
          stripped.includes('authentication') ||
          stripped.includes('token_expired') ||
          stripped.includes('login required') ||
          stripped.includes('not logged in')
        ) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            ptyProcess.kill();
            reject(
              new ClaudeUsageError(
                ClaudeUsageErrorCode.AUTH_REQUIRED,
                'Authentication required. Please run "claude login" to authenticate.'
              )
            );
          }
          return;
        }

        // Check if we've received the actual usage data (percentages and reset times)
        if (
          (stripped.includes('% used') || stripped.includes('% left')) &&
          stripped.includes('Resets')
        ) {
          if (!usageDataReceived) {
            usageDataReceived = true;

            // Wait a bit for all data to arrive, then exit
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);

                // Send escape to exit Claude CLI cleanly
                ptyProcess.write('\x1b');
                setTimeout(() => {
                  ptyProcess.kill();

                  // Parse the output
                  try {
                    const usage = this.parseUsageOutput(rawOutput);
                    this.cachedUsage = usage;
                    this.cacheTimestamp = Date.now();

                    // Emit update event
                    if (this.events) {
                      this.events.emit('claude:usage-update', usage);
                    }

                    resolve(usage);
                  } catch (parseError) {
                    reject(
                      new ClaudeUsageError(
                        ClaudeUsageErrorCode.PARSE_ERROR,
                        'Failed to parse usage data from Claude CLI output.'
                      )
                    );
                  }
                }, 500);
              }
            }, 1500);
          }
        }

        // Check if autocomplete menu appeared (need to press Enter to select)
        if (
          stripped.includes('/usage') &&
          stripped.includes('Show plan usage limits') &&
          !enterSent &&
          commandSent
        ) {
          enterSent = true;
          setTimeout(() => {
            ptyProcess.write('\r');
          }, 300);
        }
      });

      // Exit handler
      ptyProcess.onExit(({ exitCode }) => {
        clearTimeout(timeout);

        if (!resolved) {
          resolved = true;

          // If we got usage data, try to parse it
          if (usageDataReceived || rawOutput.includes('% used') || rawOutput.includes('% left')) {
            try {
              const usage = this.parseUsageOutput(rawOutput);
              this.cachedUsage = usage;
              this.cacheTimestamp = Date.now();

              if (this.events) {
                this.events.emit('claude:usage-update', usage);
              }

              resolve(usage);
            } catch {
              reject(
                new ClaudeUsageError(
                  ClaudeUsageErrorCode.PARSE_ERROR,
                  'Failed to parse usage data from Claude CLI output.'
                )
              );
            }
          } else {
            reject(
              new ClaudeUsageError(
                ClaudeUsageErrorCode.UNKNOWN,
                `Claude CLI exited with code ${exitCode} without returning usage data.`
              )
            );
          }
        }
      });

      // Start the command sequence
      setTimeout(() => {
        // Start Claude CLI
        if (this.isWindows) {
          ptyProcess.write('claude\r');
        } else {
          ptyProcess.write('claude\n');
        }

        // Send /usage command after Claude starts
        setTimeout(() => {
          commandSent = true;
          if (this.isWindows) {
            ptyProcess.write('/usage\r');
          } else {
            ptyProcess.write('/usage\n');
          }
        }, 3000);
      }, 500);
    });
  }

  /**
   * Strip ANSI escape codes from text
   */
  private stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  }

  /**
   * Parse usage output from Claude CLI
   */
  private parseUsageOutput(rawOutput: string): ClaudeUsage {
    const output = this.stripAnsiCodes(rawOutput);
    const lines = output.split('\n').map((l) => l.trim());

    // Initialize results
    let sessionPercentage = 0;
    let sessionResetText = '';
    let weeklyPercentage = 0;
    let weeklyResetText = '';
    let sonnetPercentage = 0;
    let sonnetResetText = '';

    // Regex patterns
    const percentUsedRegex = /(\d+)%\s*used/i;
    const percentLeftRegex = /(\d+)%\s*left/i;
    const resetRegex = /resets?\s+(?:in\s+)?(.+)/i;

    // Track which sections we've found
    let inSessionSection = false;
    let inWeeklySection = false;
    let inSonnetSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const originalLine = lines[i];

      // Detect section transitions
      if (
        line.includes('current session') ||
        (line.includes('session') && line.includes('usage'))
      ) {
        inSessionSection = true;
        inWeeklySection = false;
        inSonnetSection = false;
      } else if ((line.includes('weekly') && line.includes('all')) || line.includes('all models')) {
        inSessionSection = false;
        inWeeklySection = true;
        inSonnetSection = false;
      } else if (line.includes('sonnet')) {
        inSessionSection = false;
        inWeeklySection = false;
        inSonnetSection = true;
      }

      // Extract percentage
      const usedMatch = originalLine.match(percentUsedRegex);
      const leftMatch = originalLine.match(percentLeftRegex);
      let percentage: number | null = null;

      if (usedMatch) {
        percentage = parseInt(usedMatch[1], 10);
      } else if (leftMatch) {
        percentage = 100 - parseInt(leftMatch[1], 10);
      }

      if (percentage !== null) {
        if (inSessionSection && sessionPercentage === 0) {
          sessionPercentage = percentage;
        } else if (inWeeklySection && weeklyPercentage === 0) {
          weeklyPercentage = percentage;
        } else if (inSonnetSection && sonnetPercentage === 0) {
          sonnetPercentage = percentage;
        }
      }

      // Extract reset time
      const resetMatch = originalLine.match(resetRegex);
      if (resetMatch) {
        const resetText = 'Resets ' + resetMatch[1].replace(/\(.*?\)/g, '').trim();

        if (inSessionSection && !sessionResetText) {
          sessionResetText = resetText;
        } else if (inWeeklySection && !weeklyResetText) {
          weeklyResetText = resetText;
        } else if (inSonnetSection && !sonnetResetText) {
          sonnetResetText = resetText;
        }
      }
    }

    // Calculate reset times as ISO strings
    const sessionResetTime = this.parseResetTime(sessionResetText, 'session');
    const weeklyResetTime = this.parseResetTime(weeklyResetText, 'weekly');

    return {
      sessionTokensUsed: 0, // Not available from /usage output
      sessionLimit: 0, // Not available from /usage output
      sessionPercentage,
      sessionResetTime,
      sessionResetText: sessionResetText || 'Unknown',

      weeklyTokensUsed: 0, // Not available from /usage output
      weeklyLimit: 0, // Not available from /usage output
      weeklyPercentage,
      weeklyResetTime,
      weeklyResetText: weeklyResetText || 'Unknown',

      sonnetWeeklyTokensUsed: 0, // Not available from /usage output
      sonnetWeeklyPercentage: sonnetPercentage,
      sonnetResetText: sonnetResetText || weeklyResetText || 'Unknown',

      costUsed: null, // Not available from /usage output
      costLimit: null,
      costCurrency: null,

      lastUpdated: new Date().toISOString(),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Parse reset time text into ISO date string
   */
  private parseResetTime(resetText: string, type: 'session' | 'weekly'): string {
    if (!resetText) {
      return this.getDefaultResetTime(type);
    }

    const now = new Date();

    // Pattern: "Resets in Xh Ym" or "Resets in X hr Y min"
    const durationMatch = resetText.match(/in\s+(\d+)\s*h(?:r|our)?s?\s*(?:(\d+)\s*m(?:in)?)?/i);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10) || 0;
      const minutes = parseInt(durationMatch[2], 10) || 0;
      const resetDate = new Date(now.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
      return resetDate.toISOString();
    }

    // Pattern: "Resets in Xm" or "Resets in X min"
    const minutesOnlyMatch = resetText.match(/in\s+(\d+)\s*m(?:in)?/i);
    if (minutesOnlyMatch) {
      const minutes = parseInt(minutesOnlyMatch[1], 10) || 0;
      const resetDate = new Date(now.getTime() + minutes * 60 * 1000);
      return resetDate.toISOString();
    }

    // Pattern: "Resets Fri 7:59 AM" or "Resets Mon 12:00 PM"
    const dayTimeMatch = resetText.match(
      /resets?\s+(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i
    );
    if (dayTimeMatch) {
      const dayName = dayTimeMatch[1].toLowerCase();
      let hours = parseInt(dayTimeMatch[2], 10);
      const minutes = parseInt(dayTimeMatch[3], 10);
      const ampm = (dayTimeMatch[4] || '').toLowerCase();

      // Convert to 24-hour format
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }

      // Find next occurrence of this day
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const targetDay = days.indexOf(dayName.slice(0, 3));
      const currentDay = now.getDay();

      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) {
        daysUntil += 7;
      }

      const resetDate = new Date(now);
      resetDate.setDate(resetDate.getDate() + daysUntil);
      resetDate.setHours(hours, minutes, 0, 0);

      return resetDate.toISOString();
    }

    // Pattern: "Resets Dec 22 at 8pm" or "Resets Jan 15, 3:30pm"
    const dateTimeMatch = resetText.match(
      /resets?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i
    );
    if (dateTimeMatch) {
      const monthName = dateTimeMatch[1].toLowerCase();
      const day = parseInt(dateTimeMatch[2], 10);
      let hours = parseInt(dateTimeMatch[3], 10) || 12;
      const minutes = parseInt(dateTimeMatch[4], 10) || 0;
      const ampm = (dateTimeMatch[5] || 'pm').toLowerCase();

      // Convert to 24-hour format
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }

      const months = [
        'jan',
        'feb',
        'mar',
        'apr',
        'may',
        'jun',
        'jul',
        'aug',
        'sep',
        'oct',
        'nov',
        'dec',
      ];
      const month = months.indexOf(monthName.slice(0, 3));

      const resetDate = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);

      // If the date is in the past, assume next year
      if (resetDate < now) {
        resetDate.setFullYear(resetDate.getFullYear() + 1);
      }

      return resetDate.toISOString();
    }

    return this.getDefaultResetTime(type);
  }

  /**
   * Get default reset time when parsing fails
   */
  private getDefaultResetTime(type: 'session' | 'weekly'): string {
    const now = new Date();

    if (type === 'session') {
      // Default: 5 hours from now
      return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
    } else {
      // Default: next Monday at 12:59 UTC
      const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + daysUntilMonday);
      monday.setHours(12, 59, 0, 0);
      return monday.toISOString();
    }
  }

  /**
   * Invalidate the cache to force a refresh on next fetch
   */
  invalidateCache(): void {
    this.cachedUsage = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get cached usage data without fetching (returns null if no cache)
   */
  getCachedUsage(): ClaudeUsage | null {
    const now = Date.now();
    if (this.cachedUsage && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedUsage;
    }
    return null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cachedUsage = null;
    this.cacheTimestamp = 0;
  }
}

import { spawn, execSync } from 'child_process';
import * as os from 'os';
import { ClaudeUsage } from '../routes/claude/types.js';

/**
 * Claude Usage Service
 *
 * Fetches usage data by executing the Claude CLI's /usage command.
 * This approach doesn't require any API keys - it relies on the user
 * having already authenticated via `claude login`.
 *
 * Platform-specific implementations:
 * - macOS: Uses 'expect' command for PTY
 * - Windows: Prefers ccusage tool, falls back to PowerShell with claude --print-usage
 *
 * Fallback: Uses ccusage CLI if installed (provides JSON output)
 */
export class ClaudeUsageService {
  private claudeBinary = 'claude';
  private ccusageBinary = 'ccusage';
  private timeout = 30000; // 30 second timeout
  private isWindows = os.platform() === 'win32';

  /**
   * Check if Claude CLI is available on the system
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCmd = this.isWindows ? 'where' : 'which';
      const proc = spawn(checkCmd, [this.claudeBinary]);
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Check if ccusage tool is available on the system
   * ccusage provides JSON output which is much easier to parse
   * We verify by actually trying to run it with --version
   */
  async isCcusageAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      // Actually try to run ccusage to verify it works
      // Using --help or --version is more reliable than 'where'/'which'
      const proc = spawn(this.ccusageBinary, ['--help'], {
        env: process.env,
        windowsHide: true,
      });

      const timeoutId = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(code === 0);
      });
      proc.on('error', () => {
        clearTimeout(timeoutId);
        resolve(false);
      });
    });
  }

  /**
   * Fetch usage data by executing the Claude CLI
   * Falls back to ccusage if the primary method fails
   */
  async fetchUsageData(): Promise<ClaudeUsage> {
    // Try ccusage first on Windows (more reliable JSON output)
    if (this.isWindows) {
      try {
        const ccusageAvailable = await this.isCcusageAvailable();
        if (ccusageAvailable) {
          const output = await this.executeCcusageCommand();
          return this.parseCcusageOutput(output);
        }
      } catch (error) {
        // Fall through to try the Claude CLI method
        console.log('ccusage failed, falling back to Claude CLI:', error);
      }
    }

    // Primary method: Claude CLI
    try {
      const output = await this.executeClaudeUsageCommand();
      return this.parseUsageOutput(output);
    } catch (error) {
      // On Windows, if Claude CLI failed and we haven't tried ccusage yet, try it now
      if (!this.isWindows) {
        // On non-Windows, try ccusage as fallback
        const ccusageAvailable = await this.isCcusageAvailable();
        if (ccusageAvailable) {
          try {
            const output = await this.executeCcusageCommand();
            return this.parseCcusageOutput(output);
          } catch {
            // Ignore ccusage errors, throw original error
          }
        }
      }
      throw error;
    }
  }

  /**
   * Execute ccusage command and return JSON output
   * ccusage is a third-party tool that provides Claude usage data in JSON format
   */
  private executeCcusageCommand(): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      // Use ccusage with JSON output format
      const proc = spawn(this.ccusageBinary, ['--json'], {
        env: process.env,
      });

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          proc.kill();
          reject(new Error('ccusage command timed out'));
        }
      }, this.timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (settled) return;
        settled = true;

        if (code !== 0) {
          reject(new Error(stderr || `ccusage exited with code ${code}`));
        } else if (stdout.trim()) {
          resolve(stdout);
        } else {
          reject(new Error('No output from ccusage command'));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!settled) {
          settled = true;
          reject(new Error(`Failed to execute ccusage: ${err.message}`));
        }
      });
    });
  }

  /**
   * Parse ccusage JSON output
   * Expected format varies by ccusage version, but typically:
   * { usage: { tokens_used, tokens_total, percentage }, ... }
   */
  private parseCcusageOutput(jsonOutput: string): ClaudeUsage {
    try {
      const data = JSON.parse(jsonOutput);

      // Handle different ccusage output formats
      const usage = data.usage || data;
      const session = usage.session || usage.current_session || {};
      const weekly = usage.weekly || usage.current_week || {};
      const sonnet = usage.sonnet || usage.opus || {};

      return {
        sessionTokensUsed: session.tokens_used || 0,
        sessionLimit: session.tokens_total || session.limit || 0,
        sessionPercentage:
          session.percentage || this.calculatePercentage(session.tokens_used, session.tokens_total),
        sessionResetTime: session.reset_time || this.getDefaultResetTime('session'),
        sessionResetText: session.reset_text || '',

        weeklyTokensUsed: weekly.tokens_used || 0,
        weeklyLimit: weekly.tokens_total || weekly.limit || 0,
        weeklyPercentage:
          weekly.percentage || this.calculatePercentage(weekly.tokens_used, weekly.tokens_total),
        weeklyResetTime: weekly.reset_time || this.getDefaultResetTime('weekly'),
        weeklyResetText: weekly.reset_text || '',

        sonnetWeeklyTokensUsed: sonnet.tokens_used || 0,
        sonnetWeeklyPercentage: sonnet.percentage || 0,
        sonnetResetText: sonnet.reset_text || '',

        costUsed: data.cost?.used ?? null,
        costLimit: data.cost?.limit ?? null,
        costCurrency: data.cost?.currency ?? null,

        lastUpdated: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    } catch (error) {
      throw new Error(`Failed to parse ccusage output: ${error}`);
    }
  }

  /**
   * Calculate percentage from used/total values
   */
  private calculatePercentage(used: number | undefined, total: number | undefined): number {
    if (!used || !total || total === 0) return 0;
    return Math.round((used / total) * 100);
  }

  /**
   * Execute the claude /usage command and return the output
   * Uses platform-specific PTY implementation
   */
  private executeClaudeUsageCommand(): Promise<string> {
    if (this.isWindows) {
      return this.executeClaudeUsageCommandWindows();
    }
    return this.executeClaudeUsageCommandMac();
  }

  /**
   * macOS implementation using 'expect' command
   */
  private executeClaudeUsageCommandMac(): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      // Use a simple working directory (home or tmp)
      const workingDirectory = process.env.HOME || '/tmp';

      // Use 'expect' with an inline script to run claude /usage with a PTY
      // Wait for "Current session" header, then wait for full output before exiting
      const expectScript = `
        set timeout 20
        spawn claude /usage
        expect {
          "Current session" {
            sleep 2
            send "\\x1b"
          }
          "Esc to cancel" {
            sleep 3
            send "\\x1b"
          }
          timeout {}
          eof {}
        }
        expect eof
      `;

      const proc = spawn('expect', ['-c', expectScript], {
        cwd: workingDirectory,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          proc.kill();
          reject(new Error('Command timed out'));
        }
      }, this.timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (settled) return;
        settled = true;

        // Check for authentication errors in output
        if (
          stdout.includes('token_expired') ||
          stdout.includes('authentication_error') ||
          stderr.includes('token_expired') ||
          stderr.includes('authentication_error')
        ) {
          reject(new Error("Authentication required - please run 'claude login'"));
          return;
        }

        // Even if exit code is non-zero, we might have useful output
        if (stdout.trim()) {
          resolve(stdout);
        } else if (code !== 0) {
          reject(new Error(stderr || `Command exited with code ${code}`));
        } else {
          reject(new Error('No output from claude command'));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!settled) {
          settled = true;
          reject(new Error(`Failed to execute claude: ${err.message}`));
        }
      });
    });
  }

  /**
   * Windows implementation
   *
   * The Claude CLI's /usage command requires a PTY (pseudo-terminal) to work properly.
   * On Windows, we try multiple approaches:
   * 1. Use PowerShell's Start-Process with input redirection to simulate PTY behavior
   * 2. Try direct spawn with shell: true
   * 3. Fall back to a minimal approach that gets basic data
   */
  private executeClaudeUsageCommandWindows(): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      // Try using PowerShell to run claude /usage with automatic input
      // The /usage command shows output and waits for Esc - we send Escape via input
      const psScript = `
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "claude"
        $psi.Arguments = "/usage"
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.RedirectStandardInput = $true
        $psi.CreateNoWindow = $true

        $process = [System.Diagnostics.Process]::Start($psi)

        # Give it time to show usage info
        Start-Sleep -Milliseconds 2000

        # Send Escape key to exit
        $process.StandardInput.Write([char]27)
        $process.StandardInput.Flush()

        # Read available output
        $output = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit(5000)

        Write-Output $output
      `;

      const proc = spawn('powershell', ['-NoProfile', '-Command', psScript], {
        env: process.env,
        windowsHide: true,
      });

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          proc.kill();
          // On timeout, try a simpler fallback
          this.executeClaudeUsageSimple()
            .then(resolve)
            .catch(() => reject(new Error('Command timed out')));
        }
      }, this.timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (settled) return;
        settled = true;

        // Check for authentication errors in output
        if (
          stdout.includes('token_expired') ||
          stdout.includes('authentication_error') ||
          stderr.includes('token_expired') ||
          stderr.includes('authentication_error')
        ) {
          reject(new Error("Authentication required - please run 'claude login'"));
          return;
        }

        // Check if we got usage output
        if (stdout.includes('Current session') || stdout.includes('%')) {
          resolve(stdout);
        } else if (stdout.trim()) {
          // Got some output, try to use it
          resolve(stdout);
        } else {
          // Try simpler fallback
          this.executeClaudeUsageSimple()
            .then(resolve)
            .catch(() =>
              reject(
                new Error(
                  stderr ||
                    `Claude usage command failed. Try installing ccusage: npm install -g ccusage`
                )
              )
            );
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!settled) {
          settled = true;
          // Try simpler fallback on spawn error
          this.executeClaudeUsageSimple()
            .then(resolve)
            .catch(() => reject(new Error(`Failed to execute claude: ${err.message}`)));
        }
      });
    });
  }

  /**
   * Simple Windows fallback - try running claude with output capture
   * This may not work if claude requires a TTY, but worth trying
   */
  private executeClaudeUsageSimple(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Try running claude /usage with timeout and capturing output
        const result = execSync('claude /usage', {
          timeout: 10000,
          encoding: 'utf8',
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          input: '\x1b', // Send escape to exit
        });
        if (result && (result.includes('Current session') || result.includes('%'))) {
          resolve(result);
        } else {
          reject(new Error('No usage data in output'));
        }
      } catch {
        reject(new Error('Simple claude command failed'));
      }
    });
  }

  /**
   * Strip ANSI escape codes from text
   */
  private stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  }

  /**
   * Parse the Claude CLI output to extract usage information
   *
   * Expected output format:
   * ```
   * Claude Code v1.0.27
   *
   * Current session
   * ████████████████░░░░ 65% left
   * Resets in 2h 15m
   *
   * Current week (all models)
   * ██████████░░░░░░░░░░ 35% left
   * Resets Jan 15, 3:30pm (America/Los_Angeles)
   *
   * Current week (Opus)
   * ████████████████████ 80% left
   * Resets Jan 15, 3:30pm (America/Los_Angeles)
   * ```
   */
  private parseUsageOutput(rawOutput: string): ClaudeUsage {
    const output = this.stripAnsiCodes(rawOutput);
    const lines = output
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);

    // Parse session usage
    const sessionData = this.parseSection(lines, 'Current session', 'session');

    // Parse weekly usage (all models)
    const weeklyData = this.parseSection(lines, 'Current week (all models)', 'weekly');

    // Parse Sonnet/Opus usage - try different labels
    let sonnetData = this.parseSection(lines, 'Current week (Sonnet only)', 'sonnet');
    if (sonnetData.percentage === 0) {
      sonnetData = this.parseSection(lines, 'Current week (Sonnet)', 'sonnet');
    }
    if (sonnetData.percentage === 0) {
      sonnetData = this.parseSection(lines, 'Current week (Opus)', 'sonnet');
    }

    return {
      sessionTokensUsed: 0, // Not available from CLI
      sessionLimit: 0, // Not available from CLI
      sessionPercentage: sessionData.percentage,
      sessionResetTime: sessionData.resetTime,
      sessionResetText: sessionData.resetText,

      weeklyTokensUsed: 0, // Not available from CLI
      weeklyLimit: 0, // Not available from CLI
      weeklyPercentage: weeklyData.percentage,
      weeklyResetTime: weeklyData.resetTime,
      weeklyResetText: weeklyData.resetText,

      sonnetWeeklyTokensUsed: 0, // Not available from CLI
      sonnetWeeklyPercentage: sonnetData.percentage,
      sonnetResetText: sonnetData.resetText,

      costUsed: null, // Not available from CLI
      costLimit: null,
      costCurrency: null,

      lastUpdated: new Date().toISOString(),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Parse a section of the usage output to extract percentage and reset time
   */
  private parseSection(
    lines: string[],
    sectionLabel: string,
    type: string
  ): { percentage: number; resetTime: string; resetText: string } {
    let percentage = 0;
    let resetTime = this.getDefaultResetTime(type);
    let resetText = '';

    // Find the LAST occurrence of the section (terminal output has multiple screen refreshes)
    let sectionIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].toLowerCase().includes(sectionLabel.toLowerCase())) {
        sectionIndex = i;
        break;
      }
    }

    if (sectionIndex === -1) {
      return { percentage, resetTime, resetText };
    }

    // Look at the lines following the section header (within a window of 5 lines)
    const searchWindow = lines.slice(sectionIndex, sectionIndex + 5);

    for (const line of searchWindow) {
      // Extract percentage - only take the first match (avoid picking up next section's data)
      if (percentage === 0) {
        const percentMatch = line.match(/(\d{1,3})\s*%\s*(left|used|remaining)/i);
        if (percentMatch) {
          const value = parseInt(percentMatch[1], 10);
          const isUsed = percentMatch[2].toLowerCase() === 'used';
          // Convert "left" to "used" percentage (our UI shows % used)
          percentage = isUsed ? value : 100 - value;
        }
      }

      // Extract reset time - only take the first match
      if (!resetText && line.toLowerCase().includes('reset')) {
        resetText = line;
      }
    }

    // Parse the reset time if we found one
    if (resetText) {
      resetTime = this.parseResetTime(resetText, type);
      // Strip timezone like "(Asia/Dubai)" from the display text
      resetText = resetText.replace(/\s*\([A-Za-z_\/]+\)\s*$/, '').trim();
    }

    return { percentage, resetTime, resetText };
  }

  /**
   * Parse reset time from text like "Resets in 2h 15m", "Resets 11am", or "Resets Dec 22 at 8pm"
   */
  private parseResetTime(text: string, type: string): string {
    const now = new Date();

    // Try to parse duration format: "Resets in 2h 15m" or "Resets in 30m"
    const durationMatch = text.match(
      /(\d+)\s*h(?:ours?)?(?:\s+(\d+)\s*m(?:in)?)?|(\d+)\s*m(?:in)?/i
    );
    if (durationMatch) {
      let hours = 0;
      let minutes = 0;

      if (durationMatch[1]) {
        hours = parseInt(durationMatch[1], 10);
        minutes = durationMatch[2] ? parseInt(durationMatch[2], 10) : 0;
      } else if (durationMatch[3]) {
        minutes = parseInt(durationMatch[3], 10);
      }

      const resetDate = new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);
      return resetDate.toISOString();
    }

    // Try to parse simple time-only format: "Resets 11am" or "Resets 3pm"
    const simpleTimeMatch = text.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (simpleTimeMatch) {
      let hours = parseInt(simpleTimeMatch[1], 10);
      const minutes = simpleTimeMatch[2] ? parseInt(simpleTimeMatch[2], 10) : 0;
      const ampm = simpleTimeMatch[3].toLowerCase();

      // Convert 12-hour to 24-hour
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }

      // Create date for today at specified time
      const resetDate = new Date(now);
      resetDate.setHours(hours, minutes, 0, 0);

      // If time has passed, use tomorrow
      if (resetDate <= now) {
        resetDate.setDate(resetDate.getDate() + 1);
      }
      return resetDate.toISOString();
    }

    // Try to parse date format: "Resets Dec 22 at 8pm" or "Resets Jan 15, 3:30pm"
    const dateMatch = text.match(
      /([A-Za-z]{3,})\s+(\d{1,2})(?:\s+at\s+|\s*,?\s*)(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
    );
    if (dateMatch) {
      const monthName = dateMatch[1];
      const day = parseInt(dateMatch[2], 10);
      let hours = parseInt(dateMatch[3], 10);
      const minutes = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
      const ampm = dateMatch[5].toLowerCase();

      // Convert 12-hour to 24-hour
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }

      // Parse month name
      const months: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      const month = months[monthName.toLowerCase().substring(0, 3)];

      if (month !== undefined) {
        let year = now.getFullYear();
        // If the date appears to be in the past, assume next year
        const resetDate = new Date(year, month, day, hours, minutes);
        if (resetDate < now) {
          resetDate.setFullYear(year + 1);
        }
        return resetDate.toISOString();
      }
    }

    // Fallback to default
    return this.getDefaultResetTime(type);
  }

  /**
   * Get default reset time based on usage type
   */
  private getDefaultResetTime(type: string): string {
    const now = new Date();

    if (type === 'session') {
      // Session resets in ~5 hours
      return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString();
    } else {
      // Weekly resets on next Monday around noon
      const result = new Date(now);
      const currentDay = now.getDay();
      let daysUntilMonday = (1 + 7 - currentDay) % 7;
      if (daysUntilMonday === 0) daysUntilMonday = 7;
      result.setDate(result.getDate() + daysUntilMonday);
      result.setHours(12, 59, 0, 0);
      return result.toISOString();
    }
  }
}

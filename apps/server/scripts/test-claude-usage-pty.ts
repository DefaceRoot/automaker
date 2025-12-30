#!/usr/bin/env npx tsx
/**
 * Test script for Claude Code /usage command via PTY
 *
 * This script tests spawning Claude Code CLI via node-pty,
 * sending the /usage command, and parsing the output.
 *
 * Run with: npx tsx scripts/test-claude-usage-pty.ts
 */

import * as pty from 'node-pty';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';

// ANSI escape code stripper
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

// Check if Claude CLI is installed
async function isClaudeInstalled(): Promise<{ installed: boolean; path?: string }> {
  return new Promise((resolve) => {
    const command = os.platform() === 'win32' ? 'where' : 'which';
    const proc = spawn(command, ['claude'], { shell: true });

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve({ installed: true, path: output.trim().split('\n')[0] });
      } else {
        resolve({ installed: false });
      }
    });

    proc.on('error', () => {
      resolve({ installed: false });
    });
  });
}

// Parse usage output using regex
function parseUsageOutput(rawOutput: string): {
  sessionPercentage: number | null;
  sessionResetText: string | null;
  weeklyPercentage: number | null;
  weeklyResetText: string | null;
  sonnetPercentage: number | null;
  sonnetResetText: string | null;
} {
  const output = stripAnsiCodes(rawOutput);
  const lines = output.split('\n').map((l) => l.trim());

  console.log('\n--- Parsed Lines ---');
  lines.forEach((line, i) => {
    if (line) console.log(`[${i}] "${line}"`);
  });

  // Initialize results
  let sessionPercentage: number | null = null;
  let sessionResetText: string | null = null;
  let weeklyPercentage: number | null = null;
  let weeklyResetText: string | null = null;
  let sonnetPercentage: number | null = null;
  let sonnetResetText: string | null = null;

  // Regex patterns for percentage extraction
  // Format: "X% used" or "X% left"
  const percentUsedRegex = /(\d+)%\s*used/i;
  const percentLeftRegex = /(\d+)%\s*left/i;

  // Regex for reset time
  const resetRegex = /resets?\s+(?:in\s+)?(.+)/i;

  // Find sections and extract data
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    const originalLine = lines[i];

    // Current session
    if (
      line.includes('current session') ||
      (line.includes('session') && !line.includes('recent'))
    ) {
      // Look for percentage in this line or next few lines
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const searchLine = lines[j];

        // Check for percentage
        if (sessionPercentage === null) {
          const usedMatch = searchLine.match(percentUsedRegex);
          const leftMatch = searchLine.match(percentLeftRegex);
          if (usedMatch) {
            sessionPercentage = parseInt(usedMatch[1], 10);
          } else if (leftMatch) {
            sessionPercentage = 100 - parseInt(leftMatch[1], 10);
          }
        }

        // Check for reset time
        if (sessionResetText === null) {
          const resetMatch = searchLine.match(resetRegex);
          if (resetMatch) {
            sessionResetText = 'Resets ' + resetMatch[1].replace(/\(.*?\)/g, '').trim();
          }
        }
      }
    }

    // Weekly limits - All models
    if (
      (line.includes('weekly') && line.includes('all')) ||
      line.includes('all models') ||
      (line.includes('weekly') && !line.includes('sonnet') && !line.includes('opus'))
    ) {
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const searchLine = lines[j];

        if (weeklyPercentage === null) {
          const usedMatch = searchLine.match(percentUsedRegex);
          const leftMatch = searchLine.match(percentLeftRegex);
          if (usedMatch) {
            weeklyPercentage = parseInt(usedMatch[1], 10);
          } else if (leftMatch) {
            weeklyPercentage = 100 - parseInt(leftMatch[1], 10);
          }
        }

        if (weeklyResetText === null) {
          const resetMatch = searchLine.match(resetRegex);
          if (resetMatch) {
            weeklyResetText = 'Resets ' + resetMatch[1].replace(/\(.*?\)/g, '').trim();
          }
        }
      }
    }

    // Sonnet only
    if (line.includes('sonnet')) {
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const searchLine = lines[j];

        if (sonnetPercentage === null) {
          const usedMatch = searchLine.match(percentUsedRegex);
          const leftMatch = searchLine.match(percentLeftRegex);
          if (usedMatch) {
            sonnetPercentage = parseInt(usedMatch[1], 10);
          } else if (leftMatch) {
            sonnetPercentage = 100 - parseInt(leftMatch[1], 10);
          }
        }

        if (sonnetResetText === null) {
          const resetMatch = searchLine.match(resetRegex);
          if (resetMatch) {
            sonnetResetText = 'Resets ' + resetMatch[1].replace(/\(.*?\)/g, '').trim();
          }
        }
      }
    }
  }

  return {
    sessionPercentage,
    sessionResetText,
    weeklyPercentage,
    weeklyResetText,
    sonnetPercentage,
    sonnetResetText,
  };
}

// Main test function
async function runTest() {
  console.log('='.repeat(60));
  console.log('Claude Code /usage PTY Test Script');
  console.log('='.repeat(60));
  console.log(`Platform: ${os.platform()}`);
  console.log(`Node version: ${process.version}`);
  console.log('');

  // Step 1: Check if Claude CLI is installed
  console.log('Step 1: Checking if Claude CLI is installed...');
  const claudeCheck = await isClaudeInstalled();

  if (!claudeCheck.installed) {
    console.error('ERROR: Claude CLI is not installed or not in PATH');
    console.error('Please install Claude Code CLI first: npm install -g @anthropic-ai/claude-code');
    process.exit(1);
  }

  console.log(`Claude CLI found at: ${claudeCheck.path}`);
  console.log('');

  // Step 2: Spawn PTY and run /usage command
  console.log('Step 2: Spawning PTY and running /usage command...');
  console.log('');

  const shell = os.platform() === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';

  console.log(`Shell: ${shell}`);

  let rawOutput = '';
  let usageDataReceived = false;
  let commandSent = false;
  let enterSent = false;

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
  });

  const timeout = setTimeout(() => {
    console.log('\nTimeout reached (30s). Killing PTY process...');
    ptyProcess.kill();
  }, 30000);

  ptyProcess.onData((data) => {
    rawOutput += data;
    process.stdout.write(data); // Echo to console

    const stripped = stripAnsiCodes(rawOutput);

    // Check if we've received the actual usage data (percentages and reset times)
    if (
      (stripped.includes('% used') || stripped.includes('% left')) &&
      stripped.includes('Resets')
    ) {
      if (!usageDataReceived) {
        usageDataReceived = true;
        console.log('\n\n--- Usage data detected! ---\n');

        // Wait a bit for all data to arrive, then exit
        setTimeout(() => {
          console.log('\n--- Sending Escape key to exit ---\n');
          ptyProcess.write('\x1b'); // ESC key
          setTimeout(() => {
            ptyProcess.write('\x03'); // Ctrl+C as backup
            setTimeout(() => {
              ptyProcess.kill();
            }, 1000);
          }, 500);
        }, 2000);
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
      console.log('\n--- Autocomplete menu detected, pressing Enter to select ---\n');
      setTimeout(() => {
        ptyProcess.write('\r'); // Press Enter to select from autocomplete
      }, 500);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    clearTimeout(timeout);
    console.log(`\n\nPTY process exited with code: ${exitCode}`);

    // Step 3: Display raw output
    console.log('\n' + '='.repeat(60));
    console.log('Step 3: Raw Output Analysis');
    console.log('='.repeat(60));
    console.log('\n--- Raw Output (last 3000 chars, with ANSI codes) ---');
    console.log(JSON.stringify(rawOutput.slice(-3000)));

    const stripped = stripAnsiCodes(rawOutput);
    console.log('\n--- Stripped Output (no ANSI codes) ---');
    console.log(stripped.slice(-3000));

    // Step 4: Parse output
    console.log('\n' + '='.repeat(60));
    console.log('Step 4: Parsed Results');
    console.log('='.repeat(60));

    const parsed = parseUsageOutput(rawOutput);
    console.log('\nExtracted Data:');
    console.log(JSON.stringify(parsed, null, 2));

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('Step 5: Summary');
    console.log('='.repeat(60));

    if (parsed.sessionPercentage !== null) {
      console.log(`Session: ${parsed.sessionPercentage}% used - ${parsed.sessionResetText}`);
    } else {
      console.log('Session: NOT FOUND');
    }

    if (parsed.weeklyPercentage !== null) {
      console.log(`Weekly (All): ${parsed.weeklyPercentage}% used - ${parsed.weeklyResetText}`);
    } else {
      console.log('Weekly (All): NOT FOUND');
    }

    if (parsed.sonnetPercentage !== null) {
      console.log(`Sonnet: ${parsed.sonnetPercentage}% used - ${parsed.sonnetResetText}`);
    } else {
      console.log('Sonnet: NOT FOUND');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test Complete!');
    console.log('='.repeat(60));

    // Save raw output to file for analysis
    try {
      const outputPath = './usage-output-raw.txt';
      fs.writeFileSync(outputPath, rawOutput);
      console.log(`\nRaw output saved to: ${outputPath}`);

      const strippedPath = './usage-output-stripped.txt';
      fs.writeFileSync(strippedPath, stripped);
      console.log(`Stripped output saved to: ${strippedPath}`);
    } catch (err) {
      console.error('Failed to save output files:', err);
    }

    process.exit(0);
  });

  // Wait for shell to be ready, then run claude command
  setTimeout(() => {
    console.log('--- Sending "claude" command ---');
    ptyProcess.write('claude\r');

    // Wait for Claude to start, then send /usage
    setTimeout(() => {
      console.log('--- Sending "/usage" command ---');
      commandSent = true;
      ptyProcess.write('/usage\r'); // Send /usage with Enter
    }, 4000);
  }, 1000);
}

// Run the test
runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

/**
 * POST /create endpoint - Create a new git worktree
 *
 * This endpoint handles worktree creation with proper checks:
 * 1. First checks if git already has a worktree for the branch (anywhere)
 * 2. If found, returns the existing worktree (no error)
 * 3. Only creates a new worktree if none exists for the branch
 * 4. Optionally runs a setup script (e.g., npm install) after creation
 */

import type { Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import * as secureFs from '../../../lib/secure-fs.js';
import {
  isGitRepo,
  getErrorMessage,
  logError,
  normalizePath,
  ensureInitialCommit,
} from '../common.js';
import { trackBranch } from './branch-tracking.js';
import type { SettingsService } from '../../../services/settings-service.js';

const execAsync = promisify(exec);

/**
 * Run the worktree setup script in the given directory
 * Returns a promise that resolves when the script completes
 */
async function runSetupScript(
  worktreePath: string,
  script: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    console.log(`[Worktree] Running setup script in ${worktreePath}: ${script}`);

    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['/c', script] : ['-c', script];

    const proc = spawn(shell, shellArgs, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        console.log(`[Worktree Setup] ${text.trim()}`);
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        console.error(`[Worktree Setup] ${text.trim()}`);
      });
    }

    proc.on('error', (error) => {
      console.error(`[Worktree] Setup script failed to start:`, error);
      resolve({ success: false, error: error.message });
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(`[Worktree] Setup script completed successfully`);
        resolve({ success: true, output: stdout });
      } else {
        console.error(`[Worktree] Setup script exited with code ${code}`);
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });

    // Timeout after 5 minutes to prevent hanging
    setTimeout(
      () => {
        proc.kill('SIGTERM');
        resolve({ success: false, error: 'Setup script timed out after 5 minutes' });
      },
      5 * 60 * 1000
    );
  });
}

/**
 * Find an existing worktree for a given branch by checking git worktree list
 */
async function findExistingWorktreeForBranch(
  projectPath: string,
  branchName: string
): Promise<{ path: string; branch: string } | null> {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', {
      cwd: projectPath,
    });

    const lines = stdout.split('\n');
    let currentPath: string | null = null;
    let currentBranch: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.slice(9);
      } else if (line.startsWith('branch ')) {
        currentBranch = line.slice(7).replace('refs/heads/', '');
      } else if (line === '' && currentPath && currentBranch) {
        // End of a worktree entry
        if (currentBranch === branchName) {
          // Resolve to absolute path - git may return relative paths
          // Critical for cross-platform compatibility (Windows, macOS, Linux)
          const resolvedPath = path.isAbsolute(currentPath)
            ? path.resolve(currentPath)
            : path.resolve(projectPath, currentPath);
          return { path: resolvedPath, branch: currentBranch };
        }
        currentPath = null;
        currentBranch = null;
      }
    }

    // Check the last entry (if file doesn't end with newline)
    if (currentPath && currentBranch && currentBranch === branchName) {
      // Resolve to absolute path for cross-platform compatibility
      const resolvedPath = path.isAbsolute(currentPath)
        ? path.resolve(currentPath)
        : path.resolve(projectPath, currentPath);
      return { path: resolvedPath, branch: currentBranch };
    }

    return null;
  } catch {
    return null;
  }
}

export function createCreateHandler(settingsService?: SettingsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, branchName, baseBranch } = req.body as {
        projectPath: string;
        branchName: string;
        baseBranch?: string; // Optional base branch to create from (defaults to current HEAD)
      };

      if (!projectPath || !branchName) {
        res.status(400).json({
          success: false,
          error: 'projectPath and branchName required',
        });
        return;
      }

      if (!(await isGitRepo(projectPath))) {
        res.status(400).json({
          success: false,
          error: 'Not a git repository',
        });
        return;
      }

      // Ensure the repository has at least one commit so worktree commands referencing HEAD succeed
      await ensureInitialCommit(projectPath);

      // First, check if git already has a worktree for this branch (anywhere)
      const existingWorktree = await findExistingWorktreeForBranch(projectPath, branchName);
      if (existingWorktree) {
        // Worktree already exists, return it as success (not an error)
        // This handles manually created worktrees or worktrees from previous runs
        console.log(
          `[Worktree] Found existing worktree for branch "${branchName}" at: ${existingWorktree.path}`
        );

        // Track the branch so it persists in the UI
        await trackBranch(projectPath, branchName);

        res.json({
          success: true,
          worktree: {
            path: normalizePath(existingWorktree.path),
            branch: branchName,
            isNew: false, // Not newly created
          },
        });
        return;
      }

      // Sanitize branch name for directory usage
      const sanitizedName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-');
      const worktreesDir = path.join(projectPath, '.worktrees');
      const worktreePath = path.join(worktreesDir, sanitizedName);

      // Create worktrees directory if it doesn't exist
      await secureFs.mkdir(worktreesDir, { recursive: true });

      // Check if branch exists
      let branchExists = false;
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, {
          cwd: projectPath,
        });
        branchExists = true;
      } catch {
        // Branch doesn't exist
      }

      // Create worktree
      let createCmd: string;
      if (branchExists) {
        // Use existing branch
        createCmd = `git worktree add "${worktreePath}" ${branchName}`;
      } else {
        // Create new branch from base or HEAD
        const base = baseBranch || 'HEAD';
        createCmd = `git worktree add -b ${branchName} "${worktreePath}" ${base}`;
      }

      console.log(
        `[Worktree] Creating worktree: projectPath="${projectPath}", worktreePath="${worktreePath}"`
      );
      console.log(`[Worktree] Command: ${createCmd}`);

      await execAsync(createCmd, { cwd: projectPath });

      // Verify the worktree was actually created with files
      // If the directory is empty or missing expected files, the git repo might be invalid
      const worktreeFiles = await secureFs.readdir(worktreePath);
      if (worktreeFiles.length === 0) {
        console.warn(
          `[Worktree] Warning: Worktree directory is empty! This might indicate the git repo at "${projectPath}" has no commits or is invalid.`
        );
      } else {
        console.log(`[Worktree] Worktree created successfully with ${worktreeFiles.length} items`);
      }

      // Note: We intentionally do NOT symlink .automaker to worktrees
      // Features and config are always accessed from the main project path
      // This avoids symlink loop issues when activating worktrees

      // Track the branch so it persists in the UI even after worktree is removed
      await trackBranch(projectPath, branchName);

      // Resolve to absolute path for cross-platform compatibility
      // normalizePath converts to forward slashes for API consistency
      const absoluteWorktreePath = path.resolve(worktreePath);

      // Run worktree setup script if configured
      // Only run if the worktree has actual files (not an empty directory)
      let setupScriptResult: { success: boolean; output?: string; error?: string } | undefined;
      if (settingsService && worktreeFiles.length > 0) {
        try {
          const projectSettings = await settingsService.getProjectSettings(projectPath);
          if (projectSettings.worktreeSetupScript) {
            console.log(
              `[Worktree] Found setup script for project: ${projectSettings.worktreeSetupScript}`
            );
            setupScriptResult = await runSetupScript(
              absoluteWorktreePath,
              projectSettings.worktreeSetupScript
            );
          }
        } catch (error) {
          console.error('[Worktree] Failed to get project settings for setup script:', error);
          // Don't fail worktree creation if settings can't be read
        }
      } else if (settingsService && worktreeFiles.length === 0) {
        console.warn('[Worktree] Skipping setup script because worktree directory is empty');
      }

      res.json({
        success: true,
        worktree: {
          path: normalizePath(absoluteWorktreePath),
          branch: branchName,
          isNew: !branchExists,
        },
        setupScript: setupScriptResult,
      });
    } catch (error) {
      logError(error, 'Create worktree failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

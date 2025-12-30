/**
 * WorktreeManager - Core service for git worktree lifecycle management
 *
 * Provides centralized worktree operations including:
 * - Creating worktrees with proper branch naming (e.g., bugfix/001-feature-name)
 * - Removing worktrees with optional branch cleanup
 * - Getting worktree statistics (commits ahead, files changed, additions/deletions)
 * - Base branch detection (main/master/current)
 * - .worktrees/ directory structure management
 *
 * Uses git worktree commands under the hood for all operations.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as secureFs from '../lib/secure-fs.js';
import { createLogger } from '@automaker/utils';
import type { WorktreeCategory } from '@automaker/types';

const execAsync = promisify(exec);
const logger = createLogger('WorktreeManager');

// ============================================================================
// Types
// ============================================================================

export interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  hasChanges?: boolean;
  changedFilesCount?: number;
}

export interface WorktreeStats {
  commitsAhead: number;
  commitsBehind: number;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface CreateWorktreeOptions {
  projectPath: string;
  branchName?: string;
  baseBranch?: string;
  category?: WorktreeCategory;
  title?: string;
  runSetupScript?: string;
}

export interface CreateWorktreeResult {
  path: string;
  branch: string;
  isNew: boolean;
  setupScriptResult?: {
    success: boolean;
    output?: string;
    error?: string;
  };
}

export interface DeleteWorktreeOptions {
  projectPath: string;
  worktreePath: string;
  deleteBranch?: boolean;
}

export interface DeleteWorktreeResult {
  worktreePath: string;
  branch: string | null;
  branchDeleted: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum allowed length for git branch names */
const MAX_BRANCH_NAME_LENGTH = 250;

/** Default worktrees directory name */
const WORKTREES_DIR = '.worktrees';

/** Timeout for setup scripts (5 minutes) */
const SETUP_SCRIPT_TIMEOUT_MS = 5 * 60 * 1000;

// ============================================================================
// WorktreeManager Class
// ============================================================================

/**
 * WorktreeManager - Centralized service for git worktree operations
 *
 * Example usage:
 * ```typescript
 * const manager = new WorktreeManager();
 *
 * // Create a categorized worktree
 * const result = await manager.create({
 *   projectPath: '/path/to/repo',
 *   category: 'bugfix',
 *   title: 'Fix login issue',
 * });
 * // Result: { path: '/path/to/repo/.worktrees/bugfix/001-fix-login-issue', branch: 'bugfix/001-fix-login-issue', isNew: true }
 *
 * // Get worktree statistics
 * const stats = await manager.getStats('/path/to/repo', 'bugfix/001-fix-login-issue');
 * // Result: { commitsAhead: 2, commitsBehind: 0, filesChanged: 5, additions: 100, deletions: 20 }
 *
 * // List all worktrees
 * const worktrees = await manager.list('/path/to/repo');
 *
 * // Remove a worktree
 * await manager.remove({
 *   projectPath: '/path/to/repo',
 *   worktreePath: '/path/to/repo/.worktrees/bugfix/001-fix-login-issue',
 *   deleteBranch: true,
 * });
 * ```
 */
export class WorktreeManager {
  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Create a new worktree with proper branch naming
   *
   * Supports two naming modes:
   * 1. Categorized naming: Uses category + title to generate branch names like "bugfix/001-fix-login"
   * 2. Direct naming: Uses the provided branchName directly
   *
   * If a worktree already exists for the branch, returns the existing one.
   *
   * @param options - Creation options including projectPath, category/title or branchName
   * @returns Promise resolving to the created worktree info
   */
  async create(options: CreateWorktreeOptions): Promise<CreateWorktreeResult> {
    const { projectPath, branchName, baseBranch, category, title, runSetupScript } = options;

    // Validate inputs
    const usesCategorizedNaming = category && title;
    if (!branchName && !usesCategorizedNaming) {
      throw new Error(
        'Either branchName or (category + title) must be provided for worktree creation'
      );
    }

    // Verify it's a git repo
    if (!(await this.isGitRepo(projectPath))) {
      throw new Error('Not a git repository');
    }

    // Ensure the repository has at least one commit
    await this.ensureInitialCommit(projectPath);

    // Set up worktrees directory
    const worktreesDir = path.join(projectPath, WORKTREES_DIR);

    // Determine the actual branch name and worktree path
    let actualBranchName: string;
    let worktreePath: string;

    if (usesCategorizedNaming) {
      const categorized = await this.generateCategorizedPath(
        projectPath,
        worktreesDir,
        category,
        title
      );
      actualBranchName = categorized.branchName;
      worktreePath = categorized.worktreePath;
      logger.info(`Using categorized naming: branch="${actualBranchName}", path="${worktreePath}"`);
    } else {
      actualBranchName = branchName!;
      const sanitizedName = branchName!.replace(/[^a-zA-Z0-9_-]/g, '-');
      worktreePath = path.join(worktreesDir, sanitizedName);
    }

    // Check if worktree already exists for this branch
    const existingWorktree = await this.findWorktreeForBranch(projectPath, actualBranchName);
    if (existingWorktree) {
      logger.info(
        `Found existing worktree for branch "${actualBranchName}" at: ${existingWorktree.path}`
      );
      return {
        path: this.normalizePath(existingWorktree.path),
        branch: actualBranchName,
        isNew: false,
      };
    }

    // Create directory structure
    if (usesCategorizedNaming) {
      const categoryDir = path.join(worktreesDir, category);
      await secureFs.mkdir(categoryDir, { recursive: true });
    } else {
      await secureFs.mkdir(worktreesDir, { recursive: true });
    }

    // Check if branch exists
    const branchExists = await this.branchExists(projectPath, actualBranchName);

    // Create worktree command
    let createCmd: string;
    if (branchExists) {
      createCmd = `git worktree add "${worktreePath}" "${actualBranchName}"`;
    } else {
      const base = baseBranch || 'HEAD';
      createCmd = `git worktree add -b "${actualBranchName}" "${worktreePath}" ${base}`;
    }

    logger.info(`Creating worktree: ${createCmd}`);
    await execAsync(createCmd, { cwd: projectPath });

    // Verify directory was actually created
    const exists = await secureFs
      .access(worktreePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      throw new Error(`Worktree directory was not created at ${worktreePath}`);
    }

    // Verify creation
    const worktreeFiles = await secureFs.readdir(worktreePath);
    if (worktreeFiles.length === 0) {
      logger.warn(`Worktree directory is empty - git repo may have no commits`);
    } else {
      logger.info(`Worktree created successfully with ${worktreeFiles.length} items`);
    }

    // Resolve to absolute path
    const absoluteWorktreePath = path.resolve(worktreePath);

    // Run setup script if provided
    let setupScriptResult: CreateWorktreeResult['setupScriptResult'];
    if (runSetupScript && worktreeFiles.length > 0) {
      setupScriptResult = await this.runSetupScript(absoluteWorktreePath, runSetupScript);
    }

    return {
      path: this.normalizePath(absoluteWorktreePath),
      branch: actualBranchName,
      isNew: !branchExists,
      setupScriptResult,
    };
  }

  /**
   * Remove a worktree and optionally delete its branch
   *
   * @param options - Deletion options including projectPath, worktreePath, and deleteBranch flag
   * @returns Promise resolving to deletion result
   */
  async remove(options: DeleteWorktreeOptions): Promise<DeleteWorktreeResult> {
    const { projectPath, worktreePath, deleteBranch } = options;

    if (!(await this.isGitRepo(projectPath))) {
      throw new Error('Not a git repository');
    }

    // Get branch name before removing worktree
    let branchName: string | null = null;
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
      });
      branchName = stdout.trim();
    } catch {
      // Could not get branch name
    }

    // Remove the worktree
    try {
      await execAsync(`git worktree remove "${worktreePath}" --force`, {
        cwd: projectPath,
      });
    } catch {
      // Try with prune if remove fails
      await execAsync('git worktree prune', { cwd: projectPath });
    }

    // Optionally delete the branch
    let branchDeleted = false;
    if (deleteBranch && branchName && branchName !== 'main' && branchName !== 'master') {
      try {
        await execAsync(`git branch -D ${branchName}`, { cwd: projectPath });
        branchDeleted = true;
      } catch {
        // Branch deletion failed, not critical
      }
    }

    return {
      worktreePath,
      branch: branchName,
      branchDeleted,
    };
  }

  /**
   * List all worktrees for a project
   *
   * @param projectPath - Path to the git repository
   * @param includeDetails - Whether to include change status for each worktree
   * @returns Promise resolving to array of worktree info
   */
  async list(projectPath: string, includeDetails = false): Promise<WorktreeInfo[]> {
    if (!(await this.isGitRepo(projectPath))) {
      return [];
    }

    const currentBranch = await this.getCurrentBranch(projectPath);
    const { stdout } = await execAsync('git worktree list --porcelain', {
      cwd: projectPath,
    });

    const worktrees: WorktreeInfo[] = [];
    const lines = stdout.split('\n');
    let current: { path?: string; branch?: string } = {};
    let isFirst = true;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        current.path = this.normalizePath(line.slice(9));
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === '') {
        if (current.path && current.branch) {
          const isMainWorktree = isFirst;

          // Check if worktree directory exists (skip pruning check for main)
          let worktreeExists = true;
          if (!isMainWorktree) {
            try {
              await secureFs.access(current.path);
            } catch {
              worktreeExists = false;
            }
          }

          if (worktreeExists) {
            worktrees.push({
              path: current.path,
              branch: current.branch,
              isMain: isMainWorktree,
            });
            isFirst = false;
          }
        }
        current = {};
      }
    }

    // Fetch change status if requested
    if (includeDetails) {
      for (const worktree of worktrees) {
        try {
          const { stdout: statusOutput } = await execAsync('git status --porcelain', {
            cwd: worktree.path,
          });
          const changedFiles = statusOutput
            .trim()
            .split('\n')
            .filter((line) => line.trim());
          worktree.hasChanges = changedFiles.length > 0;
          worktree.changedFilesCount = changedFiles.length;
        } catch {
          worktree.hasChanges = false;
          worktree.changedFilesCount = 0;
        }
      }
    }

    return worktrees;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get worktree statistics including commits ahead/behind, files changed, and line changes
   *
   * @param projectPath - Path to the git repository
   * @param branchName - Branch to get stats for
   * @param baseBranch - Optional base branch to compare against (auto-detected if not provided)
   * @returns Promise resolving to worktree statistics
   */
  async getStats(
    projectPath: string,
    branchName: string,
    baseBranch?: string
  ): Promise<WorktreeStats> {
    // Auto-detect base branch if not provided
    const base = baseBranch || (await this.detectBaseBranch(projectPath));

    let commitsAhead = 0;
    let commitsBehind = 0;
    let filesChanged = 0;
    let additions = 0;
    let deletions = 0;

    try {
      // Get commits ahead/behind
      const { stdout: revListOutput } = await execAsync(
        `git rev-list --left-right --count ${base}...${branchName}`,
        { cwd: projectPath }
      );
      const [behind, ahead] = revListOutput.trim().split(/\s+/).map(Number);
      commitsAhead = ahead || 0;
      commitsBehind = behind || 0;
    } catch {
      // Branch comparison failed - may not have common ancestor
    }

    try {
      // Get files changed and line stats using diff --stat
      const { stdout: diffStatOutput } = await execAsync(
        `git diff --stat ${base}...${branchName}`,
        { cwd: projectPath }
      );

      // Parse the summary line (e.g., "5 files changed, 100 insertions(+), 20 deletions(-)")
      const lines = diffStatOutput.trim().split('\n');
      if (lines.length > 0) {
        const summaryLine = lines[lines.length - 1];
        const filesMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
        const insertionsMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
        const deletionsMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);

        if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
        if (insertionsMatch) additions = parseInt(insertionsMatch[1], 10);
        if (deletionsMatch) deletions = parseInt(deletionsMatch[1], 10);
      }
    } catch {
      // Diff failed - may be on same commit
    }

    return {
      commitsAhead,
      commitsBehind,
      filesChanged,
      additions,
      deletions,
    };
  }

  /**
   * Get working directory statistics (uncommitted changes)
   *
   * @param worktreePath - Path to the worktree
   * @returns Promise resolving to change statistics for working directory
   */
  async getWorkingDirStats(
    worktreePath: string
  ): Promise<{ filesChanged: number; additions: number; deletions: number }> {
    let filesChanged = 0;
    let additions = 0;
    let deletions = 0;

    try {
      // Get working directory diff stats
      const { stdout: diffOutput } = await execAsync('git diff --stat', {
        cwd: worktreePath,
      });

      const lines = diffOutput.trim().split('\n');
      if (lines.length > 0) {
        const summaryLine = lines[lines.length - 1];
        const filesMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
        const insertionsMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
        const deletionsMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);

        if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
        if (insertionsMatch) additions = parseInt(insertionsMatch[1], 10);
        if (deletionsMatch) deletions = parseInt(deletionsMatch[1], 10);
      }
    } catch {
      // No diff or error
    }

    return { filesChanged, additions, deletions };
  }

  // ============================================================================
  // Base Branch Detection
  // ============================================================================

  /**
   * Detect the base branch for a repository
   *
   * Checks in order: main, master, then falls back to current branch
   *
   * @param projectPath - Path to the git repository
   * @returns Promise resolving to the detected base branch name
   */
  async detectBaseBranch(projectPath: string): Promise<string> {
    // Check for main branch first
    if (await this.branchExists(projectPath, 'main')) {
      return 'main';
    }

    // Check for master branch
    if (await this.branchExists(projectPath, 'master')) {
      return 'master';
    }

    // Fall back to current branch
    return this.getCurrentBranch(projectPath);
  }

  /**
   * Get the current branch of a repository or worktree
   *
   * @param cwd - Path to repository or worktree
   * @returns Promise resolving to current branch name
   */
  async getCurrentBranch(cwd: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if a path is a git repository
   */
  async isGitRepo(repoPath: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: repoPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a branch exists in the repository
   */
  async branchExists(projectPath: string, branchName: string): Promise<boolean> {
    try {
      await execAsync(`git rev-parse --verify ${branchName}`, { cwd: projectPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find an existing worktree for a given branch
   */
  async findWorktreeForBranch(
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
          if (currentBranch === branchName) {
            const resolvedPath = path.isAbsolute(currentPath)
              ? path.resolve(currentPath)
              : path.resolve(projectPath, currentPath);
            return { path: resolvedPath, branch: currentBranch };
          }
          currentPath = null;
          currentBranch = null;
        }
      }

      // Check the last entry
      if (currentPath && currentBranch && currentBranch === branchName) {
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

  /**
   * Ensure the repository has at least one commit
   */
  async ensureInitialCommit(repoPath: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --verify HEAD', { cwd: repoPath });
      return false; // Already has commits
    } catch {
      try {
        await execAsync('git commit --allow-empty -m "chore: automaker initial commit"', {
          cwd: repoPath,
        });
        logger.info(`Created initial empty commit in ${repoPath}`);
        return true;
      } catch (error) {
        throw new Error(`Failed to create initial git commit. Please commit manually and retry.`);
      }
    }
  }

  /**
   * Convert a title to a kebab-case slug for branch names
   */
  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  /**
   * Count existing worktrees in a category folder
   */
  private async getNextWorktreeNumber(
    worktreesDir: string,
    category: WorktreeCategory
  ): Promise<number> {
    const categoryPath = path.join(worktreesDir, category);

    try {
      const entries = await secureFs.readdir(categoryPath, { withFileTypes: true });
      const directories = entries.filter((entry) => entry.isDirectory());
      return directories.length + 1;
    } catch {
      return 1;
    }
  }

  /**
   * Generate categorized worktree path and branch name
   */
  private async generateCategorizedPath(
    projectPath: string,
    worktreesDir: string,
    category: WorktreeCategory,
    title: string
  ): Promise<{ branchName: string; worktreePath: string; folderName: string }> {
    const nextNumber = await this.getNextWorktreeNumber(worktreesDir, category);
    const paddedNumber = String(nextNumber).padStart(3, '0');
    const titleSlug = this.titleToSlug(title);

    const branchName = `${category}/${paddedNumber}-${titleSlug}`;
    const folderName = `${paddedNumber}-${titleSlug}`;
    const categoryDir = path.join(worktreesDir, category);
    const worktreePath = path.join(categoryDir, folderName);

    return { branchName, worktreePath, folderName };
  }

  /**
   * Run a setup script in a worktree directory
   */
  private async runSetupScript(
    worktreePath: string,
    script: string
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      logger.info(`Running setup script in ${worktreePath}: ${script}`);

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
          logger.debug(`[Setup] ${text.trim()}`);
        });
      }

      if (proc.stderr) {
        proc.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          logger.warn(`[Setup] ${text.trim()}`);
        });
      }

      proc.on('error', (error) => {
        logger.error(`Setup script failed to start:`, error);
        resolve({ success: false, error: error.message });
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          logger.info(`Setup script completed successfully`);
          resolve({ success: true, output: stdout });
        } else {
          logger.error(`Setup script exited with code ${code}`);
          resolve({ success: false, error: stderr || `Exit code: ${code}` });
        }
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        proc.kill('SIGTERM');
        resolve({ success: false, error: 'Setup script timed out after 5 minutes' });
      }, SETUP_SCRIPT_TIMEOUT_MS);
    });
  }

  /**
   * Normalize path separators to forward slashes for cross-platform consistency
   */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  /**
   * Validate a branch name for git compatibility
   */
  isValidBranchName(name: string): boolean {
    return /^[a-zA-Z0-9._\-/]+$/.test(name) && name.length < MAX_BRANCH_NAME_LENGTH;
  }

  /**
   * Get the worktrees directory path for a project
   */
  getWorktreesDir(projectPath: string): string {
    return path.join(projectPath, WORKTREES_DIR);
  }

  /**
   * Prune stale worktree references
   */
  async prune(projectPath: string): Promise<void> {
    try {
      await execAsync('git worktree prune', { cwd: projectPath });
      logger.info(`Pruned stale worktree references in ${projectPath}`);
    } catch (error) {
      logger.warn(`Failed to prune worktrees:`, error);
    }
  }
}

// Export singleton instance for convenience
export const worktreeManager = new WorktreeManager();

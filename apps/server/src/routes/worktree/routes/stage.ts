/**
 * POST /stage endpoint - Stage worktree changes to base branch (no commit)
 *
 * This endpoint copies changed files from a feature worktree to the main branch
 * and stages them, allowing the user to review changes before committing manually.
 *
 * Flow:
 * 1. Validate inputs and resolve worktree path
 * 2. Check main branch is clean (no uncommitted changes)
 * 3. Ensure we're on target branch
 * 4. Get list of changed files between branches
 * 5. Copy/delete files from worktree to main
 * 6. Stage the changes with git add
 * 7. Return success with file list for revert tracking
 *
 * Note: Git repository validation is handled by requireValidProject middleware
 */

import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import {
  execAsync,
  execEnv,
  getErrorMessage,
  logError,
  isValidBranchName,
  resolveWorktreePath,
} from '../common.js';

interface StageRequest {
  projectPath: string;
  featureId: string;
  targetBranch?: string; // defaults to 'main'
}

interface StageResponse {
  success: boolean;
  staged?: boolean;
  changedFiles?: string[]; // List of file paths that were staged
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
  diffSummary?: string;
  error?: string;
}

interface FileChange {
  status: 'A' | 'M' | 'D' | 'R';
  path?: string;
  oldPath?: string;
  newPath?: string;
}

/**
 * Copy a file from worktree to main project
 */
async function copyFile(
  worktreePath: string,
  projectPath: string,
  filePath: string
): Promise<void> {
  const srcPath = path.join(worktreePath, filePath);
  const destPath = path.join(projectPath, filePath);

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  // Copy the file
  await fs.copyFile(srcPath, destPath);
}

/**
 * Delete a file from main project
 */
async function deleteFile(projectPath: string, filePath: string): Promise<void> {
  const targetPath = path.join(projectPath, filePath);
  try {
    await fs.unlink(targetPath);
  } catch {
    // File might not exist, that's fine
  }
}

/**
 * Parse git diff --name-status output into FileChange objects
 */
function parseNameStatus(output: string): FileChange[] {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0];

      // Renamed files have format: R100\toldPath\tnewPath
      if (status.startsWith('R')) {
        return {
          status: 'R' as const,
          oldPath: parts[1],
          newPath: parts[2],
        };
      }

      return {
        status: status as 'A' | 'M' | 'D',
        path: parts[1],
      };
    });
}

export function createStageHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, featureId, targetBranch = 'main' } = req.body as StageRequest;

      if (!projectPath || !featureId) {
        res.status(400).json({
          success: false,
          error: 'projectPath and featureId are required',
        } as StageResponse);
        return;
      }

      // Resolve worktree path and branch name from feature
      const worktreeInfo = await resolveWorktreePath(projectPath, featureId);
      if (!worktreeInfo) {
        res.status(400).json({
          success: false,
          error:
            'Feature does not have a worktree or branch name. Please ensure the feature has been started.',
        } as StageResponse);
        return;
      }

      const { path: worktreePath, branchName } = worktreeInfo;

      // Validate branch names
      if (!isValidBranchName(branchName) || !isValidBranchName(targetBranch)) {
        res.status(400).json({
          success: false,
          error: 'Invalid branch name',
        } as StageResponse);
        return;
      }

      console.log(
        `[Stage] Staging ${branchName} to ${targetBranch} in ${projectPath} (worktree: ${worktreePath})`
      );

      // Step 1: Check main is clean (CRITICAL - fail if dirty)
      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: projectPath,
        env: execEnv,
      });

      if (statusOutput.trim()) {
        res.status(400).json({
          success: false,
          error: `Cannot stage changes: uncommitted changes on ${targetBranch}. Please commit or stash them first.`,
        } as StageResponse);
        return;
      }

      // Step 2: Get current branch and ensure we're on target
      const { stdout: currentBranchRaw } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        env: execEnv,
      });
      const currentBranch = currentBranchRaw.trim();

      if (currentBranch !== targetBranch) {
        try {
          await execAsync(`git checkout ${targetBranch}`, {
            cwd: projectPath,
            env: execEnv,
          });
          console.log(`[Stage] Checked out ${targetBranch}`);
        } catch (error) {
          res.status(400).json({
            success: false,
            error: `Failed to checkout ${targetBranch}: ${getErrorMessage(error)}`,
          } as StageResponse);
          return;
        }
      }

      // Step 3: Get list of changed files between branches
      const { stdout: diffOutput } = await execAsync(
        `git diff --name-status ${targetBranch}..${branchName}`,
        { cwd: projectPath, env: execEnv }
      );

      const changes = parseNameStatus(diffOutput);

      if (changes.length === 0) {
        res.json({
          success: true,
          staged: true,
          changedFiles: [],
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
          diffSummary: 'No changes to stage',
        } as StageResponse);
        return;
      }

      console.log(`[Stage] Found ${changes.length} changed files`);

      // Step 4: Copy/delete files from worktree to main
      const errors: string[] = [];
      const stagedFiles: string[] = [];

      for (const change of changes) {
        try {
          switch (change.status) {
            case 'A':
            case 'M':
              // Added or Modified - copy from worktree
              if (change.path) {
                await copyFile(worktreePath, projectPath, change.path);
                stagedFiles.push(change.path);
              }
              break;

            case 'D':
              // Deleted - remove from main
              if (change.path) {
                await deleteFile(projectPath, change.path);
                stagedFiles.push(change.path);
              }
              break;

            case 'R':
              // Renamed - delete old path, copy new path
              if (change.oldPath) {
                await deleteFile(projectPath, change.oldPath);
                stagedFiles.push(change.oldPath);
              }
              if (change.newPath) {
                await copyFile(worktreePath, projectPath, change.newPath);
                stagedFiles.push(change.newPath);
              }
              break;
          }
        } catch (error) {
          const filePath = change.path || change.newPath || change.oldPath || 'unknown';
          errors.push(`Failed to process ${filePath}: ${getErrorMessage(error)}`);
          console.warn(`[Stage] Error processing file ${filePath}:`, error);
        }
      }

      if (stagedFiles.length === 0) {
        res.status(500).json({
          success: false,
          error: `Failed to copy files: ${errors.join(', ')}`,
        } as StageResponse);
        return;
      }

      // Step 5: Stage all changed files
      const escapedFiles = stagedFiles.map((f) => `"${f.replace(/"/g, '\\"')}"`);
      try {
        await execAsync(`git add ${escapedFiles.join(' ')}`, {
          cwd: projectPath,
          env: execEnv,
        });
        console.log(`[Stage] Staged ${stagedFiles.length} files`);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Failed to stage files: ${getErrorMessage(error)}`,
        } as StageResponse);
        return;
      }

      // Step 6: Get diff summary
      const diffSummary = await getDiffSummary(projectPath);

      const response: StageResponse = {
        success: true,
        staged: true,
        changedFiles: stagedFiles,
        filesChanged: diffSummary.filesChanged,
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        diffSummary: diffSummary.summary,
      };

      if (errors.length > 0) {
        console.warn(`[Stage] Completed with ${errors.length} errors:`, errors);
      }

      console.log(
        `[Stage] Successfully staged changes: ${diffSummary.summary} (${stagedFiles.length} files)`
      );
      res.json(response);
    } catch (error) {
      logError(error, 'Stage worktree changes failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      } as StageResponse);
    }
  };
}

/**
 * Get diff summary for staged changes
 */
async function getDiffSummary(projectPath: string): Promise<{
  summary: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}> {
  try {
    // Get stat for staged changes
    const { stdout } = await execAsync('git diff --cached --stat', {
      cwd: projectPath,
      env: execEnv,
    });

    // Parse the summary line (e.g., "5 files changed, 100 insertions(+), 20 deletions(-)")
    const lines = stdout.trim().split('\n');
    const summaryLine = lines[lines.length - 1] || '';

    // Parse numbers from summary
    const filesMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
    const insertMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
    const deleteMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);

    return {
      summary: summaryLine.trim() || 'No changes staged',
      filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
      insertions: insertMatch ? parseInt(insertMatch[1], 10) : 0,
      deletions: deleteMatch ? parseInt(deleteMatch[1], 10) : 0,
    };
  } catch {
    return {
      summary: 'Unable to get diff summary',
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    };
  }
}

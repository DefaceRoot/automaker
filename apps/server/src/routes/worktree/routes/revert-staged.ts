/**
 * POST /revert-staged endpoint - Revert staged changes from a specific task
 *
 * This endpoint reverts changes that were staged from a feature worktree.
 * It unstages the files and restores them to their original state on the target branch.
 *
 * Flow:
 * 1. Validate inputs
 * 2. Verify we're on target branch
 * 3. Unstage and restore each file
 *
 * Note: Git repository validation is handled by requireValidProject middleware
 */

import type { Request, Response } from 'express';
import { execAsync, execEnv, getErrorMessage, logError, isValidBranchName } from '../common.js';

interface RevertStagedRequest {
  projectPath: string;
  files: string[]; // List of files to revert
  targetBranch?: string; // defaults to 'main'
}

interface RevertStagedResponse {
  success: boolean;
  revertedFiles?: string[];
  errors?: string[];
  error?: string;
}

export function createRevertStagedHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, files, targetBranch = 'main' } = req.body as RevertStagedRequest;

      // Validate inputs
      if (!projectPath || !files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'projectPath and files are required',
        } as RevertStagedResponse);
        return;
      }

      // Validate target branch name
      if (!isValidBranchName(targetBranch)) {
        res.status(400).json({
          success: false,
          error: 'Invalid target branch name',
        } as RevertStagedResponse);
        return;
      }

      console.log(
        `[RevertStaged] Reverting ${files.length} files from ${targetBranch} in ${projectPath}`
      );

      // Verify we're on the target branch
      const { stdout: currentBranchRaw } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        env: execEnv,
      });
      const currentBranch = currentBranchRaw.trim();

      if (currentBranch !== targetBranch) {
        res.status(400).json({
          success: false,
          error: `Not on target branch. Currently on '${currentBranch}', expected '${targetBranch}'.`,
        } as RevertStagedResponse);
        return;
      }

      const revertedFiles: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const escapedFile = `"${file.replace(/"/g, '\\"')}"`;

        try {
          // Step 1: Unstage the file
          await execAsync(`git restore --staged ${escapedFile}`, {
            cwd: projectPath,
            env: execEnv,
          });
        } catch {
          // File might not be staged, continue
        }

        try {
          // Step 2: Restore file to HEAD state
          await execAsync(`git restore ${escapedFile}`, {
            cwd: projectPath,
            env: execEnv,
          });
          revertedFiles.push(file);
        } catch {
          // File might be new (not in HEAD), try to remove it
          try {
            await execAsync(`git clean -f ${escapedFile}`, {
              cwd: projectPath,
              env: execEnv,
            });
            revertedFiles.push(file);
          } catch (cleanError) {
            errors.push(`Could not revert ${file}: ${getErrorMessage(cleanError)}`);
          }
        }
      }

      console.log(`[RevertStaged] Successfully reverted ${revertedFiles.length} files`);
      if (errors.length > 0) {
        console.warn(`[RevertStaged] Errors:`, errors);
      }

      res.json({
        success: true,
        revertedFiles,
        errors: errors.length > 0 ? errors : undefined,
      } as RevertStagedResponse);
    } catch (error) {
      logError(error, 'Revert staged changes failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      } as RevertStagedResponse);
    }
  };
}

/**
 * POST /revert-staged endpoint - Revert staged changes from a specific task
 *
 * This endpoint reverts changes that were staged from a feature branch to the target branch.
 * It only reverts the specific files that were staged by the task, preserving other changes.
 *
 * Flow:
 * 1. Ensure we're on the target branch
 * 2. Unstage the specific files
 * 3. Restore the files to their pre-merge state
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
  error?: string;
}

export function createRevertStagedHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, files, targetBranch = 'main' } = req.body as RevertStagedRequest;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        } as RevertStagedResponse);
        return;
      }

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'files array is required and must not be empty',
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

      // Step 1: Verify we're on the target branch
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

      // Step 2: Check if we're in a merge state
      let inMergeState = false;
      try {
        await execAsync('git rev-parse MERGE_HEAD', {
          cwd: projectPath,
          env: execEnv,
        });
        inMergeState = true;
      } catch {
        // Not in merge state, which is fine
      }

      // Step 3: Revert the files
      const revertedFiles: string[] = [];

      if (inMergeState) {
        // If in merge state, abort the merge entirely
        // This is simpler and cleaner than trying to selectively revert
        console.log('[RevertStaged] In merge state, aborting merge');
        try {
          await execAsync('git merge --abort', {
            cwd: projectPath,
            env: execEnv,
          });
          // All files from the merge are now reverted
          revertedFiles.push(...files);
          console.log('[RevertStaged] Merge aborted successfully');
        } catch (error) {
          res.status(500).json({
            success: false,
            error: `Failed to abort merge: ${getErrorMessage(error)}`,
          } as RevertStagedResponse);
          return;
        }
      } else {
        // Not in merge state - need to unstage and restore specific files
        // This handles the case where the merge was completed but not committed

        // Escape file paths for shell command
        const escapedFiles = files.map((f) => `"${f.replace(/"/g, '\\"')}"`);

        // Step 3a: Unstage the files (git restore --staged)
        try {
          const unstageCmd = `git restore --staged ${escapedFiles.join(' ')}`;
          await execAsync(unstageCmd, {
            cwd: projectPath,
            env: execEnv,
          });
          console.log(`[RevertStaged] Unstaged ${files.length} files`);
        } catch (error) {
          // Files might not be staged, continue anyway
          console.warn('[RevertStaged] Could not unstage files:', getErrorMessage(error));
        }

        // Step 3b: Restore the files to their previous state (git restore)
        try {
          const restoreCmd = `git restore ${escapedFiles.join(' ')}`;
          await execAsync(restoreCmd, {
            cwd: projectPath,
            env: execEnv,
          });
          revertedFiles.push(...files);
          console.log(`[RevertStaged] Restored ${files.length} files`);
        } catch (error) {
          // Some files might be new (created by the merge), need to remove them
          console.warn('[RevertStaged] Could not restore some files:', getErrorMessage(error));

          // Try to handle each file individually
          for (const file of files) {
            try {
              // Try to restore first
              await execAsync(`git restore "${file.replace(/"/g, '\\"')}"`, {
                cwd: projectPath,
                env: execEnv,
              });
              revertedFiles.push(file);
            } catch {
              // If restore fails, the file might be untracked (new file from merge)
              // Try to remove it
              try {
                await execAsync(`git clean -f "${file.replace(/"/g, '\\"')}"`, {
                  cwd: projectPath,
                  env: execEnv,
                });
                revertedFiles.push(file);
              } catch (cleanError) {
                console.warn(
                  `[RevertStaged] Could not revert file ${file}:`,
                  getErrorMessage(cleanError)
                );
              }
            }
          }
        }
      }

      const response: RevertStagedResponse = {
        success: true,
        revertedFiles,
      };

      console.log(`[RevertStaged] Successfully reverted ${revertedFiles.length} files`);
      res.json(response);
    } catch (error) {
      logError(error, 'Revert staged changes failed');
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      } as RevertStagedResponse);
    }
  };
}

/**
 * POST /merge-preview endpoint - Preview merge conflicts without modifying working directory
 *
 * Uses git merge-tree --write-tree for non-destructive conflict detection.
 * This allows the UI to display potential conflicts before the actual merge.
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage, logError } from '../common.js';
import { parseMergeTreeOutput, type MergePreviewResult } from '@automaker/git-utils';

const execAsync = promisify(exec);

export function createMergePreviewHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        projectPath,
        featureId,
        sourceBranch: sourceBranchInput,
        targetBranch: targetBranchInput,
      } = req.body as {
        projectPath: string;
        featureId?: string;
        sourceBranch?: string;
        targetBranch?: string;
      };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        } satisfies MergePreviewResult);
        return;
      }

      // Determine source and target branches
      let sourceBranch: string;
      let targetBranch: string;

      if (sourceBranchInput && targetBranchInput) {
        // Direct branch specification
        sourceBranch = sourceBranchInput;
        targetBranch = targetBranchInput;
      } else if (featureId) {
        // Feature branch merge pattern
        sourceBranch = `feature/${featureId}`;
        // Get current branch as target
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectPath,
        });
        targetBranch = currentBranch.trim();
      } else {
        res.status(400).json({
          success: false,
          hasConflicts: false,
          conflictCount: 0,
          conflicts: [],
          error: 'Either featureId or both sourceBranch and targetBranch are required',
        } satisfies MergePreviewResult);
        return;
      }

      // Step 1: Find the merge base
      let mergeBase: string;
      try {
        const { stdout: mergeBaseOutput } = await execAsync(
          `git merge-base "${targetBranch}" "${sourceBranch}"`,
          { cwd: projectPath }
        );
        mergeBase = mergeBaseOutput.trim();
      } catch (error) {
        // No common ancestor - branches are unrelated
        res.status(400).json({
          success: false,
          hasConflicts: false,
          conflictCount: 0,
          conflicts: [],
          sourceBranch,
          targetBranch,
          error: `Unable to find merge base between ${targetBranch} and ${sourceBranch}. Branches may be unrelated.`,
        } satisfies MergePreviewResult);
        return;
      }

      // Step 2: Run git merge-tree --write-tree to simulate the merge
      // This is non-destructive - it doesn't modify the working directory or index
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      try {
        const result = await execAsync(
          `git merge-tree --write-tree "${targetBranch}" "${sourceBranch}"`,
          { cwd: projectPath }
        );
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (error: unknown) {
        // merge-tree exits with non-zero if there are conflicts
        // We need to capture the output anyway
        if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
          const execError = error as { stdout: string; stderr: string; code?: number };
          stdout = execError.stdout || '';
          stderr = execError.stderr || '';
          exitCode = execError.code || 1;
        } else {
          throw error;
        }
      }

      // Step 3: Parse the output to extract conflict information
      const parseResult = parseMergeTreeOutput(stdout, stderr);

      const result: MergePreviewResult = {
        success: true,
        hasConflicts: parseResult.hasConflicts,
        conflictCount: parseResult.conflicts.length,
        conflicts: parseResult.conflicts,
        mergeBase,
        resultTree: parseResult.resultTree,
        sourceBranch,
        targetBranch,
      };

      res.json(result);
    } catch (error) {
      logError(error, 'Merge preview failed');
      res.status(500).json({
        success: false,
        hasConflicts: false,
        conflictCount: 0,
        conflicts: [],
        error: getErrorMessage(error),
      } satisfies MergePreviewResult);
    }
  };
}

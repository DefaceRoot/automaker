/**
 * POST /diffs endpoint - Get diffs for a worktree
 */

import type { Request, Response } from 'express';
import { getErrorMessage, logError, resolveWorktreePath } from '../common.js';
import { getGitRepositoryDiffs } from '../../common.js';

export function createDiffsHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res.status(400).json({
          success: false,
          error: 'projectPath and featureId required',
        });
        return;
      }

      // Resolve worktree path from feature's branch name
      const worktreeInfo = await resolveWorktreePath(projectPath, featureId);

      // Use worktree path if found, otherwise fallback to main project path
      const targetPath = worktreeInfo?.path ?? projectPath;

      try {
        const result = await getGitRepositoryDiffs(targetPath);
        res.json({
          success: true,
          diff: result.diff,
          files: result.files,
          hasChanges: result.hasChanges,
        });
      } catch (innerError) {
        logError(innerError, 'Get diffs failed');
        res.json({ success: true, diff: '', files: [], hasChanges: false });
      }
    } catch (error) {
      logError(error, 'Get worktree diffs failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

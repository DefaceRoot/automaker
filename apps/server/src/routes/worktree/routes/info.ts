/**
 * POST /info endpoint - Get worktree info
 */

import type { Request, Response } from 'express';
import { getErrorMessage, logError, normalizePath, resolveWorktreePath } from '../common.js';

export function createInfoHandler() {
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
      if (!worktreeInfo) {
        res.json({ success: true, worktreePath: null, branchName: null });
        return;
      }

      res.json({
        success: true,
        worktreePath: normalizePath(worktreeInfo.path),
        branchName: worktreeInfo.branchName,
      });
    } catch (error) {
      logError(error, 'Get worktree info failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

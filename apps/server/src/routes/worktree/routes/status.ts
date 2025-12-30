/**
 * POST /status endpoint - Get worktree status
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage, logError, resolveWorktreePath } from '../common.js';

const execAsync = promisify(exec);

export function createStatusHandler() {
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
        res.json({
          success: true,
          modifiedFiles: 0,
          files: [],
          diffStat: '',
          recentCommits: [],
        });
        return;
      }

      try {
        const { stdout: status } = await execAsync('git status --porcelain', {
          cwd: worktreeInfo.path,
        });
        const files = status
          .split('\n')
          .filter(Boolean)
          .map((line) => line.slice(3));
        const { stdout: diffStat } = await execAsync('git diff --stat', {
          cwd: worktreeInfo.path,
        });
        const { stdout: logOutput } = await execAsync('git log --oneline -5 --format="%h %s"', {
          cwd: worktreeInfo.path,
        });

        res.json({
          success: true,
          modifiedFiles: files.length,
          files,
          diffStat: diffStat.trim(),
          recentCommits: logOutput.trim().split('\n').filter(Boolean),
        });
      } catch {
        res.json({
          success: true,
          modifiedFiles: 0,
          files: [],
          diffStat: '',
          recentCommits: [],
        });
      }
    } catch (error) {
      logError(error, 'Get worktree status failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

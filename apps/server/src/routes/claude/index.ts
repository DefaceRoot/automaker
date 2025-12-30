import { Router, Request, Response } from 'express';
import {
  ClaudeUsagePtyService,
  ClaudeUsageError,
  ClaudeUsageErrorCode,
} from '../../services/claude-usage-pty-service.js';

export function createClaudeRoutes(service: ClaudeUsagePtyService): Router {
  const router = Router();

  // Get current usage (fetches from Claude CLI via PTY)
  router.get('/usage', async (req: Request, res: Response) => {
    try {
      // Check if Claude CLI is available first
      const isAvailable = await service.isAvailable();
      if (!isAvailable) {
        res.status(503).json({
          error: 'setup_required',
          code: ClaudeUsageErrorCode.CLI_NOT_INSTALLED,
          message:
            'Claude CLI is not installed. Please install Claude Code CLI and run "claude login" to authenticate.',
        });
        return;
      }

      const usage = await service.fetchUsageData();
      res.json(usage);
    } catch (error) {
      if (error instanceof ClaudeUsageError) {
        switch (error.code) {
          case ClaudeUsageErrorCode.CLI_NOT_INSTALLED:
            res.status(503).json({
              error: 'setup_required',
              code: error.code,
              message: error.message,
            });
            break;

          case ClaudeUsageErrorCode.AUTH_REQUIRED:
            res.status(401).json({
              error: 'auth_required',
              code: error.code,
              message: error.message,
            });
            break;

          case ClaudeUsageErrorCode.TIMEOUT:
            res.status(504).json({
              error: 'timeout',
              code: error.code,
              message: error.message,
            });
            break;

          case ClaudeUsageErrorCode.PARSE_ERROR:
            res.status(500).json({
              error: 'parse_error',
              code: error.code,
              message: error.message,
            });
            break;

          default:
            console.error('Error fetching usage:', error);
            res.status(500).json({
              error: 'unknown',
              code: error.code,
              message: error.message,
            });
        }
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching usage:', error);
        res.status(500).json({
          error: 'unknown',
          code: ClaudeUsageErrorCode.UNKNOWN,
          message,
        });
      }
    }
  });

  // Invalidate cache (force refresh on next fetch)
  router.post('/usage/invalidate', (req: Request, res: Response) => {
    service.invalidateCache();
    res.json({ success: true, message: 'Cache invalidated' });
  });

  // Get cached usage without fetching (returns null if no cache)
  router.get('/usage/cached', (req: Request, res: Response) => {
    const cached = service.getCachedUsage();
    if (cached) {
      res.json(cached);
    } else {
      res.status(404).json({ error: 'no_cache', message: 'No cached usage data available' });
    }
  });

  return router;
}

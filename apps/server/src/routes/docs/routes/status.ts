/**
 * GET /status endpoint - Get documentation generation status
 */

import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service.js';

export function createStatusHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath } = req.query as {
        projectPath?: string;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath query parameter required' });
        return;
      }

      const status = docsService.getStatus(projectPath);
      res.json({ success: true, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  };
}

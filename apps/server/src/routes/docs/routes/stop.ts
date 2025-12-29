/**
 * POST /stop endpoint - Stop documentation generation for a project
 */

import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service.js';

export function createStopHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath } = req.body as {
        projectPath: string;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath required' });
        return;
      }

      const stopped = docsService.stopGeneration(projectPath);
      res.json({ success: true, stopped });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  };
}

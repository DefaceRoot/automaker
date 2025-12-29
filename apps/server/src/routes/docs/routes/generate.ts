/**
 * POST /generate endpoint - Generate documentation for a project
 */

import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service.js';

export function createGenerateHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, model } = req.body as {
        projectPath: string;
        model?: string;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath required' });
        return;
      }

      // Check if generation is already running
      const status = docsService.getStatus(projectPath);
      if (status.isGenerating) {
        res.json({
          success: false,
          error: 'Documentation generation is already running for this project',
        });
        return;
      }

      // Start generation in background (fire-and-forget)
      docsService.generateDocs(projectPath, model).catch((error) => {
        // Errors are handled via events, just log here
        console.error('[DocsRoute] Generate docs failed (background):', error);
      });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  };
}

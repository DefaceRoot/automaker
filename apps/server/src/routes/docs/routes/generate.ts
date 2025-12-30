/**
 * POST /generate endpoint - Generate documentation for a project
 *
 * Supports two modes:
 * - 'generate': Full documentation generation from scratch
 * - 'regenerate': Incremental updates based on git changes
 *
 * If mode is not specified, it will be auto-detected based on whether
 * a generation manifest exists (regenerate if it does, generate if not).
 */

import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service.js';
import type { GenerationMode } from '../../../services/docs-prompts.js';

export function createGenerateHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, model, mode } = req.body as {
        projectPath: string;
        model?: string;
        mode?: GenerationMode;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath required' });
        return;
      }

      // Validate mode if provided
      if (mode && mode !== 'generate' && mode !== 'regenerate') {
        res.status(400).json({
          success: false,
          error: "Invalid mode. Must be 'generate' or 'regenerate'",
        });
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

      // Determine effective mode (auto-detect if not provided)
      const effectiveMode = mode ?? (await docsService.detectMode(projectPath));

      // Start generation in background (fire-and-forget)
      docsService.generateDocs(projectPath, model, effectiveMode).catch((error) => {
        // Errors are handled via events, just log here
        console.error('[DocsRoute] Generate docs failed (background):', error);
      });

      res.json({ success: true, mode: effectiveMode });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  };
}

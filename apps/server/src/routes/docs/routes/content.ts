/**
 * POST /content endpoint - Get content of a specific documentation file
 */

import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service.js';
import { isValidDocType, type DocType } from '../../../services/docs-prompts.js';

export function createContentHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, docType } = req.body as {
        projectPath: string;
        docType: string;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: 'projectPath required' });
        return;
      }

      if (!docType) {
        res.status(400).json({ success: false, error: 'docType required' });
        return;
      }

      if (!isValidDocType(docType)) {
        res.status(400).json({ success: false, error: `Invalid docType: ${docType}` });
        return;
      }

      const content = await docsService.getDocContent(projectPath, docType as DocType);

      if (content === null) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      res.json({ success: true, content });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  };
}

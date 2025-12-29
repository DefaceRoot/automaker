/**
 * Docs routes - HTTP API for AI-powered documentation generation
 */

import { Router } from 'express';
import { validatePathParams } from '../../middleware/validate-paths.js';
import { createGenerateHandler } from './routes/generate.js';
import { createStopHandler } from './routes/stop.js';
import { createListHandler } from './routes/list.js';
import { createContentHandler } from './routes/content.js';
import { createStatusHandler } from './routes/status.js';
import type { DocsService } from '../../services/docs-service.js';

export function createDocsRoutes(docsService: DocsService): Router {
  const router = Router();

  // POST /generate - Start documentation generation for a project
  router.post('/generate', validatePathParams('projectPath'), createGenerateHandler(docsService));

  // POST /stop - Stop documentation generation for a project
  router.post('/stop', validatePathParams('projectPath'), createStopHandler(docsService));

  // POST /list - List all available documentation for a project
  router.post('/list', validatePathParams('projectPath'), createListHandler(docsService));

  // POST /content - Get content of a specific documentation file
  router.post('/content', validatePathParams('projectPath'), createContentHandler(docsService));

  // GET /status - Get generation status for a project
  router.get('/status', createStatusHandler(docsService));

  return router;
}

/**
 * GET /api-keys endpoint - Get API keys status
 */

import type { Request, Response } from 'express';
import { getApiKey, getErrorMessage, logError } from '../common.js';

export function createApiKeysHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        hasAnthropicKey: !!getApiKey('anthropic') || !!process.env.ANTHROPIC_API_KEY,
        hasGoogleKey: false, // Google key is stored in credentials file, not env
        hasZaiKey: false, // Z.AI key is stored in credentials file, not env
      });
    } catch (error) {
      logError(error, 'Get API keys failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
    } catch (error) {
      logError(error, 'Get API keys failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

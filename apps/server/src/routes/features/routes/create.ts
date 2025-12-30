/**
 * POST /create endpoint - Create a new feature
 *
 * If worktrees are enabled in global settings, this will also:
 * 1. Create an isolated git worktree for the feature
 * 2. Use categorized naming: {category}/{number}-{slug}
 * 3. Copy task spec files into the worktree
 * 4. Update the feature with the branch name
 */

import type { Request, Response } from 'express';
import { FeatureLoader } from '../../../services/feature-loader.js';
import type { SettingsService } from '../../../services/settings-service.js';
import { worktreeLifecycleService } from '../../../services/worktree-lifecycle.js';
import type { Feature } from '@automaker/types';
import { getErrorMessage, logError, createLogger } from '../common.js';

const logger = createLogger('features/create');

export function createCreateHandler(
  featureLoader: FeatureLoader,
  settingsService?: SettingsService
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, feature } = req.body as {
        projectPath: string;
        feature: Partial<Feature>;
      };

      if (!projectPath || !feature) {
        res.status(400).json({
          success: false,
          error: 'projectPath and feature are required',
        });
        return;
      }

      // Create the feature first
      const created = await featureLoader.create(projectPath, feature);

      // Check if worktrees are enabled in global settings
      let worktreeCreated = false;
      if (settingsService) {
        const globalSettings = await settingsService.getGlobalSettings();
        if (globalSettings.useWorktrees) {
          logger.info(`Worktrees enabled, creating worktree for feature ${created.id}`);

          try {
            // Create worktree for the new feature
            const worktreeResult = await worktreeLifecycleService.createWorktreeForTask({
              projectPath,
              feature: created,
            });

            logger.info(
              `Worktree created: ${worktreeResult.worktreePath} (branch: ${worktreeResult.branchName})`
            );

            // Update created feature with branch name (the lifecycle service already updates it, but we want the response to include it)
            created.branchName = worktreeResult.branchName;
            worktreeCreated = true;
          } catch (worktreeError) {
            // Worktree creation failed - rollback by deleting the created feature
            logger.error('Worktree creation failed, rolling back feature creation:', worktreeError);
            try {
              await featureLoader.delete(projectPath, created.id);
              logger.info(`Rolled back feature ${created.id} after worktree creation failure`);
            } catch (deleteError) {
              logger.error('Failed to rollback feature after worktree error:', deleteError);
            }
            // Re-throw the original worktree error to fail the entire operation
            throw new Error(`Failed to create worktree: ${getErrorMessage(worktreeError)}`);
          }
        }
      }

      res.json({
        success: true,
        feature: created,
        worktreeCreated,
      });
    } catch (error) {
      logError(error, 'Create feature failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * WorktreeLifecycle - Service for integrating worktree creation into task lifecycle
 *
 * When a task starts and worktrees are enabled in global settings:
 * 1. Create an isolated git worktree based on the user-selected folder type
 * 2. Use sequential naming: {category}/{number}-{ai-generated-slug}
 * 3. Create branch from the target base branch
 * 4. Copy task spec files into the worktree directory
 * 5. Update feature with worktree path and branch name
 */

import path from 'path';
import * as secureFs from '../lib/secure-fs.js';
import { createLogger } from '@automaker/utils';
import { WorktreeManager, type CreateWorktreeResult } from './worktree-manager.js';
import { FeatureLoader, type Feature } from './feature-loader.js';
import type { WorktreeCategory } from '@automaker/types';
import { getFeatureDir } from '@automaker/platform';

const logger = createLogger('WorktreeLifecycle');

// Map feature categories to worktree categories
const CATEGORY_MAP: Record<string, WorktreeCategory> = {
  feature: 'feature',
  bugfix: 'bugfix',
  hotfix: 'hotfix',
  refactor: 'refactor',
  chore: 'chore',
  docs: 'docs',
  // Fallback mappings for common feature statuses/categories
  pending: 'feature',
  backlog: 'feature',
  in_progress: 'feature',
  completed: 'feature',
  verified: 'feature',
  // Default for uncategorized
  uncategorized: 'feature',
};

export interface WorktreeLifecycleOptions {
  projectPath: string;
  feature: Feature;
  baseBranch?: string;
  setupScript?: string;
}

export interface WorktreeLifecycleResult {
  worktreePath: string;
  branchName: string;
  isNew: boolean;
  specFilesCopied: string[];
}

/**
 * WorktreeLifecycleService - Integrates worktree creation into task lifecycle
 */
export class WorktreeLifecycleService {
  private worktreeManager: WorktreeManager;
  private featureLoader: FeatureLoader;

  constructor() {
    this.worktreeManager = new WorktreeManager();
    this.featureLoader = new FeatureLoader();
  }

  /**
   * Create a worktree for a feature when the task starts
   *
   * This method:
   * 1. Determines the worktree category from the feature
   * 2. Generates a title slug from the feature title/description
   * 3. Creates the worktree with sequential naming
   * 4. Copies spec files into the worktree
   * 5. Updates the feature with branch information
   *
   * @param options - Options for worktree creation
   * @returns Result including worktree path, branch name, and copied files
   */
  async createWorktreeForTask(options: WorktreeLifecycleOptions): Promise<WorktreeLifecycleResult> {
    const { projectPath, feature, baseBranch, setupScript } = options;

    logger.info(`Creating worktree for feature ${feature.id}`);

    // Determine the worktree category from feature
    const category = this.getWorktreeCategory(feature);
    logger.info(`Using category: ${category}`);

    // Generate a title for the worktree branch name
    const title = this.generateWorktreeTitle(feature);
    logger.info(`Generated title: ${title}`);

    // Check if feature already has a branch assigned
    if (feature.branchName) {
      // Try to find existing worktree for this branch
      const existingWorktree = await this.worktreeManager.findWorktreeForBranch(
        projectPath,
        feature.branchName
      );
      if (existingWorktree) {
        logger.info(
          `Found existing worktree for branch ${feature.branchName}: ${existingWorktree.path}`
        );

        // Copy spec files to existing worktree
        const specFilesCopied = await this.copySpecFilesToWorktree(
          projectPath,
          feature.id,
          existingWorktree.path
        );

        return {
          worktreePath: existingWorktree.path,
          branchName: feature.branchName,
          isNew: false,
          specFilesCopied,
        };
      }
    }

    // Create new worktree with categorized naming
    const worktreeResult = await this.worktreeManager.create({
      projectPath,
      category,
      title,
      baseBranch,
      runSetupScript: setupScript,
    });

    logger.info(`Created worktree: ${worktreeResult.path} (branch: ${worktreeResult.branch})`);

    // Copy spec files to the new worktree
    const specFilesCopied = await this.copySpecFilesToWorktree(
      projectPath,
      feature.id,
      worktreeResult.path
    );

    // Update feature with branch name
    await this.featureLoader.update(projectPath, feature.id, {
      branchName: worktreeResult.branch,
    });

    logger.info(`Updated feature ${feature.id} with branchName: ${worktreeResult.branch}`);

    return {
      worktreePath: worktreeResult.path,
      branchName: worktreeResult.branch,
      isNew: worktreeResult.isNew,
      specFilesCopied,
    };
  }

  /**
   * Ensure worktree exists for a feature, creating if needed
   *
   * Called when a task is about to start execution.
   * If the feature already has a branch and worktree, returns the existing one.
   * Otherwise, creates a new worktree.
   */
  async ensureWorktreeForTask(options: WorktreeLifecycleOptions): Promise<WorktreeLifecycleResult> {
    const { projectPath, feature } = options;

    // If feature has a branch, check if worktree exists
    if (feature.branchName) {
      const existingWorktree = await this.worktreeManager.findWorktreeForBranch(
        projectPath,
        feature.branchName
      );

      if (existingWorktree) {
        logger.info(`Using existing worktree for feature ${feature.id}: ${existingWorktree.path}`);

        // Still copy spec files in case they've been updated
        const specFilesCopied = await this.copySpecFilesToWorktree(
          projectPath,
          feature.id,
          existingWorktree.path
        );

        return {
          worktreePath: existingWorktree.path,
          branchName: feature.branchName,
          isNew: false,
          specFilesCopied,
        };
      }
    }

    // Create new worktree
    return this.createWorktreeForTask(options);
  }

  /**
   * Copy task spec files from the feature directory to the worktree
   *
   * Spec files include:
   * - feature.json (task definition)
   * - agent-output.md (if exists, for resume)
   * - Any image files
   * - Any text file attachments
   */
  private async copySpecFilesToWorktree(
    projectPath: string,
    featureId: string,
    worktreePath: string
  ): Promise<string[]> {
    const copiedFiles: string[] = [];
    const featureDir = getFeatureDir(projectPath, featureId);

    // Create .automaker/task directory in worktree
    const worktreeTaskDir = path.join(worktreePath, '.automaker', 'task');
    await secureFs.mkdir(worktreeTaskDir, { recursive: true });

    // Copy feature.json
    const featureJsonPath = path.join(featureDir, 'feature.json');
    try {
      await secureFs.access(featureJsonPath);
      const destPath = path.join(worktreeTaskDir, 'feature.json');
      await secureFs.copyFile(featureJsonPath, destPath);
      copiedFiles.push('feature.json');
      logger.info(`Copied feature.json to ${destPath}`);
    } catch (error) {
      logger.warn(`feature.json not found for feature ${featureId}`);
    }

    // Copy agent-output.md if it exists (for resume)
    const agentOutputPath = path.join(featureDir, 'agent-output.md');
    try {
      await secureFs.access(agentOutputPath);
      const destPath = path.join(worktreeTaskDir, 'agent-output.md');
      await secureFs.copyFile(agentOutputPath, destPath);
      copiedFiles.push('agent-output.md');
      logger.info(`Copied agent-output.md to ${destPath}`);
    } catch {
      // agent-output.md may not exist yet, that's fine
    }

    // Copy images directory if it exists
    const imagesDir = path.join(featureDir, 'images');
    try {
      await secureFs.access(imagesDir);
      const worktreeImagesDir = path.join(worktreeTaskDir, 'images');
      await secureFs.mkdir(worktreeImagesDir, { recursive: true });

      const imageEntries = (await secureFs.readdir(imagesDir, { withFileTypes: true })) as any[];
      for (const entry of imageEntries) {
        if (entry.isFile()) {
          const srcPath = path.join(imagesDir, entry.name);
          const destPath = path.join(worktreeImagesDir, entry.name);
          await secureFs.copyFile(srcPath, destPath);
          copiedFiles.push(`images/${entry.name}`);
        }
      }
      if (imageEntries.length > 0) {
        logger.info(`Copied ${imageEntries.length} image(s) to worktree`);
      }
    } catch {
      // Images directory may not exist, that's fine
    }

    return copiedFiles;
  }

  /**
   * Determine the worktree category from a feature
   */
  private getWorktreeCategory(feature: Feature): WorktreeCategory {
    // First, check if feature.category maps to a valid worktree category
    const featureCategory = feature.category?.toLowerCase() || '';

    if (featureCategory in CATEGORY_MAP) {
      return CATEGORY_MAP[featureCategory];
    }

    // Check if the status indicates a category
    const status = feature.status?.toLowerCase() || '';
    if (status in CATEGORY_MAP) {
      return CATEGORY_MAP[status];
    }

    // Check if the title/description contains category hints
    const titleLower = (feature.title || '').toLowerCase();
    const descLower = (feature.description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    if (combined.includes('bug') || combined.includes('fix')) {
      return 'bugfix';
    }
    if (combined.includes('hotfix') || combined.includes('urgent')) {
      return 'hotfix';
    }
    if (combined.includes('refactor') || combined.includes('cleanup')) {
      return 'refactor';
    }
    if (combined.includes('docs') || combined.includes('document')) {
      return 'docs';
    }
    if (combined.includes('chore') || combined.includes('maintenance')) {
      return 'chore';
    }

    // Default to feature
    return 'feature';
  }

  /**
   * Generate a title for the worktree branch name from feature
   */
  private generateWorktreeTitle(feature: Feature): string {
    // Prefer title over description
    if (feature.title && feature.title.trim()) {
      return feature.title.trim();
    }

    // Use description if no title
    if (feature.description && feature.description.trim()) {
      // Take first 100 chars of description
      return feature.description.trim().substring(0, 100);
    }

    // Fallback to feature ID
    return `task-${feature.id.substring(0, 8)}`;
  }

  /**
   * Get the worktree manager instance
   */
  getWorktreeManager(): WorktreeManager {
    return this.worktreeManager;
  }
}

// Export singleton instance
export const worktreeLifecycleService = new WorktreeLifecycleService();

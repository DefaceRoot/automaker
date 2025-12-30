/**
 * Feature types for AutoMaker feature management
 */

import type { PlanningMode, WorktreeCategory } from './settings.js';

export interface FeatureImagePath {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  [key: string]: unknown;
}

export interface FeatureTextFilePath {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  content: string; // Text content of the file
  [key: string]: unknown;
}

export interface Feature {
  id: string;
  title?: string;
  titleGenerating?: boolean;
  category: string;
  description: string;
  passes?: boolean;
  priority?: number;
  status?: string;
  dependencies?: string[];
  spec?: string;
  model?: string;
  planningModel?: string;
  implementationEndpointPreset?: 'default' | 'zai' | 'custom';
  implementationEndpointUrl?: string;
  imagePaths?: Array<string | FeatureImagePath | { path: string; [key: string]: unknown }>;
  textFilePaths?: FeatureTextFilePath[];
  // Branch info - worktree path is derived at runtime from branchName
  branchName?: string; // Name of the feature branch (undefined = use current worktree)
  worktreeCategory?: WorktreeCategory; // Category for worktree folder (feature/bugfix/hotfix/refactor/chore/docs)
  skipTests?: boolean;
  thinkingLevel?: string;
  planningMode?: PlanningMode;
  enabledMcpServers?: string[]; // IDs of MCP servers enabled for this task
  requirePlanApproval?: boolean;
  trackedFiles?: string[]; // Files modified by this specific task (relative paths)
  planSpec?: {
    status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected';
    content?: string;
    version: number;
    generatedAt?: string;
    approvedAt?: string;
    reviewedByUser: boolean;
    tasksCompleted?: number;
    tasksTotal?: number;
  };
  /** Tracks when changes from this task have been staged to a target branch */
  stagedToTarget?: {
    targetBranch: string; // e.g., "main"
    stagedFiles: string[]; // Files that were staged from this task
    stagedAt: string; // ISO timestamp
  };
  error?: string;
  summary?: string;
  startedAt?: string;
  [key: string]: unknown; // Keep catch-all for extensibility
}

export type FeatureStatus = 'pending' | 'running' | 'completed' | 'failed' | 'verified';

/**
 * Documentation Manifest Service - Tracks documentation generation metadata
 *
 * Manages:
 * - Generation timestamps for change detection
 * - Git commit hash at generation time
 * - Per-document generation status
 * - Mode detection (generate vs regenerate)
 */

import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as secureFs from '../lib/secure-fs.js';
import type { DocType } from './docs-prompts.js';

const execAsync = promisify(exec);

/**
 * Generation mode for documentation
 */
export type GenerationMode = 'generate' | 'regenerate';

/**
 * Record of a single document's generation
 */
export interface DocGenerationRecord {
  /** When this doc was generated */
  generatedAt: string;
  /** Whether generation succeeded */
  status: 'success' | 'error';
}

/**
 * Full generation manifest stored in docs/.generation-manifest.json
 */
export interface DocsGenerationManifest {
  /** Schema version for future compatibility */
  version: 1;
  /** When the last generation completed */
  lastGeneratedAt: string;
  /** Git commit hash at generation time (null if not a git repo) */
  lastCommitHash: string | null;
  /** Model used for generation */
  model: string;
  /** Mode used for this generation */
  mode: GenerationMode;
  /** Per-document generation records */
  docs: Partial<Record<DocType, DocGenerationRecord>>;
}

/**
 * Git changes since last generation
 */
export interface GitChanges {
  /** List of changed files with their status */
  changedFiles: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';
  }>;
  /** List of commits since last generation */
  commitsSinceLastGen: Array<{
    hash: string;
    message: string;
    date: string;
  }>;
  /** Human-readable summary for prompts */
  summary: string;
  /** Whether any changes were detected */
  hasChanges: boolean;
}

const MANIFEST_FILENAME = '.generation-manifest.json';

/**
 * Get the manifest file path for a project
 */
function getManifestPath(projectPath: string): string {
  return path.join(projectPath, 'docs', MANIFEST_FILENAME);
}

/**
 * Read the generation manifest for a project
 *
 * @param projectPath - The project directory path
 * @returns The manifest or null if not found
 */
export async function readDocsManifest(
  projectPath: string
): Promise<DocsGenerationManifest | null> {
  const manifestPath = getManifestPath(projectPath);

  try {
    const content = (await secureFs.readFile(manifestPath, 'utf-8')) as string;
    const manifest = JSON.parse(content) as DocsGenerationManifest;

    // Validate version
    if (manifest.version !== 1) {
      console.warn(`[DocsManifest] Unknown manifest version: ${manifest.version}`);
      return null;
    }

    return manifest;
  } catch {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Write the generation manifest for a project
 *
 * @param projectPath - The project directory path
 * @param manifest - The manifest to write
 */
export async function writeDocsManifest(
  projectPath: string,
  manifest: DocsGenerationManifest
): Promise<void> {
  const manifestPath = getManifestPath(projectPath);

  // Ensure docs directory exists
  const docsDir = path.dirname(manifestPath);
  await secureFs.mkdir(docsDir, { recursive: true });

  // Write manifest with pretty formatting
  const content = JSON.stringify(manifest, null, 2);
  await secureFs.writeFile(manifestPath, content);
}

/**
 * Get the timestamp of the last generation
 *
 * @param projectPath - The project directory path
 * @returns ISO timestamp or null if never generated
 */
export async function getLastGenerationTime(projectPath: string): Promise<string | null> {
  const manifest = await readDocsManifest(projectPath);
  return manifest?.lastGeneratedAt ?? null;
}

/**
 * Get the current git HEAD commit hash
 *
 * @param projectPath - The project directory path
 * @returns Commit hash or null if not a git repo
 */
export async function getCurrentCommitHash(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', {
      cwd: projectPath,
    });
    return stdout.trim();
  } catch {
    // Not a git repo or git not available
    return null;
  }
}

/**
 * Parse git status character to human-readable status
 */
function parseGitStatusChar(
  char: string
): 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown' {
  switch (char) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      return 'unknown';
  }
}

/**
 * Get git changes since the last documentation generation
 *
 * @param projectPath - The project directory path
 * @returns Git changes information
 */
export async function getChangesSinceLastGeneration(projectPath: string): Promise<GitChanges> {
  const manifest = await readDocsManifest(projectPath);

  // Default empty result
  const emptyResult: GitChanges = {
    changedFiles: [],
    commitsSinceLastGen: [],
    summary: 'No previous generation found - this will be a fresh generation.',
    hasChanges: true,
  };

  if (!manifest?.lastGeneratedAt) {
    return emptyResult;
  }

  try {
    // Get commits since last generation
    const { stdout: logOutput } = await execAsync(
      `git log --since="${manifest.lastGeneratedAt}" --format="%H|%s|%ai" --name-status`,
      { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large repos
    );

    if (!logOutput.trim()) {
      return {
        changedFiles: [],
        commitsSinceLastGen: [],
        summary: 'No changes detected since last generation.',
        hasChanges: false,
      };
    }

    // Parse the git log output
    const commits: GitChanges['commitsSinceLastGen'] = [];
    const changedFilesSet = new Map<
      string,
      'added' | 'modified' | 'deleted' | 'renamed' | 'unknown'
    >();

    const lines = logOutput.trim().split('\n');
    let currentCommit: { hash: string; message: string; date: string } | null = null;

    for (const line of lines) {
      if (line.includes('|')) {
        // This is a commit line: hash|message|date
        const [hash, message, date] = line.split('|');
        currentCommit = { hash, message, date };
        commits.push(currentCommit);
      } else if (line.match(/^[AMDRT]\t/)) {
        // This is a file status line: A/M/D/R<tab>filepath
        const statusChar = line[0];
        const filePath = line.substring(2).trim();

        // For renames, git shows "R<score>\told\tnew" - extract just the new name
        const actualPath = filePath.includes('\t') ? filePath.split('\t').pop()! : filePath;

        const status = parseGitStatusChar(statusChar);
        changedFilesSet.set(actualPath, status);
      }
    }

    const changedFiles = Array.from(changedFilesSet.entries()).map(([p, status]) => ({
      path: p,
      status,
    }));

    // Build summary
    const summaryParts: string[] = [];
    summaryParts.push(
      `${commits.length} commit(s) since last generation on ${manifest.lastGeneratedAt}.`
    );

    if (changedFiles.length > 0) {
      const added = changedFiles.filter((f) => f.status === 'added').length;
      const modified = changedFiles.filter((f) => f.status === 'modified').length;
      const deleted = changedFiles.filter((f) => f.status === 'deleted').length;

      const parts: string[] = [];
      if (added > 0) parts.push(`${added} added`);
      if (modified > 0) parts.push(`${modified} modified`);
      if (deleted > 0) parts.push(`${deleted} deleted`);

      summaryParts.push(`Files changed: ${parts.join(', ')}.`);
    }

    return {
      changedFiles,
      commitsSinceLastGen: commits,
      summary: summaryParts.join(' '),
      hasChanges: changedFiles.length > 0 || commits.length > 0,
    };
  } catch (error) {
    console.error('[DocsManifest] Failed to get git changes:', error);
    return {
      changedFiles: [],
      commitsSinceLastGen: [],
      summary: 'Unable to detect git changes. Will perform full analysis.',
      hasChanges: true,
    };
  }
}

/**
 * Create a new manifest for a generation run
 *
 * @param model - The model used for generation
 * @param mode - The generation mode
 * @param commitHash - Current git commit hash
 * @returns A new manifest object
 */
export function createManifest(
  model: string,
  mode: GenerationMode,
  commitHash: string | null
): DocsGenerationManifest {
  return {
    version: 1,
    lastGeneratedAt: new Date().toISOString(),
    lastCommitHash: commitHash,
    model,
    mode,
    docs: {},
  };
}

/**
 * Update a manifest with a document generation result
 *
 * @param manifest - The manifest to update
 * @param docType - The document type
 * @param success - Whether generation succeeded
 */
export function updateManifestDoc(
  manifest: DocsGenerationManifest,
  docType: DocType,
  success: boolean
): void {
  manifest.docs[docType] = {
    generatedAt: new Date().toISOString(),
    status: success ? 'success' : 'error',
  };
}

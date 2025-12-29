/**
 * Documentation Service - AI-powered project documentation generation
 *
 * Manages:
 * - Parallel documentation generation using 6 Claude agents
 * - Real-time progress streaming via events
 * - Document storage in {projectPath}/docs/
 * - Generation cancellation support
 */

import path from 'path';
import { resolveModelString, DEFAULT_MODELS } from '@automaker/model-resolver';
import { classifyError } from '@automaker/utils';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { ExecuteOptions } from '../providers/types.js';
import * as secureFs from '../lib/secure-fs.js';
import type { EventEmitter } from '../lib/events.js';
import {
  DOC_TYPES,
  type DocType,
  type DocTypeInfo,
  getDocSystemPrompt,
  getDocFilename,
  buildDocUserPrompt,
} from './docs-prompts.js';

/**
 * Status of a single document generation
 */
export type DocStatus = 'pending' | 'generating' | 'completed' | 'error' | 'stopped';

/**
 * Progress info for a single document
 */
export interface DocProgress {
  docType: DocType;
  displayName: string;
  status: DocStatus;
  filename: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Overall generation status
 */
export interface GenerationStatus {
  isGenerating: boolean;
  projectPath: string | null;
  startedAt: string | null;
  progress: DocProgress[];
  completedCount: number;
  totalCount: number;
}

/**
 * Document info for listing
 */
export interface DocInfo {
  docType: DocType;
  displayName: string;
  filename: string;
  description: string;
  exists: boolean;
  modifiedAt?: string;
}

/**
 * Running generation state per project
 */
interface RunningGeneration {
  projectPath: string;
  abortController: AbortController;
  startedAt: string;
  progress: Map<DocType, DocProgress>;
}

/**
 * Builds codebase context by analyzing the project directory structure.
 * This is a simple implementation that reads the directory tree and key files.
 */
async function buildCodebaseContext(projectPath: string): Promise<string> {
  const contextParts: string[] = [];

  try {
    // Get directory listing (top level)
    const entries = await secureFs.readdir(projectPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);

    contextParts.push('## Project Root Structure\n');
    contextParts.push('### Directories:');
    contextParts.push(dirs.map((d) => `- ${d}/`).join('\n') || '(none)');
    contextParts.push('\n### Files:');
    contextParts.push(files.map((f) => `- ${f}`).join('\n') || '(none)');

    // Try to read package.json for tech stack info
    try {
      const pkgPath = path.join(projectPath, 'package.json');
      const pkgContent = (await secureFs.readFile(pkgPath, 'utf-8')) as string;
      const pkg = JSON.parse(pkgContent);
      contextParts.push('\n## package.json Summary');
      if (pkg.name) contextParts.push(`- **Name:** ${pkg.name}`);
      if (pkg.description) contextParts.push(`- **Description:** ${pkg.description}`);
      if (pkg.version) contextParts.push(`- **Version:** ${pkg.version}`);
      if (pkg.dependencies) {
        contextParts.push('- **Dependencies:** ' + Object.keys(pkg.dependencies).join(', '));
      }
      if (pkg.devDependencies) {
        contextParts.push('- **Dev Dependencies:** ' + Object.keys(pkg.devDependencies).join(', '));
      }
      if (pkg.scripts) {
        contextParts.push('- **Scripts:** ' + Object.keys(pkg.scripts).join(', '));
      }
    } catch {
      // No package.json or can't read it
    }

    // Try to read README.md
    try {
      const readmePath = path.join(projectPath, 'README.md');
      const readmeContent = (await secureFs.readFile(readmePath, 'utf-8')) as string;
      contextParts.push('\n## README.md Content (truncated)');
      contextParts.push(readmeContent.substring(0, 3000));
      if (readmeContent.length > 3000) {
        contextParts.push('\n... (truncated)');
      }
    } catch {
      // No README.md or can't read it
    }

    // Try to read tsconfig.json for TypeScript info
    try {
      const tsconfigPath = path.join(projectPath, 'tsconfig.json');
      const tsconfigContent = (await secureFs.readFile(tsconfigPath, 'utf-8')) as string;
      contextParts.push('\n## TypeScript Configuration');
      contextParts.push('Project uses TypeScript. tsconfig.json found.');
    } catch {
      // No tsconfig.json
    }

    // Look for common framework indicators
    const frameworkIndicators: string[] = [];
    if (files.includes('next.config.js') || files.includes('next.config.ts')) {
      frameworkIndicators.push('Next.js');
    }
    if (files.includes('vite.config.ts') || files.includes('vite.config.js')) {
      frameworkIndicators.push('Vite');
    }
    if (files.includes('angular.json')) {
      frameworkIndicators.push('Angular');
    }
    if (files.includes('vue.config.js')) {
      frameworkIndicators.push('Vue.js');
    }
    if (dirs.includes('src') || dirs.includes('apps') || dirs.includes('packages')) {
      if (dirs.includes('apps') && dirs.includes('packages')) {
        frameworkIndicators.push('Monorepo');
      }
    }

    if (frameworkIndicators.length > 0) {
      contextParts.push('\n## Detected Frameworks/Patterns');
      contextParts.push(frameworkIndicators.join(', '));
    }
  } catch (error) {
    contextParts.push('Unable to fully analyze project structure: ' + String(error));
  }

  return contextParts.join('\n');
}

export class DocsService {
  private events: EventEmitter;
  private runningGenerations = new Map<string, RunningGeneration>();

  constructor(events: EventEmitter) {
    this.events = events;
  }

  /**
   * Generate all documentation for a project.
   * Spawns 6 parallel agents to generate each doc type.
   * Returns immediately; progress is streamed via events.
   *
   * @param projectPath - The project directory path
   * @param model - Optional model override (defaults to claude sonnet)
   */
  async generateDocs(projectPath: string, model?: string): Promise<void> {
    // Check if generation is already running for this project
    if (this.runningGenerations.has(projectPath)) {
      throw new Error('Documentation generation is already running for this project');
    }

    // Resolve the model to use
    const resolvedModel = resolveModelString(model, DEFAULT_MODELS.claude);

    // Create abort controller for this generation
    const abortController = new AbortController();
    const startedAt = new Date().toISOString();

    // Initialize progress tracking
    const progress = new Map<DocType, DocProgress>();
    for (const docType of DOC_TYPES) {
      progress.set(docType.type, {
        docType: docType.type,
        displayName: docType.displayName,
        status: 'pending',
        filename: docType.filename,
      });
    }

    // Store running generation state
    this.runningGenerations.set(projectPath, {
      projectPath,
      abortController,
      startedAt,
      progress,
    });

    // Emit generation started event
    this.emitDocsEvent('docs:generation-started', {
      projectPath,
      startedAt,
      docTypes: DOC_TYPES.map((dt) => ({
        type: dt.type,
        displayName: dt.displayName,
        filename: dt.filename,
      })),
    });

    // Ensure docs directory exists
    const docsDir = path.join(projectPath, 'docs');
    try {
      await secureFs.mkdir(docsDir, { recursive: true });
    } catch (error) {
      console.error('[DocsService] Failed to create docs directory:', error);
    }

    // Build codebase context (shared across all agents)
    const projectName = path.basename(projectPath);
    let codebaseContext: string;
    try {
      codebaseContext = await buildCodebaseContext(projectPath);
    } catch (error) {
      console.error('[DocsService] Failed to build codebase context:', error);
      codebaseContext = `Project: ${projectName}\nPath: ${projectPath}`;
    }

    // Run all doc generations in parallel
    this.runParallelGeneration(
      projectPath,
      resolvedModel,
      codebaseContext,
      projectName,
      abortController,
      progress
    ).catch((error) => {
      console.error('[DocsService] Parallel generation error:', error);
    });
  }

  /**
   * Run documentation generations with limited concurrency to avoid overwhelming the CLI
   */
  private async runParallelGeneration(
    projectPath: string,
    model: string,
    codebaseContext: string,
    projectName: string,
    abortController: AbortController,
    progress: Map<DocType, DocProgress>
  ): Promise<void> {
    const docsDir = path.join(projectPath, 'docs');

    // Run with limited concurrency (2 at a time) to avoid overwhelming the CLI
    const CONCURRENCY_LIMIT = 2;
    const results: PromiseSettledResult<boolean>[] = [];

    for (let i = 0; i < DOC_TYPES.length; i += CONCURRENCY_LIMIT) {
      // Check if aborted before starting batch
      if (abortController.signal.aborted) {
        break;
      }

      const batch = DOC_TYPES.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = batch.map((docTypeInfo) =>
        this.generateSingleDoc(
          projectPath,
          docsDir,
          docTypeInfo,
          model,
          codebaseContext,
          projectName,
          abortController,
          progress
        )
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    // Check if we were stopped
    const generation = this.runningGenerations.get(projectPath);
    const wasStopped = !generation || abortController.signal.aborted;

    // Count successes and failures
    let successCount = 0;
    let errorCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Clean up running state
    this.runningGenerations.delete(projectPath);

    // Emit completion event
    this.emitDocsEvent('docs:generation-completed', {
      projectPath,
      completedAt: new Date().toISOString(),
      successCount,
      errorCount,
      totalCount: DOC_TYPES.length,
      wasStopped,
    });
  }

  /**
   * Generate a single documentation file
   */
  private async generateSingleDoc(
    projectPath: string,
    docsDir: string,
    docTypeInfo: DocTypeInfo,
    model: string,
    codebaseContext: string,
    projectName: string,
    abortController: AbortController,
    progress: Map<DocType, DocProgress>
  ): Promise<boolean> {
    const { type: docType, displayName, filename } = docTypeInfo;

    // Update progress to generating
    const docProgress = progress.get(docType);
    if (docProgress) {
      docProgress.status = 'generating';
      docProgress.startedAt = new Date().toISOString();
    }

    this.emitDocsEvent('docs:doc-progress', {
      projectPath,
      docType,
      displayName,
      status: 'generating',
      filename,
    });

    try {
      // Check if aborted before starting
      if (abortController.signal.aborted) {
        throw new Error('Generation stopped');
      }

      // Get provider for the model
      const provider = ProviderFactory.getProviderForModel(model);

      // Build prompts
      const systemPrompt = getDocSystemPrompt(docType);
      const userPrompt = buildDocUserPrompt(docType, codebaseContext, projectName);

      // Execute options
      const executeOptions: ExecuteOptions = {
        prompt: userPrompt,
        model,
        cwd: projectPath,
        systemPrompt,
        maxTurns: 10,
        allowedTools: ['Read', 'Glob', 'Grep'],
        abortController,
      };

      console.log(`[DocsService] Starting generation for ${displayName} (${docType})`);
      console.log(`[DocsService] Using model: ${model}, cwd: ${projectPath}`);
      console.log(
        `[DocsService] Prompt length: ${userPrompt.length}, System prompt length: ${systemPrompt.length}`
      );

      // Execute the query and collect output
      let docContent = '';
      const stream = provider.executeQuery(executeOptions);

      for await (const msg of stream) {
        // Check for abort during streaming
        if (abortController.signal.aborted) {
          throw new Error('Generation stopped');
        }

        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              docContent += block.text;
            }
          }
        } else if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
          // Final result
          docContent = msg.result;
        }
      }

      // Write the document to file
      const outputPath = path.join(docsDir, filename);
      await secureFs.writeFile(outputPath, docContent);

      console.log(`[DocsService] Completed generation for ${displayName}, saved to ${filename}`);

      // Update progress to completed
      if (docProgress) {
        docProgress.status = 'completed';
        docProgress.completedAt = new Date().toISOString();
      }

      this.emitDocsEvent('docs:doc-completed', {
        projectPath,
        docType,
        displayName,
        filename,
        completedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      const errorInfo = classifyError(error);

      // Check if this was an abort/stop
      if (errorInfo.isAbort || abortController.signal.aborted) {
        console.log(`[DocsService] Generation stopped for ${displayName}`);
        if (docProgress) {
          docProgress.status = 'stopped';
        }
        this.emitDocsEvent('docs:doc-error', {
          projectPath,
          docType,
          displayName,
          filename,
          error: 'Generation stopped',
          stopped: true,
        });
        return false;
      }

      console.error(`[DocsService] Generation failed for ${displayName}:`, error);

      // Update progress to error
      if (docProgress) {
        docProgress.status = 'error';
        docProgress.error = errorInfo.message;
      }

      this.emitDocsEvent('docs:doc-error', {
        projectPath,
        docType,
        displayName,
        filename,
        error: errorInfo.message,
        stopped: false,
      });

      return false;
    }
  }

  /**
   * Stop all running documentation generation for a project
   *
   * @param projectPath - The project directory path
   * @returns true if generation was running and stopped, false otherwise
   */
  stopGeneration(projectPath: string): boolean {
    const generation = this.runningGenerations.get(projectPath);
    if (!generation) {
      return false;
    }

    console.log(`[DocsService] Stopping documentation generation for ${projectPath}`);

    // Abort all running agents
    generation.abortController.abort();

    // Don't remove from runningGenerations yet - the parallel generation will clean up
    return true;
  }

  /**
   * Get the content of a specific documentation file
   *
   * @param projectPath - The project directory path
   * @param docType - The documentation type to retrieve
   * @returns The document content or null if not found
   */
  async getDocContent(projectPath: string, docType: DocType): Promise<string | null> {
    const filename = getDocFilename(docType);
    const docPath = path.join(projectPath, 'docs', filename);

    try {
      const content = (await secureFs.readFile(docPath, 'utf-8')) as string;
      return content;
    } catch {
      return null;
    }
  }

  /**
   * List all available documentation for a project
   *
   * @param projectPath - The project directory path
   * @returns Array of document info objects
   */
  async listDocs(projectPath: string): Promise<DocInfo[]> {
    const docsDir = path.join(projectPath, 'docs');
    const docs: DocInfo[] = [];

    for (const docTypeInfo of DOC_TYPES) {
      const docPath = path.join(docsDir, docTypeInfo.filename);
      let exists = false;
      let modifiedAt: string | undefined;

      try {
        const stats = await secureFs.stat(docPath);
        exists = true;
        modifiedAt = stats.mtime.toISOString();
      } catch {
        // File doesn't exist
      }

      docs.push({
        docType: docTypeInfo.type,
        displayName: docTypeInfo.displayName,
        filename: docTypeInfo.filename,
        description: docTypeInfo.description,
        exists,
        modifiedAt,
      });
    }

    return docs;
  }

  /**
   * Get the current generation status for a project
   *
   * @param projectPath - The project directory path
   * @returns Current generation status
   */
  getStatus(projectPath: string): GenerationStatus {
    const generation = this.runningGenerations.get(projectPath);

    if (!generation) {
      // Not generating - return empty status
      return {
        isGenerating: false,
        projectPath: null,
        startedAt: null,
        progress: [],
        completedCount: 0,
        totalCount: DOC_TYPES.length,
      };
    }

    // Convert progress map to array
    const progressArray = Array.from(generation.progress.values());
    const completedCount = progressArray.filter(
      (p) => p.status === 'completed' || p.status === 'error' || p.status === 'stopped'
    ).length;

    return {
      isGenerating: true,
      projectPath: generation.projectPath,
      startedAt: generation.startedAt,
      progress: progressArray,
      completedCount,
      totalCount: DOC_TYPES.length,
    };
  }

  /**
   * Emit a documentation event
   */
  private emitDocsEvent(
    type:
      | 'docs:generation-started'
      | 'docs:doc-progress'
      | 'docs:doc-completed'
      | 'docs:doc-error'
      | 'docs:generation-completed',
    payload: unknown
  ): void {
    // Cast to EventType since these types are defined in libs/types/src/event.ts
    // but may not be recognized if the types package hasn't been rebuilt
    this.events.emit(type as import('../lib/events.js').EventType, payload);
  }
}

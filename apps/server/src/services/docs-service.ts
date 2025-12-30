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
import type { SettingsService } from './settings-service.js';
import { computeZaiEnv, needsZaiEndpoint, getZaiCredentialsError } from '../lib/env-computation.js';
import {
  DOC_TYPES,
  type DocType,
  type DocTypeInfo,
  type GenerationMode,
  getDocSystemPrompt,
  getDocFilename,
  buildDocUserPrompt,
  buildRegenerateUserPrompt,
} from './docs-prompts.js';
import {
  type GitChanges,
  type DocsGenerationManifest,
  readDocsManifest,
  writeDocsManifest,
  getChangesSinceLastGeneration,
  getCurrentCommitHash,
  createManifest,
  updateManifestDoc,
  syncManifestWithDisk,
} from './docs-manifest.js';

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

    // NOTE: We intentionally do NOT include README.md or other markdown docs
    // The codebase itself is the single source of truth for documentation generation
    // Claude will use subagents to explore the actual code

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

/**
 * Clean document content by stripping any transitional/meta text that
 * the agent may output before the actual markdown documentation.
 *
 * The agent sometimes outputs text like "Now I have all the information
 * I need to create comprehensive Project Overview documentation. Let me
 * generate it:" before starting the actual documentation.
 *
 * This function finds the first markdown heading and returns everything
 * from that point onwards.
 *
 * @param content - The raw document content
 * @returns The cleaned document content starting from the first heading
 */
function cleanDocContent(content: string): string {
  if (!content) return content;

  // Find the first line that starts with a markdown heading (# at start of line)
  // This regex matches a line that starts with one or more # followed by a space
  const headingMatch = content.match(/^(#{1,6}\s)/m);

  if (headingMatch && headingMatch.index !== undefined) {
    // Return everything from the first heading onwards
    const cleaned = content.slice(headingMatch.index);
    return cleaned;
  }

  // Fallback: if no heading found, return original content
  return content;
}

export class DocsService {
  private events: EventEmitter;
  private settingsService: SettingsService;
  private runningGenerations = new Map<string, RunningGeneration>();

  constructor(events: EventEmitter, settingsService: SettingsService) {
    this.events = events;
    this.settingsService = settingsService;
  }

  /**
   * Generate all documentation for a project.
   * Spawns 6 parallel agents to generate each doc type.
   * Returns immediately; progress is streamed via events.
   *
   * @param projectPath - The project directory path
   * @param model - Optional model override (defaults to claude sonnet)
   * @param mode - Generation mode: 'generate' for full, 'regenerate' for incremental updates
   */
  async generateDocs(projectPath: string, model?: string, mode?: GenerationMode): Promise<void> {
    // Check if generation is already running for this project
    if (this.runningGenerations.has(projectPath)) {
      throw new Error('Documentation generation is already running for this project');
    }

    // Resolve the model to use
    const resolvedModel = resolveModelString(model, DEFAULT_MODELS.claude);

    // Compute provider environment for GLM/Z.AI models
    let providerEnv: Record<string, string> | null = null;
    if (needsZaiEndpoint(resolvedModel)) {
      const credentials = await this.settingsService.getCredentials();
      providerEnv = computeZaiEnv(credentials);
      if (!providerEnv) {
        throw new Error(getZaiCredentialsError());
      }
    }

    // Auto-detect mode if not provided
    const effectiveMode = mode ?? (await this.detectMode(projectPath));
    console.log(`[DocsService] Using mode: ${effectiveMode}`);

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
      mode: effectiveMode,
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

    // For regenerate mode, load existing docs and git changes
    let existingDocs = new Map<DocType, string>();
    let gitChanges: GitChanges | null = null;

    if (effectiveMode === 'regenerate') {
      console.log('[DocsService] Regenerate mode: Loading existing docs and git changes...');

      // Load existing doc contents
      for (const docTypeInfo of DOC_TYPES) {
        const content = await this.getDocContent(projectPath, docTypeInfo.type);
        if (content) {
          existingDocs.set(docTypeInfo.type, content);
        }
      }
      console.log(`[DocsService] Loaded ${existingDocs.size} existing documents`);

      // Get git changes since last generation
      gitChanges = await getChangesSinceLastGeneration(projectPath);
      console.log(`[DocsService] Git changes: ${gitChanges.summary}`);
    }

    // Run all doc generations in parallel
    this.runParallelGeneration(
      projectPath,
      resolvedModel,
      codebaseContext,
      projectName,
      abortController,
      progress,
      effectiveMode,
      existingDocs,
      gitChanges,
      providerEnv
    ).catch((error) => {
      console.error('[DocsService] Parallel generation error:', error);
    });
  }

  /**
   * Detect whether to use generate or regenerate mode based on existing manifest
   *
   * @param projectPath - The project directory path
   * @returns 'regenerate' if manifest exists, 'generate' otherwise
   */
  async detectMode(projectPath: string): Promise<GenerationMode> {
    const manifest = await readDocsManifest(projectPath);
    if (manifest) {
      console.log(
        `[DocsService] Found manifest from ${manifest.lastGeneratedAt}, using regenerate mode`
      );
      return 'regenerate';
    }
    console.log('[DocsService] No manifest found, using generate mode');
    return 'generate';
  }

  /**
   * Run all documentation generations in parallel.
   * Each document spawns its own Claude Code CLI process via the SDK,
   * giving each document its own context window for maximum quality.
   */
  private async runParallelGeneration(
    projectPath: string,
    model: string,
    codebaseContext: string,
    projectName: string,
    abortController: AbortController,
    progress: Map<DocType, DocProgress>,
    mode: GenerationMode,
    existingDocs: Map<DocType, string>,
    gitChanges: GitChanges | null,
    providerEnv: Record<string, string> | null
  ): Promise<void> {
    const docsDir = path.join(projectPath, 'docs');

    // Create manifest for this generation run
    const commitHash = await getCurrentCommitHash(projectPath);
    const manifest = createManifest(model, mode, commitHash);

    // Run all doc generations in parallel - each spawns its own Claude Code CLI process
    // This gives each document its own context window for maximum quality
    // Add a small stagger delay between starts to avoid overwhelming the API
    const STAGGER_DELAY_MS = 500; // 500ms between each doc start
    const allPromises = DOC_TYPES.map(
      (docTypeInfo, index) =>
        // Stagger the start of each generation to avoid rate limiting
        new Promise<boolean>((resolve) => {
          setTimeout(async () => {
            try {
              const result = await this.generateSingleDoc(
                projectPath,
                docsDir,
                docTypeInfo,
                model,
                codebaseContext,
                projectName,
                abortController,
                progress,
                mode,
                existingDocs.get(docTypeInfo.type),
                gitChanges,
                manifest,
                providerEnv
              );
              resolve(result);
            } catch (error) {
              console.error(
                `[DocsService] Unexpected error generating ${docTypeInfo.displayName}:`,
                error
              );
              resolve(false);
            }
          }, index * STAGGER_DELAY_MS);
        })
    );

    const results = await Promise.allSettled(allPromises);

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

    // Write the manifest after all generations complete
    if (!wasStopped) {
      try {
        manifest.lastGeneratedAt = new Date().toISOString();
        await writeDocsManifest(projectPath, manifest);
        console.log('[DocsService] Wrote generation manifest');
      } catch (error) {
        console.error('[DocsService] Failed to write manifest:', error);
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
      mode,
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
    progress: Map<DocType, DocProgress>,
    mode: GenerationMode,
    existingContent: string | undefined,
    gitChanges: GitChanges | null,
    manifest: DocsGenerationManifest,
    providerEnv: Record<string, string> | null
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
      mode,
    });

    // Retry logic for transient CLI errors (e.g., when multiple processes start simultaneously)
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if aborted before starting
        if (abortController.signal.aborted) {
          throw new Error('Generation stopped');
        }

        // Get provider for the model
        const provider = ProviderFactory.getProviderForModel(model);

        // Build prompts based on mode
        const systemPrompt = getDocSystemPrompt(docType, mode);
        let userPrompt: string;

        if (mode === 'regenerate' && existingContent && gitChanges) {
          // Use regenerate prompt with existing content and git changes
          userPrompt = buildRegenerateUserPrompt(
            docType,
            codebaseContext,
            projectName,
            existingContent,
            gitChanges
          );
        } else {
          // Use standard generate prompt
          userPrompt = buildDocUserPrompt(docType, codebaseContext, projectName);
        }

        // Execute options - each doc gets its own CLI process with full tool access
        // Task tool enables subagent spawning for deep codebase exploration
        const executeOptions: ExecuteOptions = {
          prompt: userPrompt,
          model,
          cwd: projectPath,
          systemPrompt,
          maxTurns: 30, // Increased to allow thorough exploration with subagents
          allowedTools: ['Read', 'Glob', 'Grep', 'Task'],
          abortController,
          // Inject Z.AI environment for GLM models
          ...(providerEnv ? { providerConfig: { env: providerEnv } } : {}),
        };

        if (attempt === 0) {
          console.log(`[DocsService] Starting generation for ${displayName} (${docType})`);
          console.log(`[DocsService] Using model: ${model}, cwd: ${projectPath}`);
          console.log(
            `[DocsService] Prompt length: ${userPrompt.length}, System prompt length: ${systemPrompt.length}`
          );
        } else {
          console.log(
            `[DocsService] Retrying generation for ${displayName} (attempt ${attempt + 1}/${maxRetries + 1})`
          );
        }

        // Execute the query and collect output
        let docContent = '';
        let receivedSuccessResult = false;
        let messageCount = 0;
        let textBlockCount = 0;
        let resultMessages: Array<{ subtype?: string; hasResult: boolean }> = [];
        const stream = provider.executeQuery(executeOptions);

        for await (const msg of stream) {
          messageCount++;

          // Check for abort during streaming
          if (abortController.signal.aborted) {
            throw new Error('Generation stopped');
          }

          if (msg.type === 'assistant' && msg.message?.content) {
            for (const block of msg.message.content) {
              if (block.type === 'text' && block.text) {
                textBlockCount++;
                docContent += block.text;
                // Emit real-time output for the UI
                this.emitDocsEvent('docs:doc-output', {
                  projectPath,
                  docType,
                  content: block.text,
                });
              } else if (block.type === 'tool_use') {
                // Emit tool call events for visibility
                this.emitDocsEvent('docs:doc-tool', {
                  projectPath,
                  docType,
                  tool: block.name,
                  input: block.input as Record<string, unknown>,
                });
              }
            }
          } else if (msg.type === 'result') {
            // Track result message details for debugging
            const resultInfo = {
              subtype: msg.subtype,
              hasResult: Boolean(msg.result),
            };
            resultMessages.push(resultInfo);

            // Use result content if available
            if (msg.subtype === 'success' && msg.result) {
              docContent = msg.result;
              receivedSuccessResult = true;
            } else {
              // Non-success result (error, cancelled, etc.)
              console.log(
                `[DocsService] Received non-success result for ${displayName}: ` +
                  `subtype=${msg.subtype}, hasResult=${Boolean(msg.result)}`
              );
            }
          }
        }

        // Log streaming summary for debugging
        console.log(
          `[DocsService] ${displayName} streaming complete: ` +
            `messages=${messageCount}, textBlocks=${textBlockCount}, ` +
            `results=${JSON.stringify(resultMessages)}`
        );

        // Log content statistics for debugging
        console.log(
          `[DocsService] ${displayName}: Content length=${docContent.length}, ` +
            `receivedSuccessResult=${receivedSuccessResult}`
        );

        // Validate content before writing - must contain a markdown heading
        // This ensures we don't save incomplete "Let me explore..." type content
        const hasMarkdownHeading = /^#{1,6}\s/m.test(docContent);
        if (!hasMarkdownHeading) {
          const preview = docContent.slice(0, 200).replace(/\n/g, ' ');
          throw new Error(
            `Generated content for ${displayName} is incomplete - no markdown heading found. ` +
              `Content length: ${docContent.length}. ` +
              `Content preview: "${preview}...". ` +
              `Received success result: ${receivedSuccessResult}`
          );
        }

        // Also check minimum content length - real documentation should be at least 500 chars
        if (docContent.length < 500) {
          throw new Error(
            `Generated content for ${displayName} is too short (${docContent.length} chars). ` +
              `Expected at least 500 characters for valid documentation.`
          );
        }

        // Clean transitional text and write the document to file
        const cleanedContent = cleanDocContent(docContent);
        const outputPath = path.join(docsDir, filename);
        await secureFs.writeFile(outputPath, cleanedContent);

        console.log(`[DocsService] Completed generation for ${displayName}, saved to ${filename}`);

        // Update manifest with this doc's status
        updateManifestDoc(manifest, docType, true);

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
          mode,
        });

        return true;
      } catch (error) {
        const errorInfo = classifyError(error);

        // Check if this was an abort/stop - don't retry
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

        // Check if this is a retryable error
        const errorMessage = (error as Error).message || '';
        const isTransientCLIError =
          (error as Error).name === 'ClaudeCLIError' ||
          errorMessage.includes('CLI returned a message');
        const isIncompleteContent =
          errorMessage.includes('is incomplete') || errorMessage.includes('is too short');

        // Retry transient CLI errors and incomplete content (could be rate limiting)
        if ((isTransientCLIError || isIncompleteContent) && attempt < maxRetries) {
          console.log(
            `[DocsService] Retryable error for ${displayName} (${isTransientCLIError ? 'CLI error' : 'incomplete content'}), ` +
              `will retry after delay (attempt ${attempt + 1}/${maxRetries + 1})...`
          );
          // Wait a bit before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }

        // Final failure - log and emit error
        console.error(`[DocsService] Generation failed for ${displayName}:`, error);

        // Update manifest with this doc's failure
        updateManifestDoc(manifest, docType, false);

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

    // Should not reach here, but handle just in case
    return false;
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
    // First, sync the manifest with files that exist on disk
    // This handles docs that were pulled from git but generated on another machine
    try {
      const syncResult = await syncManifestWithDisk(projectPath);
      if (syncResult.synced) {
        console.log(
          `[DocsService] Synced manifest with disk: found ${syncResult.foundDocs.length} existing doc(s)` +
            (syncResult.createdManifest ? ' (created new manifest)' : '')
        );
      }
    } catch (error) {
      console.error('[DocsService] Failed to sync manifest with disk:', error);
      // Continue anyway - the listing should still work
    }

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
      | 'docs:generation-completed'
      | 'docs:doc-output'
      | 'docs:doc-tool',
    payload: unknown
  ): void {
    // Cast to EventType since these types are defined in libs/types/src/event.ts
    // but may not be recognized if the types package hasn't been rebuilt
    this.events.emit(type as import('../lib/events.js').EventType, payload);
  }
}

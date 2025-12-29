'use strict';
/**
 * Documentation Service - AI-powered project documentation generation
 *
 * Manages:
 * - Parallel documentation generation using 6 Claude agents
 * - Real-time progress streaming via events
 * - Document storage in {projectPath}/docs/
 * - Generation cancellation support
 */
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create((typeof Iterator === 'function' ? Iterator : Object).prototype);
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var __asyncValues =
  (this && this.__asyncValues) ||
  function (o) {
    if (!Symbol.asyncIterator) throw new TypeError('Symbol.asyncIterator is not defined.');
    var m = o[Symbol.asyncIterator],
      i;
    return m
      ? m.call(o)
      : ((o = typeof __values === 'function' ? __values(o) : o[Symbol.iterator]()),
        (i = {}),
        verb('next'),
        verb('throw'),
        verb('return'),
        (i[Symbol.asyncIterator] = function () {
          return this;
        }),
        i);
    function verb(n) {
      i[n] =
        o[n] &&
        function (v) {
          return new Promise(function (resolve, reject) {
            ((v = o[n](v)), settle(resolve, reject, v.done, v.value));
          });
        };
    }
    function settle(resolve, reject, d, v) {
      Promise.resolve(v).then(function (v) {
        resolve({ value: v, done: d });
      }, reject);
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.DocsService = void 0;
var path_1 = require('path');
var model_resolver_1 = require('@automaker/model-resolver');
var utils_1 = require('@automaker/utils');
var provider_factory_js_1 = require('../providers/provider-factory.js');
var secureFs = require('../lib/secure-fs.js');
var docs_prompts_js_1 = require('./docs-prompts.js');
/**
 * Builds codebase context by analyzing the project directory structure.
 * This is a simple implementation that reads the directory tree and key files.
 */
function buildCodebaseContext(projectPath) {
  return __awaiter(this, void 0, void 0, function () {
    var contextParts,
      entries,
      dirs,
      files,
      pkgPath,
      pkgContent,
      pkg,
      _a,
      readmePath,
      readmeContent,
      _b,
      tsconfigPath,
      tsconfigContent,
      _c,
      frameworkIndicators,
      error_1;
    return __generator(this, function (_d) {
      switch (_d.label) {
        case 0:
          contextParts = [];
          _d.label = 1;
        case 1:
          _d.trys.push([1, 13, , 14]);
          return [4 /*yield*/, secureFs.readdir(projectPath, { withFileTypes: true })];
        case 2:
          entries = _d.sent();
          dirs = entries
            .filter(function (e) {
              return e.isDirectory();
            })
            .map(function (e) {
              return e.name;
            });
          files = entries
            .filter(function (e) {
              return e.isFile();
            })
            .map(function (e) {
              return e.name;
            });
          contextParts.push('## Project Root Structure\n');
          contextParts.push('### Directories:');
          contextParts.push(
            dirs
              .map(function (d) {
                return '- '.concat(d, '/');
              })
              .join('\n') || '(none)'
          );
          contextParts.push('\n### Files:');
          contextParts.push(
            files
              .map(function (f) {
                return '- '.concat(f);
              })
              .join('\n') || '(none)'
          );
          _d.label = 3;
        case 3:
          _d.trys.push([3, 5, , 6]);
          pkgPath = path_1.default.join(projectPath, 'package.json');
          return [4 /*yield*/, secureFs.readFile(pkgPath, 'utf-8')];
        case 4:
          pkgContent = _d.sent();
          pkg = JSON.parse(pkgContent);
          contextParts.push('\n## package.json Summary');
          if (pkg.name) contextParts.push('- **Name:** '.concat(pkg.name));
          if (pkg.description) contextParts.push('- **Description:** '.concat(pkg.description));
          if (pkg.version) contextParts.push('- **Version:** '.concat(pkg.version));
          if (pkg.dependencies) {
            contextParts.push('- **Dependencies:** ' + Object.keys(pkg.dependencies).join(', '));
          }
          if (pkg.devDependencies) {
            contextParts.push(
              '- **Dev Dependencies:** ' + Object.keys(pkg.devDependencies).join(', ')
            );
          }
          if (pkg.scripts) {
            contextParts.push('- **Scripts:** ' + Object.keys(pkg.scripts).join(', '));
          }
          return [3 /*break*/, 6];
        case 5:
          _a = _d.sent();
          return [3 /*break*/, 6];
        case 6:
          _d.trys.push([6, 8, , 9]);
          readmePath = path_1.default.join(projectPath, 'README.md');
          return [4 /*yield*/, secureFs.readFile(readmePath, 'utf-8')];
        case 7:
          readmeContent = _d.sent();
          contextParts.push('\n## README.md Content (truncated)');
          contextParts.push(readmeContent.substring(0, 3000));
          if (readmeContent.length > 3000) {
            contextParts.push('\n... (truncated)');
          }
          return [3 /*break*/, 9];
        case 8:
          _b = _d.sent();
          return [3 /*break*/, 9];
        case 9:
          _d.trys.push([9, 11, , 12]);
          tsconfigPath = path_1.default.join(projectPath, 'tsconfig.json');
          return [4 /*yield*/, secureFs.readFile(tsconfigPath, 'utf-8')];
        case 10:
          tsconfigContent = _d.sent();
          contextParts.push('\n## TypeScript Configuration');
          contextParts.push('Project uses TypeScript. tsconfig.json found.');
          return [3 /*break*/, 12];
        case 11:
          _c = _d.sent();
          return [3 /*break*/, 12];
        case 12:
          frameworkIndicators = [];
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
          return [3 /*break*/, 14];
        case 13:
          error_1 = _d.sent();
          contextParts.push('Unable to fully analyze project structure: ' + String(error_1));
          return [3 /*break*/, 14];
        case 14:
          return [2 /*return*/, contextParts.join('\n')];
      }
    });
  });
}
var DocsService = /** @class */ (function () {
  function DocsService(events) {
    this.runningGenerations = new Map();
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
  DocsService.prototype.generateDocs = function (projectPath, model) {
    return __awaiter(this, void 0, void 0, function () {
      var resolvedModel,
        abortController,
        startedAt,
        progress,
        _i,
        DOC_TYPES_1,
        docType,
        docsDir,
        error_2,
        projectName,
        codebaseContext,
        error_3;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            // Check if generation is already running for this project
            if (this.runningGenerations.has(projectPath)) {
              throw new Error('Documentation generation is already running for this project');
            }
            resolvedModel = (0, model_resolver_1.resolveModelString)(
              model,
              model_resolver_1.DEFAULT_MODELS.claude
            );
            abortController = new AbortController();
            startedAt = new Date().toISOString();
            progress = new Map();
            for (_i = 0, DOC_TYPES_1 = docs_prompts_js_1.DOC_TYPES; _i < DOC_TYPES_1.length; _i++) {
              docType = DOC_TYPES_1[_i];
              progress.set(docType.type, {
                docType: docType.type,
                displayName: docType.displayName,
                status: 'pending',
                filename: docType.filename,
              });
            }
            // Store running generation state
            this.runningGenerations.set(projectPath, {
              projectPath: projectPath,
              abortController: abortController,
              startedAt: startedAt,
              progress: progress,
            });
            // Emit generation started event
            this.emitDocsEvent('docs:generation-started', {
              projectPath: projectPath,
              startedAt: startedAt,
              docTypes: docs_prompts_js_1.DOC_TYPES.map(function (dt) {
                return {
                  type: dt.type,
                  displayName: dt.displayName,
                  filename: dt.filename,
                };
              }),
            });
            docsDir = path_1.default.join(projectPath, 'docs');
            _a.label = 1;
          case 1:
            _a.trys.push([1, 3, , 4]);
            return [4 /*yield*/, secureFs.mkdir(docsDir, { recursive: true })];
          case 2:
            _a.sent();
            return [3 /*break*/, 4];
          case 3:
            error_2 = _a.sent();
            console.error('[DocsService] Failed to create docs directory:', error_2);
            return [3 /*break*/, 4];
          case 4:
            projectName = path_1.default.basename(projectPath);
            _a.label = 5;
          case 5:
            _a.trys.push([5, 7, , 8]);
            return [4 /*yield*/, buildCodebaseContext(projectPath)];
          case 6:
            codebaseContext = _a.sent();
            return [3 /*break*/, 8];
          case 7:
            error_3 = _a.sent();
            console.error('[DocsService] Failed to build codebase context:', error_3);
            codebaseContext = 'Project: '.concat(projectName, '\nPath: ').concat(projectPath);
            return [3 /*break*/, 8];
          case 8:
            // Run all doc generations in parallel
            this.runParallelGeneration(
              projectPath,
              resolvedModel,
              codebaseContext,
              projectName,
              abortController,
              progress
            ).catch(function (error) {
              console.error('[DocsService] Parallel generation error:', error);
            });
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * Run documentation generations with limited concurrency to avoid overwhelming the CLI
   */
  DocsService.prototype.runParallelGeneration = function (
    projectPath,
    model,
    codebaseContext,
    projectName,
    abortController,
    progress
  ) {
    return __awaiter(this, void 0, void 0, function () {
      var docsDir,
        CONCURRENCY_LIMIT,
        results,
        i,
        batch,
        batchPromises,
        batchResults,
        generation,
        wasStopped,
        successCount,
        errorCount,
        _i,
        results_1,
        result;
      var _this = this;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            docsDir = path_1.default.join(projectPath, 'docs');
            CONCURRENCY_LIMIT = 2;
            results = [];
            i = 0;
            _a.label = 1;
          case 1:
            if (!(i < docs_prompts_js_1.DOC_TYPES.length)) return [3 /*break*/, 4];
            // Check if aborted before starting batch
            if (abortController.signal.aborted) {
              return [3 /*break*/, 4];
            }
            batch = docs_prompts_js_1.DOC_TYPES.slice(i, i + CONCURRENCY_LIMIT);
            batchPromises = batch.map(function (docTypeInfo) {
              return _this.generateSingleDoc(
                projectPath,
                docsDir,
                docTypeInfo,
                model,
                codebaseContext,
                projectName,
                abortController,
                progress
              );
            });
            return [4 /*yield*/, Promise.allSettled(batchPromises)];
          case 2:
            batchResults = _a.sent();
            results.push.apply(results, batchResults);
            _a.label = 3;
          case 3:
            i += CONCURRENCY_LIMIT;
            return [3 /*break*/, 1];
          case 4:
            generation = this.runningGenerations.get(projectPath);
            wasStopped = !generation || abortController.signal.aborted;
            successCount = 0;
            errorCount = 0;
            for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
              result = results_1[_i];
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
              projectPath: projectPath,
              completedAt: new Date().toISOString(),
              successCount: successCount,
              errorCount: errorCount,
              totalCount: docs_prompts_js_1.DOC_TYPES.length,
              wasStopped: wasStopped,
            });
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * Generate a single documentation file
   */
  DocsService.prototype.generateSingleDoc = function (
    projectPath,
    docsDir,
    docTypeInfo,
    model,
    codebaseContext,
    projectName,
    abortController,
    progress
  ) {
    return __awaiter(this, void 0, void 0, function () {
      var docType,
        displayName,
        filename,
        docProgress,
        provider,
        systemPrompt,
        userPrompt,
        executeOptions,
        docContent,
        stream,
        _a,
        stream_1,
        stream_1_1,
        msg,
        _i,
        _b,
        block,
        e_1_1,
        outputPath,
        error_4,
        errorInfo;
      var _c, e_1, _d, _e;
      var _f;
      return __generator(this, function (_g) {
        switch (_g.label) {
          case 0:
            ((docType = docTypeInfo.type),
              (displayName = docTypeInfo.displayName),
              (filename = docTypeInfo.filename));
            docProgress = progress.get(docType);
            if (docProgress) {
              docProgress.status = 'generating';
              docProgress.startedAt = new Date().toISOString();
            }
            this.emitDocsEvent('docs:doc-progress', {
              projectPath: projectPath,
              docType: docType,
              displayName: displayName,
              status: 'generating',
              filename: filename,
            });
            _g.label = 1;
          case 1:
            _g.trys.push([1, 15, , 16]);
            // Check if aborted before starting
            if (abortController.signal.aborted) {
              throw new Error('Generation stopped');
            }
            provider = provider_factory_js_1.ProviderFactory.getProviderForModel(model);
            systemPrompt = (0, docs_prompts_js_1.getDocSystemPrompt)(docType);
            userPrompt = (0, docs_prompts_js_1.buildDocUserPrompt)(
              docType,
              codebaseContext,
              projectName
            );
            executeOptions = {
              prompt: userPrompt,
              model: model,
              cwd: projectPath,
              systemPrompt: systemPrompt,
              maxTurns: 10,
              allowedTools: ['Read', 'Glob', 'Grep'],
              abortController: abortController,
            };
            console.log(
              '[DocsService] Starting generation for '
                .concat(displayName, ' (')
                .concat(docType, ')')
            );
            console.log('[DocsService] Using model: '.concat(model, ', cwd: ').concat(projectPath));
            console.log(
              '[DocsService] Prompt length: '
                .concat(userPrompt.length, ', System prompt length: ')
                .concat(systemPrompt.length)
            );
            docContent = '';
            stream = provider.executeQuery(executeOptions);
            _g.label = 2;
          case 2:
            _g.trys.push([2, 7, 8, 13]);
            ((_a = true), (stream_1 = __asyncValues(stream)));
            _g.label = 3;
          case 3:
            return [4 /*yield*/, stream_1.next()];
          case 4:
            if (!((stream_1_1 = _g.sent()), (_c = stream_1_1.done), !_c)) return [3 /*break*/, 6];
            _e = stream_1_1.value;
            _a = false;
            msg = _e;
            // Check for abort during streaming
            if (abortController.signal.aborted) {
              throw new Error('Generation stopped');
            }
            if (
              msg.type === 'assistant' &&
              ((_f = msg.message) === null || _f === void 0 ? void 0 : _f.content)
            ) {
              for (_i = 0, _b = msg.message.content; _i < _b.length; _i++) {
                block = _b[_i];
                if (block.type === 'text' && block.text) {
                  docContent += block.text;
                }
              }
            } else if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
              // Final result
              docContent = msg.result;
            }
            _g.label = 5;
          case 5:
            _a = true;
            return [3 /*break*/, 3];
          case 6:
            return [3 /*break*/, 13];
          case 7:
            e_1_1 = _g.sent();
            e_1 = { error: e_1_1 };
            return [3 /*break*/, 13];
          case 8:
            _g.trys.push([8, , 11, 12]);
            if (!(!_a && !_c && (_d = stream_1.return))) return [3 /*break*/, 10];
            return [4 /*yield*/, _d.call(stream_1)];
          case 9:
            _g.sent();
            _g.label = 10;
          case 10:
            return [3 /*break*/, 12];
          case 11:
            if (e_1) throw e_1.error;
            return [7 /*endfinally*/];
          case 12:
            return [7 /*endfinally*/];
          case 13:
            outputPath = path_1.default.join(docsDir, filename);
            return [4 /*yield*/, secureFs.writeFile(outputPath, docContent)];
          case 14:
            _g.sent();
            console.log(
              '[DocsService] Completed generation for '
                .concat(displayName, ', saved to ')
                .concat(filename)
            );
            // Update progress to completed
            if (docProgress) {
              docProgress.status = 'completed';
              docProgress.completedAt = new Date().toISOString();
            }
            this.emitDocsEvent('docs:doc-completed', {
              projectPath: projectPath,
              docType: docType,
              displayName: displayName,
              filename: filename,
              completedAt: new Date().toISOString(),
            });
            return [2 /*return*/, true];
          case 15:
            error_4 = _g.sent();
            errorInfo = (0, utils_1.classifyError)(error_4);
            // Check if this was an abort/stop
            if (errorInfo.isAbort || abortController.signal.aborted) {
              console.log('[DocsService] Generation stopped for '.concat(displayName));
              if (docProgress) {
                docProgress.status = 'stopped';
              }
              this.emitDocsEvent('docs:doc-error', {
                projectPath: projectPath,
                docType: docType,
                displayName: displayName,
                filename: filename,
                error: 'Generation stopped',
                stopped: true,
              });
              return [2 /*return*/, false];
            }
            console.error('[DocsService] Generation failed for '.concat(displayName, ':'), error_4);
            // Update progress to error
            if (docProgress) {
              docProgress.status = 'error';
              docProgress.error = errorInfo.message;
            }
            this.emitDocsEvent('docs:doc-error', {
              projectPath: projectPath,
              docType: docType,
              displayName: displayName,
              filename: filename,
              error: errorInfo.message,
              stopped: false,
            });
            return [2 /*return*/, false];
          case 16:
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * Stop all running documentation generation for a project
   *
   * @param projectPath - The project directory path
   * @returns true if generation was running and stopped, false otherwise
   */
  DocsService.prototype.stopGeneration = function (projectPath) {
    var generation = this.runningGenerations.get(projectPath);
    if (!generation) {
      return false;
    }
    console.log('[DocsService] Stopping documentation generation for '.concat(projectPath));
    // Abort all running agents
    generation.abortController.abort();
    // Don't remove from runningGenerations yet - the parallel generation will clean up
    return true;
  };
  /**
   * Get the content of a specific documentation file
   *
   * @param projectPath - The project directory path
   * @param docType - The documentation type to retrieve
   * @returns The document content or null if not found
   */
  DocsService.prototype.getDocContent = function (projectPath, docType) {
    return __awaiter(this, void 0, void 0, function () {
      var filename, docPath, content, _a;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            filename = (0, docs_prompts_js_1.getDocFilename)(docType);
            docPath = path_1.default.join(projectPath, 'docs', filename);
            _b.label = 1;
          case 1:
            _b.trys.push([1, 3, , 4]);
            return [4 /*yield*/, secureFs.readFile(docPath, 'utf-8')];
          case 2:
            content = _b.sent();
            return [2 /*return*/, content];
          case 3:
            _a = _b.sent();
            return [2 /*return*/, null];
          case 4:
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * List all available documentation for a project
   *
   * @param projectPath - The project directory path
   * @returns Array of document info objects
   */
  DocsService.prototype.listDocs = function (projectPath) {
    return __awaiter(this, void 0, void 0, function () {
      var docsDir, docs, _i, DOC_TYPES_2, docTypeInfo, docPath, exists, modifiedAt, stats, _a;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            docsDir = path_1.default.join(projectPath, 'docs');
            docs = [];
            ((_i = 0), (DOC_TYPES_2 = docs_prompts_js_1.DOC_TYPES));
            _b.label = 1;
          case 1:
            if (!(_i < DOC_TYPES_2.length)) return [3 /*break*/, 7];
            docTypeInfo = DOC_TYPES_2[_i];
            docPath = path_1.default.join(docsDir, docTypeInfo.filename);
            exists = false;
            modifiedAt = void 0;
            _b.label = 2;
          case 2:
            _b.trys.push([2, 4, , 5]);
            return [4 /*yield*/, secureFs.stat(docPath)];
          case 3:
            stats = _b.sent();
            exists = true;
            modifiedAt = stats.mtime.toISOString();
            return [3 /*break*/, 5];
          case 4:
            _a = _b.sent();
            return [3 /*break*/, 5];
          case 5:
            docs.push({
              docType: docTypeInfo.type,
              displayName: docTypeInfo.displayName,
              filename: docTypeInfo.filename,
              description: docTypeInfo.description,
              exists: exists,
              modifiedAt: modifiedAt,
            });
            _b.label = 6;
          case 6:
            _i++;
            return [3 /*break*/, 1];
          case 7:
            return [2 /*return*/, docs];
        }
      });
    });
  };
  /**
   * Get the current generation status for a project
   *
   * @param projectPath - The project directory path
   * @returns Current generation status
   */
  DocsService.prototype.getStatus = function (projectPath) {
    var generation = this.runningGenerations.get(projectPath);
    if (!generation) {
      // Not generating - return empty status
      return {
        isGenerating: false,
        projectPath: null,
        startedAt: null,
        progress: [],
        completedCount: 0,
        totalCount: docs_prompts_js_1.DOC_TYPES.length,
      };
    }
    // Convert progress map to array
    var progressArray = Array.from(generation.progress.values());
    var completedCount = progressArray.filter(function (p) {
      return p.status === 'completed' || p.status === 'error' || p.status === 'stopped';
    }).length;
    return {
      isGenerating: true,
      projectPath: generation.projectPath,
      startedAt: generation.startedAt,
      progress: progressArray,
      completedCount: completedCount,
      totalCount: docs_prompts_js_1.DOC_TYPES.length,
    };
  };
  /**
   * Emit a documentation event
   */
  DocsService.prototype.emitDocsEvent = function (type, payload) {
    // Cast to EventType since these types are defined in libs/types/src/event.ts
    // but may not be recognized if the types package hasn't been rebuilt
    this.events.emit(type, payload);
  };
  return DocsService;
})();
exports.DocsService = DocsService;

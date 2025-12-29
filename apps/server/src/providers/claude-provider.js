'use strict';
/**
 * Claude Provider - Executes queries using Claude Agent SDK
 *
 * Wraps @anthropic-ai/claude-agent-sdk for seamless integration
 * with the provider architecture.
 */
var __extends =
  (this && this.__extends) ||
  (function () {
    var extendStatics = function (d, b) {
      extendStatics =
        Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array &&
          function (d, b) {
            d.__proto__ = b;
          }) ||
        function (d, b) {
          for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
      return extendStatics(d, b);
    };
    return function (d, b) {
      if (typeof b !== 'function' && b !== null)
        throw new TypeError('Class extends value ' + String(b) + ' is not a constructor or null');
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
    };
  })();
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
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
var __await =
  (this && this.__await) ||
  function (v) {
    return this instanceof __await ? ((this.v = v), this) : new __await(v);
  };
var __asyncGenerator =
  (this && this.__asyncGenerator) ||
  function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError('Symbol.asyncIterator is not defined.');
    var g = generator.apply(thisArg, _arguments || []),
      i,
      q = [];
    return (
      (i = Object.create((typeof AsyncIterator === 'function' ? AsyncIterator : Object).prototype)),
      verb('next'),
      verb('throw'),
      verb('return', awaitReturn),
      (i[Symbol.asyncIterator] = function () {
        return this;
      }),
      i
    );
    function awaitReturn(f) {
      return function (v) {
        return Promise.resolve(v).then(f, reject);
      };
    }
    function verb(n, f) {
      if (g[n]) {
        i[n] = function (v) {
          return new Promise(function (a, b) {
            q.push([n, v, a, b]) > 1 || resume(n, v);
          });
        };
        if (f) i[n] = f(i[n]);
      }
    }
    function resume(n, v) {
      try {
        step(g[n](v));
      } catch (e) {
        settle(q[0][3], e);
      }
    }
    function step(r) {
      r.value instanceof __await
        ? Promise.resolve(r.value.v).then(fulfill, reject)
        : settle(q[0][2], r);
    }
    function fulfill(value) {
      resume('next', value);
    }
    function reject(value) {
      resume('throw', value);
    }
    function settle(f, v) {
      if ((f(v), q.shift(), q.length)) resume(q[0][0], q[0][1]);
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
exports.ClaudeProvider = void 0;
var claude_agent_sdk_1 = require('@anthropic-ai/claude-agent-sdk');
var base_provider_js_1 = require('./base-provider.js');
var ClaudeProvider = /** @class */ (function (_super) {
  __extends(ClaudeProvider, _super);
  function ClaudeProvider() {
    return (_super !== null && _super.apply(this, arguments)) || this;
  }
  ClaudeProvider.prototype.getName = function () {
    return 'claude';
  };
  /**
   * Execute a query using Claude Agent SDK
   */
  ClaudeProvider.prototype.executeQuery = function (options) {
    return __asyncGenerator(this, arguments, function executeQuery_1() {
      var prompt,
        model,
        cwd,
        systemPrompt,
        _a,
        maxTurns,
        allowedTools,
        mcpServers,
        abortController,
        conversationHistory,
        sdkSessionId,
        providerConfig,
        defaultTools,
        toolsToUse,
        serverNames,
        sdkOptions,
        promptPayload,
        stream,
        _b,
        stream_1,
        stream_1_1,
        msg,
        e_1_1,
        error_1,
        match,
        snippet,
        helpfulError;
      var _c, e_1, _d, _e;
      return __generator(this, function (_f) {
        switch (_f.label) {
          case 0:
            ((prompt = options.prompt),
              (model = options.model),
              (cwd = options.cwd),
              (systemPrompt = options.systemPrompt),
              (_a = options.maxTurns),
              (maxTurns = _a === void 0 ? 20 : _a),
              (allowedTools = options.allowedTools),
              (mcpServers = options.mcpServers),
              (abortController = options.abortController),
              (conversationHistory = options.conversationHistory),
              (sdkSessionId = options.sdkSessionId),
              (providerConfig = options.providerConfig));
            defaultTools = [
              'Read',
              'Write',
              'Edit',
              'Glob',
              'Grep',
              'Bash',
              'WebSearch',
              'WebFetch',
            ];
            toolsToUse = allowedTools || defaultTools;
            // Log MCP server configuration if present
            if (mcpServers && Object.keys(mcpServers).length > 0) {
              serverNames = Object.keys(mcpServers);
              console.log(
                '[ClaudeProvider] Loading MCP servers: ['.concat(serverNames.join(', '), ']')
              );
            } else {
              console.log('[ClaudeProvider] No MCP servers configured for this query');
            }
            sdkOptions = __assign(
              __assign(
                __assign(
                  __assign(
                    {
                      model: model,
                      systemPrompt: systemPrompt,
                      maxTurns: maxTurns,
                      cwd: cwd,
                      allowedTools: toolsToUse,
                      permissionMode: 'acceptEdits',
                      sandbox: {
                        enabled: true,
                        autoAllowBashIfSandboxed: true,
                      },
                      abortController: abortController,
                    },
                    sdkSessionId && conversationHistory && conversationHistory.length > 0
                      ? { resume: sdkSessionId }
                      : {}
                  ),
                  options.settingSources && { settingSources: options.settingSources }
                ),
                (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.env)
                  ? { env: providerConfig.env }
                  : {}
              ),
              mcpServers && Object.keys(mcpServers).length > 0 ? { mcpServers: mcpServers } : {}
            );
            if (Array.isArray(prompt)) {
              // Multi-part prompt (with images)
              promptPayload = (function () {
                return __asyncGenerator(this, arguments, function () {
                  var multiPartPrompt;
                  return __generator(this, function (_a) {
                    switch (_a.label) {
                      case 0:
                        multiPartPrompt = {
                          type: 'user',
                          session_id: '',
                          message: {
                            role: 'user',
                            content: prompt,
                          },
                          parent_tool_use_id: null,
                        };
                        return [4 /*yield*/, __await(multiPartPrompt)];
                      case 1:
                        return [4 /*yield*/, _a.sent()];
                      case 2:
                        _a.sent();
                        return [2 /*return*/];
                    }
                  });
                });
              })();
            } else {
              // Simple text prompt
              promptPayload = prompt;
            }
            _f.label = 1;
          case 1:
            _f.trys.push([1, 16, , 17]);
            stream = (0, claude_agent_sdk_1.query)({ prompt: promptPayload, options: sdkOptions });
            _f.label = 2;
          case 2:
            _f.trys.push([2, 9, 10, 15]);
            ((_b = true), (stream_1 = __asyncValues(stream)));
            _f.label = 3;
          case 3:
            return [4 /*yield*/, __await(stream_1.next())];
          case 4:
            if (!((stream_1_1 = _f.sent()), (_c = stream_1_1.done), !_c)) return [3 /*break*/, 8];
            _e = stream_1_1.value;
            _b = false;
            msg = _e;
            return [4 /*yield*/, __await(msg)];
          case 5:
            return [4 /*yield*/, _f.sent()];
          case 6:
            _f.sent();
            _f.label = 7;
          case 7:
            _b = true;
            return [3 /*break*/, 3];
          case 8:
            return [3 /*break*/, 15];
          case 9:
            e_1_1 = _f.sent();
            e_1 = { error: e_1_1 };
            return [3 /*break*/, 15];
          case 10:
            _f.trys.push([10, , 13, 14]);
            if (!(!_b && !_c && (_d = stream_1.return))) return [3 /*break*/, 12];
            return [4 /*yield*/, __await(_d.call(stream_1))];
          case 11:
            _f.sent();
            _f.label = 12;
          case 12:
            return [3 /*break*/, 14];
          case 13:
            if (e_1) throw e_1.error;
            return [7 /*endfinally*/];
          case 14:
            return [7 /*endfinally*/];
          case 15:
            return [3 /*break*/, 17];
          case 16:
            error_1 = _f.sent();
            // Check if this is a JSON parse error from the SDK receiving plain text from CLI
            if (error_1 instanceof SyntaxError && error_1.message.includes('JSON')) {
              match = error_1.message.match(/"([^"]+)"/);
              snippet = match ? match[1] : 'unknown';
              // Common CLI error patterns
              if (snippet.toLowerCase().startsWith('claude')) {
                console.error(
                  '[ClaudeProvider] Claude CLI returned plain text instead of JSON. ' +
                    'This usually indicates an authentication, billing, or configuration issue.'
                );
                console.error(
                  '[ClaudeProvider] CLI output started with: "'.concat(snippet, '..."')
                );
                helpfulError = new Error(
                  'Claude CLI error: The CLI returned a message instead of executing the query. ' +
                    'This may indicate an authentication issue, insufficient credits, or rate limiting. ' +
                    "Please verify your Claude authentication by running 'claude login' in your terminal. " +
                    'Original error snippet: "'.concat(snippet, '..."')
                );
                helpfulError.name = 'ClaudeCLIError';
                throw helpfulError;
              }
            }
            console.error('[ClaudeProvider] executeQuery() error during execution:', error_1);
            throw error_1;
          case 17:
            return [2 /*return*/];
        }
      });
    });
  };
  /**
   * Detect Claude SDK installation (always available via npm)
   */
  ClaudeProvider.prototype.detectInstallation = function () {
    return __awaiter(this, void 0, void 0, function () {
      var hasApiKey, status;
      return __generator(this, function (_a) {
        hasApiKey = !!process.env.ANTHROPIC_API_KEY;
        status = {
          installed: true,
          method: 'sdk',
          hasApiKey: hasApiKey,
          authenticated: hasApiKey,
        };
        return [2 /*return*/, status];
      });
    });
  };
  /**
   * Get available Claude models
   */
  ClaudeProvider.prototype.getAvailableModels = function () {
    var models = [
      {
        id: 'claude-opus-4-5-20251101',
        name: 'Claude Opus 4.5',
        modelString: 'claude-opus-4-5-20251101',
        provider: 'anthropic',
        description: 'Most capable Claude model',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
        default: true,
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        modelString: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        description: 'Balanced performance and cost',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        modelString: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        description: 'Fast and capable',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
      {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        modelString: 'claude-haiku-4-5-20251001',
        provider: 'anthropic',
        description: 'Fastest Claude model',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: 'basic',
      },
      {
        id: 'GLM-4.7',
        name: 'GLM 4.7',
        modelString: 'GLM-4.7',
        provider: 'zai',
        description: 'GLM Coding Plan model via Z.AI endpoint',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium',
      },
    ];
    return models;
  };
  /**
   * Check if the provider supports a specific feature
   */
  ClaudeProvider.prototype.supportsFeature = function (feature) {
    var supportedFeatures = ['tools', 'text', 'vision', 'thinking'];
    return supportedFeatures.includes(feature);
  };
  return ClaudeProvider;
})(base_provider_js_1.BaseProvider);
exports.ClaudeProvider = ClaudeProvider;

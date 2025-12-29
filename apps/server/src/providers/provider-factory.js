'use strict';
/**
 * Provider Factory - Routes model IDs to appropriate provider
 *
 * This factory implements model-based routing to automatically select
 * correct provider based on model string. This makes adding
 * new providers (Cursor, OpenCode, etc.) trivial - just add one line.
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.ProviderFactory = void 0;
var claude_provider_js_1 = require('./claude-provider.js');
var ProviderFactory = /** @class */ (function () {
  function ProviderFactory() {}
  /**
   * Get appropriate provider for a given model ID
   *
   * @param modelId Model identifier (e.g., "claude-opus-4-5-20251101", "gpt-5.2", "cursor-fast")
   * @returns Provider instance for model
   */
  ProviderFactory.getProviderForModel = function (modelId) {
    var lowerModel = modelId.toLowerCase();
    // Claude models (claude-*, opus, sonnet, haiku)
    if (lowerModel.startsWith('claude-') || ['haiku', 'sonnet', 'opus'].includes(lowerModel)) {
      return new claude_provider_js_1.ClaudeProvider();
    }
    // GLM models (glm-*) - use ClaudeProvider with custom env injection
    if (lowerModel.startsWith('glm-')) {
      return new claude_provider_js_1.ClaudeProvider();
    }
    // Future providers:
    // if (lowerModel.startsWith("cursor-")) {
    //   return new CursorProvider();
    // }
    // if (lowerModel.startsWith("opencode-")) {
    //   return new OpenCodeProvider();
    // }
    // Default to Claude for unknown models
    console.warn(
      '[ProviderFactory] Unknown model prefix for "'.concat(modelId, '", defaulting to Claude')
    );
    return new claude_provider_js_1.ClaudeProvider();
  };
  /**
   * Get all available providers
   */
  ProviderFactory.getAllProviders = function () {
    return [
      new claude_provider_js_1.ClaudeProvider(),
      // Future providers...
    ];
  };
  /**
   * Check installation status for all providers
   *
   * @returns Map of provider name to installation status
   */
  ProviderFactory.checkAllProviders = function () {
    return __awaiter(this, void 0, void 0, function () {
      var providers, statuses, _i, providers_1, provider, name_1, status_1;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            providers = this.getAllProviders();
            statuses = {};
            ((_i = 0), (providers_1 = providers));
            _a.label = 1;
          case 1:
            if (!(_i < providers_1.length)) return [3 /*break*/, 4];
            provider = providers_1[_i];
            name_1 = provider.getName();
            return [4 /*yield*/, provider.detectInstallation()];
          case 2:
            status_1 = _a.sent();
            statuses[name_1] = status_1;
            _a.label = 3;
          case 3:
            _i++;
            return [3 /*break*/, 1];
          case 4:
            return [2 /*return*/, statuses];
        }
      });
    });
  };
  /**
   * Get provider by name (for direct access if needed)
   *
   * @param name Provider name (e.g., "claude", "cursor")
   * @returns Provider instance or null if not found
   */
  ProviderFactory.getProviderByName = function (name) {
    var lowerName = name.toLowerCase();
    switch (lowerName) {
      case 'claude':
      case 'anthropic':
        return new claude_provider_js_1.ClaudeProvider();
      // Future providers:
      // case "cursor":
      //   return new CursorProvider();
      // case "opencode":
      //   return new OpenCodeProvider();
      default:
        return null;
    }
  };
  /**
   * Get all available models from all providers
   */
  ProviderFactory.getAllAvailableModels = function () {
    var providers = this.getAllProviders();
    var allModels = [];
    for (var _i = 0, providers_2 = providers; _i < providers_2.length; _i++) {
      var provider = providers_2[_i];
      var models = provider.getAvailableModels();
      allModels.push.apply(allModels, models);
    }
    return allModels;
  };
  return ProviderFactory;
})();
exports.ProviderFactory = ProviderFactory;

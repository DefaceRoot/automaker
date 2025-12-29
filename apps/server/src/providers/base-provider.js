'use strict';
/**
 * Abstract base class for AI model providers
 */
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.BaseProvider = void 0;
/**
 * Base provider class that all provider implementations must extend
 */
var BaseProvider = /** @class */ (function () {
  function BaseProvider(config) {
    if (config === void 0) {
      config = {};
    }
    this.config = config;
    this.name = this.getName();
  }
  /**
   * Validate the provider configuration
   * @returns Validation result
   */
  BaseProvider.prototype.validateConfig = function () {
    var errors = [];
    var warnings = [];
    // Base validation (can be overridden)
    if (!this.config) {
      errors.push('Provider config is missing');
    }
    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
    };
  };
  /**
   * Check if the provider supports a specific feature
   * @param feature Feature name (e.g., "vision", "tools", "mcp")
   * @returns Whether the feature is supported
   */
  BaseProvider.prototype.supportsFeature = function (feature) {
    // Default implementation - override in subclasses
    var commonFeatures = ['tools', 'text'];
    return commonFeatures.includes(feature);
  };
  /**
   * Get provider configuration
   */
  BaseProvider.prototype.getConfig = function () {
    return this.config;
  };
  /**
   * Update provider configuration
   */
  BaseProvider.prototype.setConfig = function (config) {
    this.config = __assign(__assign({}, this.config), config);
  };
  return BaseProvider;
})();
exports.BaseProvider = BaseProvider;

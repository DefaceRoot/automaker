'use strict';
/**
 * Re-export secure file system utilities from @automaker/platform
 * This file exists for backward compatibility with existing imports
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.getActiveOperations =
  exports.getPendingOperations =
  exports.getThrottlingConfig =
  exports.configureThrottling =
  exports.resolvePath =
  exports.joinPath =
  exports.lstat =
  exports.rename =
  exports.appendFile =
  exports.copyFile =
  exports.unlink =
  exports.rm =
  exports.stat =
  exports.readdir =
  exports.mkdir =
  exports.writeFile =
  exports.readFile =
  exports.access =
    void 0;
var platform_1 = require('@automaker/platform');
((exports.access = platform_1.secureFs.access),
  (exports.readFile = platform_1.secureFs.readFile),
  (exports.writeFile = platform_1.secureFs.writeFile),
  (exports.mkdir = platform_1.secureFs.mkdir),
  (exports.readdir = platform_1.secureFs.readdir),
  (exports.stat = platform_1.secureFs.stat),
  (exports.rm = platform_1.secureFs.rm),
  (exports.unlink = platform_1.secureFs.unlink),
  (exports.copyFile = platform_1.secureFs.copyFile),
  (exports.appendFile = platform_1.secureFs.appendFile),
  (exports.rename = platform_1.secureFs.rename),
  (exports.lstat = platform_1.secureFs.lstat),
  (exports.joinPath = platform_1.secureFs.joinPath),
  (exports.resolvePath = platform_1.secureFs.resolvePath),
  // Throttling configuration and monitoring
  (exports.configureThrottling = platform_1.secureFs.configureThrottling),
  (exports.getThrottlingConfig = platform_1.secureFs.getThrottlingConfig),
  (exports.getPendingOperations = platform_1.secureFs.getPendingOperations),
  (exports.getActiveOperations = platform_1.secureFs.getActiveOperations));

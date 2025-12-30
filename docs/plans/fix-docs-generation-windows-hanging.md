# Fix Documentation Generation Hanging/Crashing on Windows

**Created**: 2024-12-30  
**Status**: Ready for Implementation  
**Priority**: High

## Problem Summary

### Primary Issue: Windows ConPTY Failure

When documentation generation runs, it spawns 6 parallel Claude SDK processes. On Windows, this causes `AttachConsole` failures:

```
Error: AttachConsole failed
    at Object.<anonymous> (node_modules\node-pty\src\conpty_console_list_agent.ts:13:28)
```

The Claude Agent SDK uses `node-pty` which relies on Windows ConPTY. ConPTY has limitations with multiple simultaneous console attachments, causing processes to exit with code 1.

### Secondary Issue: No Idle Timeout

The SDK streaming loop has no timeout mechanism:

```typescript
// In ClaudeProvider.executeQuery()
for await (const msg of stream) {
  yield msg as ProviderMessage;
}
```

If the stream stalls (network issues, API delays, context compaction), the generation hangs indefinitely.

## Root Cause Analysis

1. **6 parallel agents** spawn via `DocsService.runParallelGeneration()`
2. Each agent uses **ClaudeProvider** -> `@anthropic-ai/claude-agent-sdk` -> `node-pty`
3. On Windows, **ConPTY** fails when multiple processes call `AttachConsole()` simultaneously
4. The **500ms stagger delay** is insufficient to prevent concurrent ConPTY access

## Solution Architecture

```
+-------------------------------------------------------------------+
|                        DocsService                                 |
|  +---------------------------------------------------------------+ |
|  |  runParallelGeneration()                                      | |
|  |  +----------------------------------------------------------+ | |
|  |  |  ConcurrencyLimiter (platform-aware)                     | | |
|  |  |  - Windows: max 2 concurrent                             | | |
|  |  |  - macOS/Linux: max 6 concurrent                         | | |
|  |  +----------------------------------------------------------+ | |
|  +---------------------------------------------------------------+ |
+-------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------+
|                      ClaudeProvider                                |
|  +---------------------------------------------------------------+ |
|  |  executeQuery() with StreamIdleTimeout wrapper                | |
|  |  - 2 minute idle timeout                                      | |
|  |  - Throws TimeoutError if no activity                         | |
|  +---------------------------------------------------------------+ |
+-------------------------------------------------------------------+
```

---

## Implementation Tasks

### Task 1: Create Concurrency Limiter Utility

**File**: `libs/utils/src/concurrency-limiter.ts` (NEW)

Create a platform-aware concurrency limiter using a semaphore pattern:

```typescript
/**
 * Platform-aware concurrency limiter using a semaphore pattern.
 * Limits concurrent async operations to prevent resource exhaustion.
 */
export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  /**
   * Run an async function with concurrency limiting.
   * Will queue if at capacity.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }

  /**
   * Get current number of running operations
   */
  get currentRunning(): number {
    return this.running;
  }

  /**
   * Get number of operations waiting in queue
   */
  get queueLength(): number {
    return this.queue.length;
  }
}

/**
 * Get platform-appropriate concurrency limit for Claude SDK processes.
 * Windows has ConPTY limitations that require lower concurrency.
 */
export function getPlatformConcurrencyLimit(): number {
  const isWindows = process.platform === 'win32';
  // Windows ConPTY has issues with multiple simultaneous console attachments
  // Limit to 2 to prevent AttachConsole failures
  return isWindows ? 2 : 6;
}
```

---

### Task 2: Create Stream Idle Timeout Utility

**File**: `libs/utils/src/stream-timeout.ts` (NEW)

Create a utility to wrap async iterables with an idle timeout:

```typescript
/**
 * Error thrown when a stream is idle for too long
 */
export class StreamIdleTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamIdleTimeoutError';
  }
}

/**
 * Wraps an async iterable with an idle timeout.
 * Throws StreamIdleTimeoutError if no messages received within the timeout period.
 *
 * @param stream - The async iterable to wrap
 * @param timeoutMs - Timeout in milliseconds between messages
 * @param onTimeout - Optional callback when timeout is about to trigger
 */
export async function* withIdleTimeout<T>(
  stream: AsyncIterable<T>,
  timeoutMs: number,
  onTimeout?: () => void
): AsyncGenerator<T> {
  const iterator = stream[Symbol.asyncIterator]();

  while (true) {
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout?.();
        reject(new StreamIdleTimeoutError(`Stream idle for ${timeoutMs}ms - no activity detected`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([iterator.next(), timeoutPromise]);

      if (timer) clearTimeout(timer);

      if (result.done) break;
      yield result.value;
    } catch (error) {
      if (timer) clearTimeout(timer);
      throw error;
    }
  }
}

/**
 * Check if an error is a StreamIdleTimeoutError
 */
export function isStreamIdleTimeoutError(error: unknown): error is StreamIdleTimeoutError {
  return error instanceof StreamIdleTimeoutError;
}
```

---

### Task 3: Export New Utilities from @automaker/utils

**File**: `libs/utils/src/index.ts` (MODIFY)

Add exports for the new utilities at the end of the file:

```typescript
// Concurrency limiting
export { ConcurrencyLimiter, getPlatformConcurrencyLimit } from './concurrency-limiter.js';

// Stream timeout
export {
  withIdleTimeout,
  StreamIdleTimeoutError,
  isStreamIdleTimeoutError,
} from './stream-timeout.js';
```

---

### Task 4: Update DocsService for Platform-Aware Concurrency

**File**: `apps/server/src/services/docs-service.ts` (MODIFY)

#### 4.1 Add Imports

Add to the existing imports at the top of the file:

```typescript
import { ConcurrencyLimiter, getPlatformConcurrencyLimit } from '@automaker/utils';
```

#### 4.2 Add ConPTY Error Detection Helper

Add this helper function near the top of the file (after imports, before the class):

```typescript
/**
 * Check if an error is a Windows ConPTY-related error
 */
function isConPTYError(error: unknown): boolean {
  const message = (error as Error)?.message || '';
  return (
    message.includes('AttachConsole') ||
    message.includes('ConPTY') ||
    message.includes('conpty') ||
    // Process exit code 1 on Windows is often ConPTY related
    (message.includes('exited with code 1') && process.platform === 'win32')
  );
}
```

#### 4.3 Modify `runParallelGeneration()` Method

Replace the current stagger-based approach (around lines 385-420) with proper concurrency control:

**FIND THIS CODE:**

```typescript
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
```

**REPLACE WITH:**

```typescript
// Use platform-aware concurrency limiting
// Windows ConPTY has issues with multiple simultaneous console attachments
const maxConcurrent = getPlatformConcurrencyLimit();
const limiter = new ConcurrencyLimiter(maxConcurrent);

console.log(
  `[DocsService] Starting parallel generation with concurrency limit: ${maxConcurrent} ` +
    `(platform: ${process.platform})`
);

// Run all doc generations with concurrency limiting
const allPromises = DOC_TYPES.map((docTypeInfo) =>
  limiter.run(async () => {
    try {
      return await this.generateSingleDoc(
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
    } catch (error) {
      console.error(`[DocsService] Unexpected error generating ${docTypeInfo.displayName}:`, error);
      return false;
    }
  })
);
```

#### 4.4 Update Retry Logic in `generateSingleDoc()` Method

In the `generateSingleDoc()` method, around line 700-714, find the retry logic section and update it to include ConPTY error handling:

**FIND THIS CODE:**

```typescript
// Check if this is a retryable error
const errorMessage = (error as Error).message || '';
const isTransientCLIError =
  (error as Error).name === 'ClaudeCLIError' || errorMessage.includes('CLI returned a message');
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
```

**REPLACE WITH:**

```typescript
// Check if this is a retryable error
const errorMessage = (error as Error).message || '';
const isTransientCLIError =
  (error as Error).name === 'ClaudeCLIError' || errorMessage.includes('CLI returned a message');
const isIncompleteContent =
  errorMessage.includes('is incomplete') || errorMessage.includes('is too short');
const isConPTY = isConPTYError(error);

// Retry transient CLI errors, incomplete content, and ConPTY errors
if ((isTransientCLIError || isIncompleteContent || isConPTY) && attempt < maxRetries) {
  const errorType = isConPTY
    ? 'ConPTY error'
    : isTransientCLIError
      ? 'CLI error'
      : 'incomplete content';
  // Use longer delay for ConPTY errors to let Windows resources settle
  const delayMs = isConPTY ? 5000 * (attempt + 1) : 2000 * (attempt + 1);
  console.log(
    `[DocsService] Retryable error for ${displayName} (${errorType}), ` +
      `will retry after ${delayMs}ms delay (attempt ${attempt + 1}/${maxRetries + 1})...`
  );
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  continue;
}
```

---

### Task 5: Update ClaudeProvider with Idle Timeout

**File**: `apps/server/src/providers/claude-provider.ts` (MODIFY)

#### 5.1 Add Imports

Add to the existing imports at the top of the file:

```typescript
import {
  withIdleTimeout,
  StreamIdleTimeoutError,
  isStreamIdleTimeoutError,
} from '@automaker/utils';
```

#### 5.2 Add Timeout Constant

Add this constant near the top of the file, after imports:

```typescript
/** Idle timeout for SDK streaming - if no messages for this duration, consider it stalled */
const STREAM_IDLE_TIMEOUT_MS = 120000; // 2 minutes
```

#### 5.3 Update `executeQuery()` Method

**FIND THIS CODE (around lines 117-123):**

```typescript
// Execute via Claude Agent SDK
try {
  const stream = query({ prompt: promptPayload, options: sdkOptions });

  // Stream messages directly - they're already in the correct format
  for await (const msg of stream) {
    yield msg as ProviderMessage;
  }
} catch (error) {
```

**REPLACE WITH:**

```typescript
// Execute via Claude Agent SDK
try {
  const stream = query({ prompt: promptPayload, options: sdkOptions });

  // Wrap stream with idle timeout to prevent indefinite hangs
  // This is especially important on Windows where ConPTY issues can cause stalls
  const timedStream = withIdleTimeout(
    stream as AsyncIterable<unknown>,
    STREAM_IDLE_TIMEOUT_MS,
    () => console.warn('[ClaudeProvider] Stream approaching idle timeout - no activity for 2 minutes')
  );

  // Stream messages directly - they're already in the correct format
  for await (const msg of timedStream) {
    yield msg as ProviderMessage;
  }
} catch (error) {
  // Handle idle timeout errors with a user-friendly message
  if (isStreamIdleTimeoutError(error)) {
    console.error('[ClaudeProvider] Stream timed out due to inactivity');
    const timeoutError = new Error(
      'Claude query timed out - no response received for 2 minutes. ' +
        'The model may be overloaded or experiencing issues. Please try again.'
    );
    timeoutError.name = 'StreamTimeoutError';
    throw timeoutError;
  }
```

---

### Task 6: Add Unit Tests

#### 6.1 Test for Concurrency Limiter

**File**: `libs/utils/tests/concurrency-limiter.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter, getPlatformConcurrencyLimit } from '../src/concurrency-limiter.js';

describe('ConcurrencyLimiter', () => {
  it('should limit concurrent executions', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const running: number[] = [];
    const maxConcurrent: number[] = [];

    const tasks = Array.from({ length: 5 }, (_, i) =>
      limiter.run(async () => {
        running.push(i);
        maxConcurrent.push(running.length);
        await new Promise((resolve) => setTimeout(resolve, 50));
        running.splice(running.indexOf(i), 1);
        return i;
      })
    );

    const results = await Promise.all(tasks);

    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(Math.max(...maxConcurrent)).toBeLessThanOrEqual(2);
  });

  it('should handle errors without blocking queue', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const results: (string | Error)[] = [];

    const task1 = limiter
      .run(async () => {
        throw new Error('Task 1 failed');
      })
      .catch((e) => e);

    const task2 = limiter.run(async () => {
      return 'Task 2 succeeded';
    });

    results.push(await task1);
    results.push(await task2);

    expect(results[0]).toBeInstanceOf(Error);
    expect(results[1]).toBe('Task 2 succeeded');
  });

  it('should report current running and queue length', async () => {
    const limiter = new ConcurrencyLimiter(1);

    expect(limiter.currentRunning).toBe(0);
    expect(limiter.queueLength).toBe(0);

    const task1 = limiter.run(() => new Promise((resolve) => setTimeout(resolve, 100)));

    // Give time for task to start
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(limiter.currentRunning).toBe(1);

    const task2 = limiter.run(() => new Promise((resolve) => setTimeout(resolve, 100)));

    // Give time for task2 to queue
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(limiter.queueLength).toBe(1);

    await Promise.all([task1, task2]);
  });
});

describe('getPlatformConcurrencyLimit', () => {
  it('should return a number', () => {
    const limit = getPlatformConcurrencyLimit();
    expect(typeof limit).toBe('number');
    expect(limit).toBeGreaterThan(0);
  });
});
```

#### 6.2 Test for Stream Timeout

**File**: `libs/utils/tests/stream-timeout.test.ts` (NEW)

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  withIdleTimeout,
  StreamIdleTimeoutError,
  isStreamIdleTimeoutError,
} from '../src/stream-timeout.js';

describe('withIdleTimeout', () => {
  it('should pass through messages from a healthy stream', async () => {
    async function* healthyStream() {
      yield 1;
      yield 2;
      yield 3;
    }

    const results: number[] = [];
    for await (const msg of withIdleTimeout(healthyStream(), 1000)) {
      results.push(msg);
    }

    expect(results).toEqual([1, 2, 3]);
  });

  it('should throw StreamIdleTimeoutError on timeout', async () => {
    async function* slowStream() {
      yield 1;
      await new Promise((resolve) => setTimeout(resolve, 200));
      yield 2; // This should never be reached
    }

    const results: number[] = [];

    await expect(async () => {
      for await (const msg of withIdleTimeout(slowStream(), 50)) {
        results.push(msg);
      }
    }).rejects.toThrow(StreamIdleTimeoutError);

    expect(results).toEqual([1]);
  });

  it('should call onTimeout callback before throwing', async () => {
    const onTimeout = vi.fn();

    async function* slowStream() {
      yield 1;
      await new Promise((resolve) => setTimeout(resolve, 200));
      yield 2;
    }

    try {
      for await (const msg of withIdleTimeout(slowStream(), 50, onTimeout)) {
        // consume
      }
    } catch {
      // expected
    }

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe('isStreamIdleTimeoutError', () => {
  it('should return true for StreamIdleTimeoutError', () => {
    const error = new StreamIdleTimeoutError('test');
    expect(isStreamIdleTimeoutError(error)).toBe(true);
  });

  it('should return false for other errors', () => {
    expect(isStreamIdleTimeoutError(new Error('test'))).toBe(false);
    expect(isStreamIdleTimeoutError(null)).toBe(false);
    expect(isStreamIdleTimeoutError(undefined)).toBe(false);
    expect(isStreamIdleTimeoutError('string')).toBe(false);
  });
});
```

---

## File Changes Summary

| File                                           | Change Type | Description                                     |
| ---------------------------------------------- | ----------- | ----------------------------------------------- |
| `libs/utils/src/concurrency-limiter.ts`        | **NEW**     | Platform-aware concurrency limiter              |
| `libs/utils/src/stream-timeout.ts`             | **NEW**     | Async iterator idle timeout wrapper             |
| `libs/utils/src/index.ts`                      | **MODIFY**  | Export new utilities                            |
| `libs/utils/tests/concurrency-limiter.test.ts` | **NEW**     | Unit tests for concurrency limiter              |
| `libs/utils/tests/stream-timeout.test.ts`      | **NEW**     | Unit tests for stream timeout                   |
| `apps/server/src/services/docs-service.ts`     | **MODIFY**  | Use concurrency limiter, add ConPTY retry logic |
| `apps/server/src/providers/claude-provider.ts` | **MODIFY**  | Add idle timeout to streaming                   |

---

## Testing Strategy

### 1. Unit Tests

Run the new unit tests:

```bash
npm run test:packages
```

### 2. Manual Testing on Windows

1. Open Automaker on Windows
2. Navigate to the Documentation tab
3. Start documentation generation for a project
4. Verify in logs:
   - `[DocsService] Starting parallel generation with concurrency limit: 2 (platform: win32)`
   - Only 2 docs should generate at a time
5. Verify all 6 docs complete successfully without `AttachConsole` errors

### 3. Manual Testing on macOS/Linux

1. Same steps as above
2. Verify in logs:
   - `[DocsService] Starting parallel generation with concurrency limit: 6 (platform: darwin)` (or `linux`)
   - All 6 docs can generate in parallel

---

## Risk Assessment

| Risk                                             | Mitigation                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Slower generation on Windows (2 vs 6 concurrent) | Acceptable tradeoff for reliability. Can tune limit if needed.                     |
| Idle timeout too aggressive                      | 2 minutes is generous. Claude operations rarely take that long without any output. |
| Retry logic causes excessive delays              | Limited to 2 retries with exponential backoff (5s, 10s for ConPTY).                |
| Breaking change to utils package                 | New exports only, no modifications to existing APIs.                               |

---

## Rollback Plan

If issues occur after deployment:

1. **Quick fix**: Increase `STREAM_IDLE_TIMEOUT_MS` to 300000 (5 minutes)
2. **Disable concurrency limiting**: Change `getPlatformConcurrencyLimit()` to always return 6
3. **Full rollback**: Revert the changes to `docs-service.ts` and `claude-provider.ts`

---

## Success Criteria

- [ ] Documentation generation completes successfully on Windows without `AttachConsole` errors
- [ ] Documentation generation completes successfully on macOS/Linux with full parallelism
- [ ] No indefinite hangs - operations either complete or timeout with a clear error
- [ ] All unit tests pass
- [ ] No regressions in existing functionality

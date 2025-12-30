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

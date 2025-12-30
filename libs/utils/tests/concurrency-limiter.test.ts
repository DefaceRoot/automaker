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

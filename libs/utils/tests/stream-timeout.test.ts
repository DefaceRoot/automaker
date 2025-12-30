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

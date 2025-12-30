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

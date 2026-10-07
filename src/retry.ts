export interface RetryOptions {
  /** Total tries, including the first. Default 3. */
  attempts?: number;
  /** Wait before the first retry, in ms. Default 100. */
  delayMs?: number;
  /** Multiplier applied to the wait after each retry. Default 2 (100, 200, 400 ms ...). */
  backoff?: number;
  /** Return false to stop retrying, e.g. for a 4xx response. Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Abort to stop waiting and give up immediately. */
  signal?: AbortSignal;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function assertOptions(attempts: number, delayMs: number, backoff: number): void {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError(`attempts must be a whole number of at least 1, got ${attempts}`);
  }
  if (!(delayMs >= 0)) throw new RangeError(`delayMs must be 0 or more, got ${delayMs}`);
  if (!(backoff >= 1)) throw new RangeError(`backoff must be 1 or more, got ${backoff}`);
}

/**
 * Calls fn until it succeeds or the attempts run out, waiting between tries.
 * If every attempt fails, rethrows the last error unchanged.
 */
export async function retry<T>(fn: () => T | Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delayMs = 100, backoff = 2, shouldRetry = () => true, signal } = options;
  assertOptions(attempts, delayMs, backoff);

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw signal.reason;
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      await wait(delayMs * backoff ** (attempt - 1), signal);
    }
  }
}

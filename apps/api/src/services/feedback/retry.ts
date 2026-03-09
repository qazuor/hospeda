/**
 * Retry utility with exponential backoff.
 *
 * Provides a generic `withRetry` function that re-executes an async operation
 * up to a configurable number of times. Each subsequent attempt waits
 * 2^(attempt-1) seconds before retrying (1s, 2s, 4s by default).
 *
 * @module services/feedback/retry
 */
/**
 * Minimal logging interface required by `withRetry`.
 *
 * Only `warn` is needed for retry diagnostics. Using a narrow interface
 * makes the utility easy to test without constructing a full ILogger mock.
 */
export interface RetryLogger {
    /** Log a warning-level message with optional metadata */
    warn(value: unknown, label?: string): void;
}

/**
 * Options for `withRetry`.
 */
export interface WithRetryOptions<T> {
    /** Async function to execute and retry on failure */
    fn: () => Promise<T>;
    /** Maximum number of attempts (default: 3) */
    maxRetries?: number;
    /** Logger for retry diagnostics (optional) */
    logger?: RetryLogger;
    /**
     * Predicate to determine whether an error is retriable.
     * Defaults to retrying all errors. Return `false` to immediately
     * rethrow without further retry attempts (e.g. for 4xx HTTP errors).
     */
    isRetriable?: (error: Error) => boolean;
}

/**
 * Executes an async function with exponential backoff retries.
 *
 * The function is called up to `maxRetries` times. Between consecutive failures
 * it waits `2^(attempt-1) * 1000` milliseconds:
 * - attempt 1 fails → wait 1000 ms before attempt 2
 * - attempt 2 fails → wait 2000 ms before attempt 3
 * - attempt 3 fails → throw last error
 *
 * @param options - Retry configuration
 * @returns Resolved value of `fn` on the first successful attempt
 * @throws Last error encountered after all retries are exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry({
 *   fn: () => linearService.createIssue(input),
 *   maxRetries: 3,
 *   logger,
 * });
 * ```
 */
export async function withRetry<T>({
    fn,
    maxRetries = 3,
    logger,
    isRetriable
}: WithRetryOptions<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Abort immediately for non-retriable errors (e.g. 4xx client errors)
            if (isRetriable && !isRetriable(lastError)) {
                logger?.warn(
                    { attempt, error: lastError.message },
                    'Non-retriable error, aborting retries'
                );
                throw lastError;
            }

            if (attempt < maxRetries) {
                const delayMs = 2 ** (attempt - 1) * 1000; // 1s, 2s, 4s

                logger?.warn(
                    { attempt, maxRetries, delayMs, error: lastError.message },
                    'Retry attempt failed, backing off'
                );

                await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    // At this point lastError is always set because maxRetries >= 1 and
    // every iteration that did not return has caught an error.
    throw lastError;
}

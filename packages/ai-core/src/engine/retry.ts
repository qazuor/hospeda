/**
 * Error-classification and retry helpers for the AI routing engine (SPEC-173 T-014).
 *
 * **Retryable vs non-retryable** (§5.3, AC-2):
 *
 * Retryable failures are transient service-side conditions where trying again
 * (possibly on another provider) is reasonable:
 * - HTTP 429 (rate-limit / quota exceeded)
 * - HTTP 5xx (provider-side server error)
 * - Network timeouts / connection resets
 * - Errors whose message contains recognizable timeout or connectivity signals
 *
 * Non-retryable failures are caller-side or permanent conditions where retrying
 * the SAME request on ANY provider will not help:
 * - HTTP 4xx other than 429 (bad input, invalid model, auth rejected, etc.)
 * - Zod/schema validation errors produced by the adapter layer
 * - Any other error that does not fit the retryable criteria
 *
 * **Classification heuristic** (§12 flag — see note below):
 * The engine does not have access to raw HTTP status codes once an adapter has
 * wrapped them in a generic `Error`. The heuristic checks:
 * 1. A `statusCode` or `status` property on the error object (set by adapters
 *    that annotate their thrown errors — this is the PREFERRED path).
 * 2. If absent, the `message` string is inspected for well-known status-code
 *    tokens (`"429"`, `"503"`, `"502"`, `"504"`, `"timeout"`, `"ECONNRESET"`,
 *    etc.). This is a fallback for adapters that don't annotate errors.
 *
 * // Decision (owner-approved 2026-06-04): Adapters are NOT required to annotate
 * // errors with `statusCode`. The Vercel AI SDK (v6) may or may not expose
 * // `statusCode` on thrown errors. The engine uses a dual approach: prefer the
 * // numeric `statusCode`/`status` property when present, fall back to message
 * // heuristics otherwise. This handles both annotated and non-annotated errors.
 *
 * @module ai-core/engine/retry
 */

// ---------------------------------------------------------------------------
// Retry policy constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of times a retryable call is attempted on a SINGLE provider
 * before the engine falls back to the next provider in the chain.
 *
 * Value: 2 total attempts per provider (1 initial + 1 retry).
 *
 * **Rationale**: a single retry is enough to handle transient spikes
 * (e.g. a momentary rate-limit burst or a brief 503) without adding excessive
 * latency. Three or more retries on the primary would delay the fallback for
 * too long in practice.
 *
 * // Decision (owner-approved 2026-06-04): MAX_ATTEMPTS_PER_PROVIDER = 2
 * // (1 initial + 1 retry). A single retry is sufficient to handle transient spikes
 * // without excessive latency. This constant and `withRetry` below can be changed
 * // if the retry strategy evolves — the public engine API is unaffected.
 */
export const MAX_ATTEMPTS_PER_PROVIDER = 2;

/**
 * Base delay in milliseconds between retry attempts.
 *
 * The retry delay is `RETRY_BASE_DELAY_MS * attemptIndex` (linear backoff).
 * For 2 total attempts there is only one retry delay: 200ms.
 * This is intentionally conservative — a transient 429 may resolve very fast.
 */
export const RETRY_BASE_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Annotated error (for adapters that set statusCode)
// ---------------------------------------------------------------------------

/**
 * Shape of the optional statusCode annotation that well-behaved adapters
 * may set on their thrown errors.
 *
 * The engine reads `err.statusCode` (number) or `err.status` (number) when
 * present; when absent it falls back to message heuristics.
 */
interface MaybeAnnotatedError {
    readonly statusCode?: number;
    readonly status?: number;
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the engine should retry the call on the SAME provider,
 * or fall back to the NEXT provider, rather than surfacing the error immediately.
 *
 * **Classification logic** (retryable = yes):
 * - Error carries `statusCode` / `status` that is `429` or `>= 500`
 * - Error message contains any of: `"429"`, `"5"` + digit + digit (5xx pattern),
 *   `"rate limit"`, `"timeout"`, `"timed out"`, `"ECONNRESET"`, `"ETIMEDOUT"`,
 *   `"ECONNREFUSED"`, `"socket"`, `"network"`, `"unavailable"`, `"overloaded"`
 *
 * **Non-retryable** (returns `false`):
 * - Status codes in the 4xx range (except 429)
 * - All other errors not matching the retryable criteria
 *
 * // Decision (owner-approved 2026-06-04): Error classification uses `statusCode`/`status`
 * // properties when present (preferred path), with message-string heuristics as a fallback
 * // for adapters that don't annotate errors. The Vercel AI SDK v6 may or may not expose
 * // statusCode; the dual approach handles both cases. Adapters are NOT required to annotate.
 *
 * @param error - The error thrown by a provider adapter call.
 * @returns `true` when the error is considered transient and the engine should
 *   retry or fall back; `false` when the error is deterministic/permanent.
 *
 * @example
 * ```ts
 * try {
 *   result = await provider.generateText(req);
 * } catch (err) {
 *   if (isRetryableError(err as Error)) {
 *     // retry or fall back
 *   } else {
 *     throw err; // surface immediately
 *   }
 * }
 * ```
 */
export function isRetryableError(error: Error): boolean {
    const annotated = error as unknown as MaybeAnnotatedError;

    // Fast path: numeric status code present on the error object.
    const code = annotated.statusCode ?? annotated.status;
    if (typeof code === 'number') {
        return code === 429 || code >= 500;
    }

    // Fallback: heuristic scan of the message string.
    const msg = error.message.toLowerCase();

    // 429 rate-limit pattern
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit')) {
        return true;
    }

    // 5xx server-error patterns
    if (
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('server error') ||
        msg.includes('internal error') ||
        msg.includes('overloaded') ||
        msg.includes('unavailable')
    ) {
        return true;
    }

    // Network / connectivity patterns
    if (
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('econnrefused') ||
        msg.includes('socket') ||
        msg.includes('network') ||
        msg.includes('connection')
    ) {
        return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------

/**
 * Returns a promise that resolves after `ms` milliseconds.
 *
 * Used for retry back-off delays. Exported so tests can replace it via
 * dependency injection rather than module mocking.
 *
 * @param ms - Milliseconds to wait.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Retry-with-policy wrapper
// ---------------------------------------------------------------------------

/**
 * Input for {@link withRetry}.
 */
export interface WithRetryInput<T> {
    /** The async operation to attempt (must be idempotent). */
    readonly fn: () => Promise<T>;
    /**
     * Maximum total call count (including the first attempt).
     * Defaults to {@link MAX_ATTEMPTS_PER_PROVIDER}.
     */
    readonly maxAttempts?: number;
    /**
     * Base delay in ms between retries.
     * Defaults to {@link RETRY_BASE_DELAY_MS}.
     */
    readonly baseDelayMs?: number;
}

/**
 * Executes `fn` up to `maxAttempts` times, retrying on retryable errors.
 *
 * - On a **retryable** error: sleeps `baseDelayMs * attemptIndex` and retries.
 * - On a **non-retryable** error: re-throws immediately (no retry).
 * - If all `maxAttempts` are exhausted: re-throws the last error.
 *
 * The delay is linear (attempt 1 → `baseDelayMs * 1`).  There is at most one
 * retry in the default policy (`maxAttempts = 2`), so backoff complexity is
 * unnecessary.
 *
 * @param input - {@link WithRetryInput}
 * @returns The result of `fn` if any attempt succeeds.
 * @throws The last error if all attempts are exhausted, or the first
 *   non-retryable error encountered.
 *
 * @example
 * ```ts
 * const result = await withRetry({
 *   fn: () => provider.generateText(req),
 *   maxAttempts: 2,
 * });
 * ```
 */
export async function withRetry<T>(input: WithRetryInput<T>): Promise<T> {
    const {
        fn,
        maxAttempts = MAX_ATTEMPTS_PER_PROVIDER,
        baseDelayMs = RETRY_BASE_DELAY_MS
    } = input;

    let lastError: Error = new Error('No attempts made');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            lastError = error;

            const retryable = isRetryableError(error);

            if (!retryable) {
                // Non-retryable: surface immediately, no fallback.
                throw error;
            }

            // Retryable: apply back-off delay before the next attempt (or before
            // giving up if this was the last attempt).
            const isLastAttempt = attempt === maxAttempts - 1;
            if (!isLastAttempt) {
                await sleep(baseDelayMs * (attempt + 1));
            }
        }
    }

    // All retryable attempts exhausted — propagate the last error to the engine
    // so it can fall back to the next provider.
    throw lastError;
}

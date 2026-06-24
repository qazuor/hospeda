/**
 * Retry layer for Apify-backed extraction (SPEC-277 R1)
 *
 * Wraps a single {@link RunApifyActorResult}-returning call (typically
 * {@link runApifyActor} or an adapter's actor call) and retries it a bounded
 * number of times when the failure is *transient*. This lives next to the
 * Apify client — closest to the failure point — so the import orchestrator and
 * the `AccommodationImportResponse` contract stay unchanged: a caller swaps a
 * bare `runApifyActor(...)` for `withRetry({ fn: () => runApifyActor(...) })`
 * and gets the same result shape, just with transient blocks absorbed.
 *
 * Only `source_blocked` and `timeout` are retried (see
 * {@link RETRYABLE_FAILURE_CODES}); every other outcome — including a 2xx empty
 * dataset (no `failureCode`) and hard failures like `invalid_url` or
 * `credentials_missing` — returns immediately, because retrying them only burns
 * Apify cost without changing the result.
 *
 * @module services/accommodation-import/adapters/with-retry
 */

import type { ImportFailureCode } from '@repo/schemas';
import type { RunApifyActorResult } from './apify-client';

/**
 * Failure codes that represent a *transient* block worth retrying.
 *
 * `source_blocked` (anti-bot / 429) and `timeout` can succeed on a later
 * attempt once the source recovers. All other {@link ImportFailureCode} values
 * are treated as terminal for the attempt and are NOT retried.
 */
export const RETRYABLE_FAILURE_CODES: ReadonlySet<ImportFailureCode> = new Set<ImportFailureCode>([
    'source_blocked',
    'timeout'
]);

/**
 * Input parameters for {@link withRetry}.
 */
export interface WithRetryInput {
    /**
     * The call to run (and retry). Must resolve to a {@link RunApifyActorResult}
     * and never throw — `withRetry` does not add a try/catch, it relies on the
     * wrapped call honouring the "never throws" contract.
     */
    readonly fn: () => Promise<RunApifyActorResult>;
    /**
     * Maximum number of *retries* after the initial attempt. Total calls =
     * `1 + maxRetries`. Defaults to `2` (3 calls max).
     */
    readonly maxRetries?: number;
    /**
     * Base backoff delay in milliseconds. The actual delay is jittered as
     * `baseDelayMs + Math.random() * baseDelayMs` (0–100% jitter) so concurrent
     * imports do not hammer an anti-bot wall in lockstep. Defaults to `500`.
     */
    readonly baseDelayMs?: number;
}

/**
 * Resolves after `ms` milliseconds. Internal backoff helper.
 *
 * @param ms - Delay in milliseconds.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying on a transient failure with jittered backoff.
 *
 * The wrapped call is invoked once; while its result carries a retryable
 * `failureCode` ({@link RETRYABLE_FAILURE_CODES}) and retries remain, it sleeps
 * a jittered delay and calls `fn` again. Any non-retryable result — a success
 * (no `failureCode`, even with an empty `items`) or a terminal failure code —
 * returns immediately with no sleep. After exhausting `maxRetries`, the last
 * result is returned as-is.
 *
 * **Never throws** (provided `fn` honours its own no-throw contract).
 *
 * @param input - The call to run plus optional retry budget and backoff base.
 * @returns The first non-retryable {@link RunApifyActorResult}, or the last
 *   result once retries are exhausted.
 *
 * @example
 * ```ts
 * const result = await withRetry({
 *   fn: () => runApifyActor({ token, actor, actorInput, timeoutMs }),
 * });
 * // `source_blocked` / `timeout` are retried up to 2x; everything else returns immediately.
 * ```
 */
export async function withRetry(input: WithRetryInput): Promise<RunApifyActorResult> {
    const { fn, maxRetries = 2, baseDelayMs = 500 } = input;

    let result = await fn();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { failureCode } = result;
        if (!failureCode || !RETRYABLE_FAILURE_CODES.has(failureCode)) {
            return result;
        }
        await sleep(baseDelayMs + Math.random() * baseDelayMs);
        result = await fn();
    }

    return result;
}

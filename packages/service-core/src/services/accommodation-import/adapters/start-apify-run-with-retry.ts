/**
 * Retry layer for starting an async Apify run (HOS-50 / SPEC-277 R1 composition)
 *
 * `startApifyRun` (SPEC-250) has a "never throws, degrades to `null`" contract
 * — a `null` result means the start call itself failed transiently (network
 * error, non-201 response, malformed body). This wrapper retries only that
 * `null` outcome with the same jittered-backoff shape as the sync path's
 * {@link withRetry} in `with-retry.ts`.
 *
 * Retrying is scoped to the initial `startApifyRun` call ONLY — once a run
 * has actually started, polling it (`getApifyRunStatus`) is never retried:
 * an Apify run is either still in progress or has reached an authoritative
 * terminal state, so there is nothing a synthetic retry could recover.
 *
 * Deliberately NOT added to `with-retry.ts`: that module's `WithRetryInput`
 * is coupled to the sync path's `RunApifyActorResult` shape (retries keyed
 * off `ImportFailureCode`), which does not apply here — `startApifyRun`'s
 * only failure signal is `null`.
 *
 * @module services/accommodation-import/adapters/start-apify-run-with-retry
 */

import type { StartApifyRunResult } from './apify-client';

/**
 * Input parameters for {@link startApifyRunWithRetry}.
 */
export interface StartApifyRunWithRetryInput {
    /**
     * The `startApifyRun` call to run (and retry). Must resolve to a
     * {@link StartApifyRunResult} or `null`, and never throw — this wrapper
     * relies on `startApifyRun`'s own no-throw contract.
     */
    readonly fn: () => Promise<StartApifyRunResult | null>;
    /**
     * Maximum number of *retries* after the initial attempt. Total calls =
     * `1 + maxRetries`. Defaults to `2` (3 calls max).
     */
    readonly maxRetries?: number;
    /**
     * Base backoff delay in milliseconds. The actual delay is jittered as
     * `baseDelayMs + Math.random() * baseDelayMs` (0–100% jitter), matching
     * `with-retry.ts`. Defaults to `500`.
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
 * Runs `fn` (a `startApifyRun` call), retrying on a `null` result with
 * jittered backoff.
 *
 * While the result is `null` and retries remain, sleeps a jittered delay and
 * calls `fn` again. Returns immediately on the first non-`null` result. After
 * exhausting `maxRetries`, returns `null`.
 *
 * **Never throws** (provided `fn` honours its own no-throw contract).
 *
 * @param input - The `startApifyRun` call to run plus optional retry budget.
 * @returns The first successful {@link StartApifyRunResult}, or `null` once
 *   retries are exhausted.
 *
 * @example
 * ```ts
 * const result = await startApifyRunWithRetry({
 *   fn: () => startApifyRun({ token, actor, actorInput }),
 * });
 * // transient null start failures are retried up to 2x
 * ```
 */
export async function startApifyRunWithRetry(
    input: StartApifyRunWithRetryInput
): Promise<StartApifyRunResult | null> {
    const { fn, maxRetries = 2, baseDelayMs = 500 } = input;

    let result = await fn();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (result !== null) {
            return result;
        }
        await sleep(baseDelayMs + Math.random() * baseDelayMs);
        result = await fn();
    }

    return result;
}

/**
 * Unit tests for the Apify retry layer (SPEC-277 R1 — T-006)
 *
 * `withRetry` wraps a `RunApifyActorResult`-returning call and retries only
 * transient failures (`source_blocked`, `timeout`) with jittered backoff.
 * Fake timers are used so the jittered sleeps cost no real wall-clock time and
 * the exact call count can be asserted.
 *
 * Covers:
 * - Retries exactly `maxRetries` times on each retryable code, then returns the failure.
 * - Returns immediately (one call) on every non-retryable code.
 * - Returns the first success without consuming remaining attempts.
 * - Default `maxRetries = 2`, and a custom `maxRetries = 0` disables retrying.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunApifyActorResult } from '../../../../src/services/accommodation-import/adapters/apify-client.js';
import { withRetry } from '../../../../src/services/accommodation-import/adapters/with-retry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a `RunApifyActorResult`. Omitting `failureCode` yields a success;
 * `items` defaults to empty.
 */
function result(
    failureCode?: RunApifyActorResult['failureCode'],
    items: unknown[] = []
): RunApifyActorResult {
    return { items, failureCode };
}

/**
 * Runs `withRetry` while draining all jittered-backoff timers so the promise
 * settles without real wall-clock delay.
 */
async function runWithTimers(
    promiseFactory: () => Promise<RunApifyActorResult>
): Promise<RunApifyActorResult> {
    const pending = promiseFactory();
    await vi.runAllTimersAsync();
    return pending;
}

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

describe('withRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('retries exactly maxRetries times on source_blocked, then returns the failure', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('source_blocked'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert — 1 initial call + 2 retries = 3 total.
        expect(fn).toHaveBeenCalledTimes(3);
        expect(res.failureCode).toBe('source_blocked');
    });

    it('retries exactly maxRetries times on timeout, then returns the failure', async () => {
        // Arrange
        const fn = vi.fn<() => Promise<RunApifyActorResult>>().mockResolvedValue(result('timeout'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(3);
        expect(res.failureCode).toBe('timeout');
    });

    it('does NOT retry on invalid_url — returns immediately after the first call', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('invalid_url'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(1);
        expect(res.failureCode).toBe('invalid_url');
    });

    it('does NOT retry on credentials_missing — returns immediately after the first call', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('credentials_missing'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(1);
        expect(res.failureCode).toBe('credentials_missing');
    });

    it('does NOT retry on provider_error — returns immediately after the first call', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('provider_error'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(1);
        expect(res.failureCode).toBe('provider_error');
    });

    it('does NOT retry on nothing_found — returns immediately after the first call', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('nothing_found'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(1);
        expect(res.failureCode).toBe('nothing_found');
    });

    it('returns the first success (items.length > 0) without retrying remaining attempts', async () => {
        // Arrange — a retryable block, then a success on the second call.
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValueOnce(result('source_blocked'))
            .mockResolvedValueOnce(result(undefined, [{ id: 1 }]));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert — stopped at the success; did not consume the 2nd retry.
        expect(fn).toHaveBeenCalledTimes(2);
        expect(res.failureCode).toBeUndefined();
        expect(res.items).toHaveLength(1);
    });

    it('defaults to maxRetries = 2 (3 total calls) when not specified', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('source_blocked'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(3);
        expect(res.failureCode).toBe('source_blocked');
    });

    it('respects a custom maxRetries of 0 (no retry — a single call)', async () => {
        // Arrange
        const fn = vi
            .fn<() => Promise<RunApifyActorResult>>()
            .mockResolvedValue(result('source_blocked'));

        // Act
        const res = await runWithTimers(() => withRetry({ fn, maxRetries: 0 }));

        // Assert
        expect(fn).toHaveBeenCalledTimes(1);
        expect(res.failureCode).toBe('source_blocked');
    });
});

/**
 * Unit tests for the async-run start retry layer (HOS-50 / SPEC-277 R1 composition)
 *
 * `startApifyRunWithRetry` wraps a `StartApifyRunResult | null`-returning call
 * and retries only on a `null` (transient start failure) result, with the same
 * jittered-backoff shape as the sync path's `withRetry`. Fake timers are used
 * so the jittered sleeps cost no real wall-clock time and the exact call count
 * can be asserted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StartApifyRunResult } from '../../../../src/services/accommodation-import/adapters/apify-client.js';
import { startApifyRunWithRetry } from '../../../../src/services/accommodation-import/adapters/start-apify-run-with-retry.js';

/**
 * Runs `startApifyRunWithRetry` while draining all jittered-backoff timers so
 * the promise settles without real wall-clock delay.
 */
async function runWithTimers(
    promiseFactory: () => Promise<StartApifyRunResult | null>
): Promise<StartApifyRunResult | null> {
    const pending = promiseFactory();
    await vi.runAllTimersAsync();
    return pending;
}

describe('startApifyRunWithRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('succeeds on the first try without retrying', async () => {
        const fn = vi
            .fn<() => Promise<StartApifyRunResult | null>>()
            .mockResolvedValue({ runId: 'run-1', defaultDatasetId: 'ds-1' });

        const res = await runWithTimers(() => startApifyRunWithRetry({ fn }));

        expect(fn).toHaveBeenCalledTimes(1);
        expect(res).toEqual({ runId: 'run-1', defaultDatasetId: 'ds-1' });
    });

    it('retries after 1 null and succeeds on the second attempt', async () => {
        const fn = vi
            .fn<() => Promise<StartApifyRunResult | null>>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ runId: 'run-2', defaultDatasetId: 'ds-2' });

        const res = await runWithTimers(() => startApifyRunWithRetry({ fn }));

        expect(fn).toHaveBeenCalledTimes(2);
        expect(res).toEqual({ runId: 'run-2', defaultDatasetId: 'ds-2' });
    });

    it('retries after 2 nulls and succeeds on the third (final) attempt', async () => {
        const fn = vi
            .fn<() => Promise<StartApifyRunResult | null>>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ runId: 'run-3', defaultDatasetId: 'ds-3' });

        const res = await runWithTimers(() => startApifyRunWithRetry({ fn }));

        expect(fn).toHaveBeenCalledTimes(3);
        expect(res).toEqual({ runId: 'run-3', defaultDatasetId: 'ds-3' });
    });

    it('gives up after 3 total attempts (1 initial + 2 retries) and returns null', async () => {
        const fn = vi.fn<() => Promise<StartApifyRunResult | null>>().mockResolvedValue(null);

        const res = await runWithTimers(() => startApifyRunWithRetry({ fn }));

        expect(fn).toHaveBeenCalledTimes(3);
        expect(res).toBeNull();
    });

    it('respects a custom maxRetries of 0 (single attempt, no retry)', async () => {
        const fn = vi.fn<() => Promise<StartApifyRunResult | null>>().mockResolvedValue(null);

        const res = await runWithTimers(() => startApifyRunWithRetry({ fn, maxRetries: 0 }));

        expect(fn).toHaveBeenCalledTimes(1);
        expect(res).toBeNull();
    });

    it('applies a jittered backoff within [baseDelayMs, 2*baseDelayMs) before each retry', async () => {
        const fn = vi
            .fn<() => Promise<StartApifyRunResult | null>>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ runId: 'run-4', defaultDatasetId: 'ds-4' });

        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

        await runWithTimers(() => startApifyRunWithRetry({ fn, baseDelayMs: 500 }));

        const delays = setTimeoutSpy.mock.calls.map((call) => call[1] as number);
        expect(delays).toHaveLength(2);
        for (const delay of delays) {
            expect(delay).toBeGreaterThanOrEqual(500);
            expect(delay).toBeLessThan(1000);
        }
    });
});

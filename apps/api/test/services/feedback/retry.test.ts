/**
 * Tests for withRetry - exponential backoff retry utility
 *
 * Coverage:
 * - Successful first attempt returns result immediately
 * - Retries on failure and succeeds on a later attempt
 * - Exhausts all retries and throws the last error
 * - Exponential backoff delays between attempts (1s, 2s)
 * - Logger is called on each failed retry before the last one
 * - Default maxRetries of 3 is used when not supplied
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../../src/services/feedback/retry.js';

// ─── Timer helpers ────────────────────────────────────────────────────────────

/** Capture setTimeout calls without actually waiting */
function useFakeTimers() {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('withRetry', () => {
    describe('successful execution', () => {
        it('returns result on first attempt without any delay', async () => {
            const fn = vi.fn().mockResolvedValue('ok');

            const result = await withRetry({ fn, maxRetries: 3 });

            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('works with default maxRetries (3) when not provided', async () => {
            const fn = vi.fn().mockResolvedValue(42);

            const result = await withRetry({ fn });

            expect(result).toBe(42);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('retry on failure', () => {
        useFakeTimers();

        it('retries and succeeds on second attempt', async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error('first failure'))
                .mockResolvedValue('recovered');

            const promise = withRetry({ fn, maxRetries: 3 });

            // Advance past the 1s backoff after attempt 1
            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;
            expect(result).toBe('recovered');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('retries and succeeds on third attempt', async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error('first'))
                .mockRejectedValueOnce(new Error('second'))
                .mockResolvedValue('third success');

            const promise = withRetry({ fn, maxRetries: 3 });

            // Advance past 1s (after attempt 1) + 2s (after attempt 2)
            await vi.advanceTimersByTimeAsync(3000);

            const result = await promise;
            expect(result).toBe('third success');
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('exhausted retries', () => {
        useFakeTimers();

        it('throws the last error when all retries fail', async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error('attempt 1'))
                .mockRejectedValueOnce(new Error('attempt 2'))
                .mockRejectedValueOnce(new Error('attempt 3 - final'));

            // Advance timers concurrently with the assertion to avoid
            // unhandled rejection warnings from Vitest.
            await Promise.all([
                expect(withRetry({ fn, maxRetries: 3 })).rejects.toThrow('attempt 3 - final'),
                vi.advanceTimersByTimeAsync(3000)
            ]);

            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('wraps non-Error rejections in an Error object', async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce('string error')
                .mockRejectedValueOnce('string error 2')
                .mockRejectedValueOnce('final string error');

            await Promise.all([
                expect(withRetry({ fn, maxRetries: 3 })).rejects.toThrow('final string error'),
                vi.advanceTimersByTimeAsync(3000)
            ]);
        });
    });

    describe('exponential backoff timing', () => {
        useFakeTimers();

        it('waits 1000 ms before second attempt', async () => {
            const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

            const promise = withRetry({ fn, maxRetries: 3 });

            // After first failure: no second call yet
            await vi.advanceTimersByTimeAsync(999);
            expect(fn).toHaveBeenCalledTimes(1);

            // After 1000ms: second attempt fires
            await vi.advanceTimersByTimeAsync(1);
            await promise;
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('waits 2000 ms before third attempt', async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('ok');

            const promise = withRetry({ fn, maxRetries: 3 });

            // Advance past first backoff (1s) - second attempt fires
            await vi.advanceTimersByTimeAsync(1000);
            expect(fn).toHaveBeenCalledTimes(2);

            // Not enough for the 2s second backoff
            await vi.advanceTimersByTimeAsync(1999);
            expect(fn).toHaveBeenCalledTimes(2);

            // Now the 2s backoff is over - third attempt fires
            await vi.advanceTimersByTimeAsync(1);
            await promise;
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('logger integration', () => {
        useFakeTimers();

        it('calls logger.warn for each failed attempt except the last', async () => {
            /** Only `warn` is required by RetryLogger */
            const logger = { warn: vi.fn() };

            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error('err1'))
                .mockRejectedValueOnce(new Error('err2'))
                .mockRejectedValueOnce(new Error('err3 - last'));

            await Promise.all([
                expect(withRetry({ fn, maxRetries: 3, logger })).rejects.toThrow('err3 - last'),
                vi.advanceTimersByTimeAsync(3000)
            ]);

            // warn called for attempt 1 and 2 (not for the last failure)
            expect(logger.warn).toHaveBeenCalledTimes(2);

            // First warn call should include attempt=1
            expect(logger.warn).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ attempt: 1, maxRetries: 3, delayMs: 1000 }),
                expect.any(String)
            );

            // Second warn call should include attempt=2
            expect(logger.warn).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ attempt: 2, maxRetries: 3, delayMs: 2000 }),
                expect.any(String)
            );
        });

        it('does not call logger when operation succeeds on first attempt', async () => {
            const logger = { warn: vi.fn() };

            await withRetry({ fn: async () => 'ok', maxRetries: 3, logger });

            expect(logger.warn).not.toHaveBeenCalled();
        });
    });

    describe('maxRetries boundary', () => {
        it('only calls fn once when maxRetries is 1 and fn fails', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('only try'));

            await expect(withRetry({ fn, maxRetries: 1 })).rejects.toThrow('only try');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});

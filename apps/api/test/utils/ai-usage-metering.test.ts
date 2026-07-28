/**
 * Unit tests for the AI usage metering helper (HOS-328).
 *
 * The helper exists for exactly two guarantees, and both are load-bearing:
 *
 *   1. It NEVER throws. Metering runs after the AI response has already been
 *      delivered, so a storage failure must not turn a served request into an
 *      error.
 *   2. It never waits longer than {@link METERING_TIMEOUT_MS}. On the streaming
 *      routes it sits in front of the SSE `done` frame, so an unbounded await
 *      would be unbounded client latency.
 *
 * @module test/utils/ai-usage-metering
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockRecordAiUsage, mockWarn, mockDebug } = vi.hoisted(() => ({
    mockRecordAiUsage: vi.fn(),
    mockWarn: vi.fn(),
    mockDebug: vi.fn()
}));

vi.mock('@repo/ai-core', () => ({
    recordAiUsage: mockRecordAiUsage
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: mockWarn,
        info: vi.fn(),
        error: vi.fn(),
        debug: mockDebug
    }
}));

const { METERING_TIMEOUT_MS, meterAiUsage } = await import('../../src/utils/ai-usage-metering');

/** Minimal valid input; individual tests override what they exercise. */
function makeInput(overrides: Record<string, unknown> = {}) {
    return {
        userId: 'user-1',
        feature: 'text_improve' as const,
        provider: 'openai',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 40,
        latencyMs: 820,
        status: 'success' as const,
        ...overrides
    };
}

describe('meterAiUsage', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe('happy path', () => {
        it('forwards every field to recordAiUsage', async () => {
            mockRecordAiUsage.mockResolvedValueOnce({ id: 'row-1' });

            await meterAiUsage(makeInput());

            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            expect(mockRecordAiUsage).toHaveBeenCalledWith({
                userId: 'user-1',
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                promptTokens: 100,
                completionTokens: 40,
                latencyMs: 820,
                status: 'success'
            });
            expect(mockWarn).not.toHaveBeenCalled();
        });
    });

    describe('failure is swallowed', () => {
        it('resolves instead of rejecting when the insert fails', async () => {
            mockRecordAiUsage.mockRejectedValueOnce(new Error('connection reset'));

            await expect(meterAiUsage(makeInput())).resolves.toBeUndefined();

            expect(mockWarn).toHaveBeenCalledTimes(1);
            expect(mockWarn.mock.calls[0]?.[0]).toMatchObject({
                userId: 'user-1',
                feature: 'text_improve',
                error: 'connection reset'
            });
        });

        it('merges logContext into the warning payload', async () => {
            mockRecordAiUsage.mockRejectedValueOnce(new Error('boom'));

            await meterAiUsage(
                makeInput({
                    feature: 'translate',
                    logContext: { entityType: 'accommodation', entityId: 'acc-9' }
                })
            );

            expect(mockWarn.mock.calls[0]?.[0]).toMatchObject({
                entityType: 'accommodation',
                entityId: 'acc-9',
                feature: 'translate'
            });
        });

        it('stringifies a non-Error throwable', async () => {
            mockRecordAiUsage.mockRejectedValueOnce('plain string failure');

            await meterAiUsage(makeInput());

            expect(mockWarn.mock.calls[0]?.[0]).toMatchObject({
                error: 'plain string failure'
            });
        });
    });

    describe('token normalisation', () => {
        it('coerces NaN / negative / non-finite counts to 0', async () => {
            mockRecordAiUsage.mockResolvedValueOnce({ id: 'row-1' });

            await meterAiUsage(
                makeInput({
                    promptTokens: Number.NaN,
                    completionTokens: -5
                })
            );

            // `tokens_in` / `tokens_out` are integer columns — a NaN would fail
            // the insert and silently lose the row.
            expect(mockRecordAiUsage.mock.calls[0]?.[0]).toMatchObject({
                promptTokens: 0,
                completionTokens: 0
            });
        });

        it('rounds fractional token counts', async () => {
            mockRecordAiUsage.mockResolvedValueOnce({ id: 'row-1' });

            await meterAiUsage(makeInput({ promptTokens: 10.6, completionTokens: 3.2 }));

            expect(mockRecordAiUsage.mock.calls[0]?.[0]).toMatchObject({
                promptTokens: 11,
                completionTokens: 3
            });
        });
    });

    describe('timeout', () => {
        it('stops waiting once METERING_TIMEOUT_MS elapses', async () => {
            vi.useFakeTimers();
            // An insert that never settles — the caller must not hang on it.
            mockRecordAiUsage.mockReturnValueOnce(new Promise(() => {}));

            let settled = false;
            const pending = meterAiUsage(makeInput()).then(() => {
                settled = true;
            });

            await vi.advanceTimersByTimeAsync(METERING_TIMEOUT_MS - 1);
            expect(settled).toBe(false);

            await vi.advanceTimersByTimeAsync(2);
            await pending;

            expect(settled).toBe(true);
            expect(mockWarn).toHaveBeenCalledTimes(1);
            expect(mockWarn.mock.calls[0]?.[0]).toMatchObject({
                timeoutMs: METERING_TIMEOUT_MS
            });
        });

        it('does not leave an unhandled rejection when the insert fails after the timeout', async () => {
            vi.useFakeTimers();
            let rejectWrite: (reason: unknown) => void = () => {};
            mockRecordAiUsage.mockReturnValueOnce(
                new Promise((_resolve, reject) => {
                    rejectWrite = reject;
                })
            );

            const pending = meterAiUsage(makeInput());
            await vi.advanceTimersByTimeAsync(METERING_TIMEOUT_MS + 1);
            await pending;

            // Only ONE warn so far: the timeout. Under a stalled pool every
            // request would otherwise emit two warns for the same row, doubling
            // the noise in exactly the incident where the log matters most.
            expect(mockWarn).toHaveBeenCalledTimes(1);

            // Late rejection: must be caught by the helper's own handler, not
            // escalate to an unhandled rejection that could crash the process.
            // It is logged at debug because the timeout already reported the row
            // as at-risk — the failure is the expected follow-up, not news.
            rejectWrite(new Error('late failure'));
            await vi.advanceTimersByTimeAsync(1);

            expect(
                mockDebug.mock.calls.some(
                    (call) => (call[0] as { error?: string })?.error === 'late failure'
                )
            ).toBe(true);
            expect(mockWarn).toHaveBeenCalledTimes(1);
        });

        it('swallows a synchronous throw from recordAiUsage', async () => {
            // Callers rely on this never rejecting: in the streaming routes a
            // rejection here would replace an already-delivered response's `done`
            // frame with an SSE `error` frame.
            mockRecordAiUsage.mockImplementationOnce(() => {
                throw new Error('module wiring broken');
            });

            await expect(meterAiUsage(makeInput())).resolves.toBeUndefined();
            expect(mockWarn).toHaveBeenCalledTimes(1);
            expect(mockWarn.mock.calls[0]?.[0]).toMatchObject({
                error: 'module wiring broken'
            });
        });
    });
});

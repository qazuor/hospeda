/** @file Unit tests for the refresh-outcome reader (HOS-1944). */
import { describe, expect, it } from 'vitest';
import { hasNothingToRefresh } from '@/lib/host/external-reputation-refresh';

describe('hasNothingToRefresh (HOS-1944)', () => {
    it('is true when all three lists are present and empty', () => {
        expect(
            hasNothingToRefresh({
                result: { inlineSucceeded: [], enqueuedAsync: [], inlineFailed: [] }
            })
        ).toBe(true);
    });

    it.each([
        ['an inline success', { inlineSucceeded: ['GOOGLE'], enqueuedAsync: [], inlineFailed: [] }],
        ['an enqueued run', { inlineSucceeded: [], enqueuedAsync: ['BOOKING'], inlineFailed: [] }],
        [
            'a failure',
            { inlineSucceeded: [], enqueuedAsync: [], inlineFailed: [{ platform: 'AIRBNB' }] }
        ]
    ])('is false when there is %s', (_label, result) => {
        expect(hasNothingToRefresh({ result })).toBe(false);
    });

    it.each([
        ['missing', undefined],
        ['null', null],
        ['an empty object', {}],
        ['partial', { inlineSucceeded: [] }]
    ])('is false when the body is %s, since it proves nothing', (_label, result) => {
        expect(hasNothingToRefresh({ result })).toBe(false);
    });
});

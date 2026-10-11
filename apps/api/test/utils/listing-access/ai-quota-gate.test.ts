import { getMonthlyCallCount, recordAiUsage } from '@repo/ai-core';
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    count: 0
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: state.effectiveSet })
}));
vi.mock('@repo/ai-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/ai-core')>()),
    getMonthlyCallCount: vi.fn(async () => state.count),
    recordAiUsage: vi.fn(async () => undefined)
}));

import { enforceAiQuota, evaluateAiQuota } from '../../../src/utils/listing-access/ai-quota-gate';

function makeEffectiveSet(args: { entitlement: number; limit?: number }) {
    return {
        entitlements: { get: () => args.entitlement },
        limits: { get: () => args.limit }
    } as never;
}

describe('AI quota gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.count = 0;
        state.effectiveSet.mockImplementation(async () =>
            makeEffectiveSet({ entitlement: 1, limit: 5 })
        );
    });

    it('denies missing entitlement without counting usage', async () => {
        state.effectiveSet.mockImplementation(async () =>
            makeEffectiveSet({ entitlement: 0, limit: 5 })
        );
        await expect(
            evaluateAiQuota({
                userId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                feature: 'text_improve',
                entitlementKey: 'ai_text_improve',
                limitKey: 'max_ai_text_improve_per_month'
            })
        ).resolves.toEqual({
            allowed: false,
            reason: 'entitlement',
            key: 'ai_text_improve',
            max: 0,
            count: 0
        });
        expect(getMonthlyCallCount).not.toHaveBeenCalled();
    });

    it('uses the next call count and allows a call up to the effective limit', async () => {
        state.count = 4;
        await expect(
            evaluateAiQuota({
                userId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                feature: 'text_improve',
                entitlementKey: 'ai_text_improve',
                limitKey: 'max_ai_text_improve_per_month'
            })
        ).resolves.toEqual({ allowed: true });
    });

    it('records quota_exceeded before throwing at the effective limit', async () => {
        state.count = 5;
        state.effectiveSet.mockImplementation(async () =>
            makeEffectiveSet({ entitlement: 1, limit: 5 })
        );
        await expect(
            enforceAiQuota({
                userId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                feature: 'text_improve',
                entitlementKey: 'ai_text_improve',
                limitKey: 'max_ai_text_improve_per_month'
            })
        ).rejects.toMatchObject({
            code: 'LIMIT_REACHED',
            details: { currentCount: 5, maxAllowed: 5 }
        });
        expect(recordAiUsage).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'quota_exceeded' })
        );
    });

    it('treats an absent limit as zero', async () => {
        state.effectiveSet.mockImplementation(async () => makeEffectiveSet({ entitlement: 1 }));
        await expect(
            evaluateAiQuota({
                userId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                feature: 'text_improve',
                entitlementKey: 'ai_text_improve',
                limitKey: 'max_ai_text_improve_per_month'
            })
        ).resolves.toMatchObject({ allowed: false, reason: 'quota', max: 0, count: 0 });
    });
});

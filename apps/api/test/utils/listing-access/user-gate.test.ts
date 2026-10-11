import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet, UnknownStepKeyError } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enforceUserGate, readEffectiveKeys } from '../../../src/utils/listing-access/user-gate';
import { apiLogger } from '../../../src/utils/logger';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

const userId = '11111111-1111-4111-8111-111111111111';
const vertical = VerticalEnum.ACCOMMODATION;

function grant(entries: readonly { key: string; value: number }[]): void {
    mocks.effectiveSet.mockImplementation(
        async (scope: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId: scope.userId,
                vertical: scope.vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: entries.map((entry) => ({ ...entry, strategy: 'MAX' as const }))
            })
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    grant([]);
});

describe('user-level effective gate', () => {
    it('rejects a missing capability with its key', async () => {
        await expect(
            enforceUserGate({ userId, vertical, keys: ['view_basic_stats'] })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'view_basic_stats' }
        });
    });

    it('rejects an exhausted limit with count and maximum', async () => {
        grant([{ key: 'max_active_promotions', value: 2 }]);
        await expect(
            enforceUserGate({
                userId,
                vertical,
                limit: async () => ({ key: 'max_active_promotions', requested: 3 })
            })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_active_promotions', currentCount: 2, maxAllowed: 2 }
        });
    });

    it('treats an absent limit as zero', async () => {
        await expect(
            enforceUserGate({
                userId,
                vertical,
                limit: async () => ({ key: 'max_active_promotions', requested: 1 })
            })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_active_promotions', currentCount: 0, maxAllowed: 0 }
        });
    });

    it('does not count usage if capability is missing', async () => {
        const limit = vi.fn(async () => ({ key: 'max_active_promotions', requested: 1 }));
        await expect(
            enforceUserGate({ userId, vertical, keys: ['create_promotions'], limit })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED
        });
        expect(limit).not.toHaveBeenCalled();
    });

    it('requires every capability, in order', async () => {
        grant([{ key: 'view_basic_stats', value: 1 }]);
        await expect(
            enforceUserGate({ userId, vertical, keys: ['view_basic_stats', 'view_advanced_stats'] })
        ).rejects.toMatchObject({
            details: { entitlementKey: 'view_advanced_stats' }
        });
        expect(mocks.effectiveSet).toHaveBeenCalledTimes(2);
    });

    it('requests the passed user and vertical for every step', async () => {
        grant([
            { key: 'view_basic_stats', value: 1 },
            { key: 'max_active_promotions', value: 2 }
        ]);
        await enforceUserGate({
            userId,
            vertical: VerticalEnum.GASTRONOMY,
            keys: ['view_basic_stats'],
            limit: async () => ({ key: 'max_active_promotions', requested: 1 })
        });
        expect(mocks.effectiveSet).toHaveBeenCalledTimes(2);
        expect(mocks.effectiveSet).toHaveBeenNthCalledWith(1, {
            userId,
            vertical: VerticalEnum.GASTRONOMY
        });
        expect(mocks.effectiveSet).toHaveBeenNthCalledWith(2, {
            userId,
            vertical: VerticalEnum.GASTRONOMY
        });
    });

    it('returns false for every key and warns if reading fails', async () => {
        const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => apiLogger);
        mocks.effectiveSet.mockRejectedValue(new Error('set unavailable'));
        await expect(
            readEffectiveKeys({
                userId,
                vertical,
                keys: ['view_basic_stats', 'view_advanced_stats']
            })
        ).resolves.toEqual({ view_basic_stats: false, view_advanced_stats: false });
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('reports each effective capability as a boolean for the requested scope', async () => {
        grant([{ key: 'view_basic_stats', value: 1 }]);
        await expect(
            readEffectiveKeys({
                userId,
                vertical: VerticalEnum.EXPERIENCE,
                keys: ['view_basic_stats', 'view_advanced_stats']
            })
        ).resolves.toEqual({ view_basic_stats: true, view_advanced_stats: false });
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId,
            vertical: VerticalEnum.EXPERIENCE
        });
    });

    it('throws for an unknown catalog key', async () => {
        await expect(
            readEffectiveKeys({ userId, vertical, keys: ['unknown_stats_capability'] })
        ).rejects.toBeInstanceOf(UnknownStepKeyError);
    });
});

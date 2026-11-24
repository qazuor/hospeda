/**
 * HOS-2592: the recipient-side audience scope used by the price-alert digest.
 *
 * `resolveTouristAudienceScopeForUser` decides from the TOURIST effective set
 * (`vip_promotions_access`) whether a known user may receive VIP-only owner
 * promotions. A role never decides, and a failed effective-set read grants
 * plus only.
 */
import { TouristAudienceEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

const { resolveTouristAudienceScopeForUser } = await import(
    '../../../src/routes/owner-promotion/audience-scope'
);

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Makes the effective set grant (or not) `vip_promotions_access`. */
function setVipAccess(granted: boolean): void {
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: granted
                    ? [{ key: 'vip_promotions_access', value: 1, strategy: 'MAX' as const }]
                    : []
            })
    );
}

describe('resolveTouristAudienceScopeForUser (HOS-2592)', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset();
    });

    it('grants plus and vip to a user whose tourist set has vip_promotions_access', async () => {
        // Arrange
        setVipAccess(true);

        // Act
        const scope = await resolveTouristAudienceScopeForUser({ userId: USER_ID });

        // Assert
        expect(scope).toEqual([TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]);
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: USER_ID,
            vertical: VerticalEnum.TOURIST
        });
    });

    it('grants plus only to a user without vip_promotions_access', async () => {
        // Arrange
        setVipAccess(false);

        // Act
        const scope = await resolveTouristAudienceScopeForUser({ userId: USER_ID });

        // Assert
        expect(scope).toEqual([TouristAudienceEnum.PLUS]);
    });

    it('grants plus only when the effective set cannot be read', async () => {
        // Arrange
        mocks.effectiveSet.mockRejectedValue(new Error('effective set unavailable'));

        // Act
        const scope = await resolveTouristAudienceScopeForUser({ userId: USER_ID });

        // Assert
        expect(scope).toEqual([TouristAudienceEnum.PLUS]);
    });
});

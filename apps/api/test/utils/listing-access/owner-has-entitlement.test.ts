/**
 * Unit tests for `ownerHasEntitlement` (HOS-2658, spec §8.5).
 */
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ effectiveSet: vi.fn(), warn: vi.fn() }));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: state.effectiveSet })
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: state.warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { ownerHasEntitlement } from '../../../src/utils/listing-access/owner-has-entitlement';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';

function effectiveSetWith(value: number | undefined) {
    const get = vi.fn(() => value);
    return { set: { entitlements: { get } }, get };
}

describe('ownerHasEntitlement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('answers has:true when the entitlement value is above zero', async () => {
        // Arrange
        const { set, get } = effectiveSetWith(1);
        state.effectiveSet.mockResolvedValue(set);

        // Act
        const result = await ownerHasEntitlement({
            ownerId: OWNER_ID,
            vertical: VerticalEnum.VENUE,
            key: 'can_use_rich_description'
        });

        // Assert
        expect(result).toEqual({ has: true });
        expect(state.effectiveSet).toHaveBeenCalledWith({
            userId: OWNER_ID,
            vertical: VerticalEnum.VENUE
        });
        expect(get).toHaveBeenCalledWith({
            key: 'can_use_rich_description',
            userId: OWNER_ID,
            vertical: VerticalEnum.VENUE
        });
    });

    it('answers has:false when the key is absent', async () => {
        // Arrange
        state.effectiveSet.mockResolvedValue(effectiveSetWith(undefined).set);

        // Act
        const result = await ownerHasEntitlement({
            ownerId: OWNER_ID,
            vertical: VerticalEnum.ACCOMMODATION,
            key: 'can_use_rich_description'
        });

        // Assert
        expect(result).toEqual({ has: false });
    });

    it('fails closed with a warning when the lookup throws', async () => {
        // Arrange
        state.effectiveSet.mockRejectedValue(new Error('cache down'));

        // Act
        const result = await ownerHasEntitlement({
            ownerId: OWNER_ID,
            vertical: VerticalEnum.EXPERIENCE,
            key: 'can_use_rich_description'
        });

        // Assert
        expect(result).toEqual({ has: false });
        expect(state.warn).toHaveBeenCalledWith(
            {
                ownerId: OWNER_ID,
                vertical: VerticalEnum.EXPERIENCE,
                key: 'can_use_rich_description',
                error: 'cache down'
            },
            'owner-has-entitlement: entitlement lookup failed'
        );
    });
});

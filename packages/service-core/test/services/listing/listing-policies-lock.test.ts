/**
 * Unit tests for `readStoredPoliciesForMerge` (HOS-2060): when the `policies`
 * merge reads the stored object under a row lock, and when it falls back to
 * the hook's unlocked pre-read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lockedPolicies = vi.hoisted(() => ({ readForUpdate: vi.fn() }));
vi.mock('@repo/db', () => ({ listingPoliciesModel: lockedPolicies }));

import { readStoredPoliciesForMerge } from '../../../src/services/listing/listing-policies-lock';
import type { ServiceContext } from '../../../src/types';

const TX = { __tx: true } as unknown as NonNullable<ServiceContext['tx']>;
const FALLBACK = { paymentMethods: ['cash'] };

describe('readStoredPoliciesForMerge', () => {
    beforeEach(() => {
        lockedPolicies.readForUpdate.mockReset().mockResolvedValue({
            found: true,
            policies: { paymentMethods: ['cash'], minNights: 3 }
        });
    });

    it('reads under the row lock, in the update tx, when the body sends policies', async () => {
        // Act
        const { stored } = await readStoredPoliciesForMerge({
            vertical: 'venue',
            listingId: 'v-1',
            payload: { policies: { eventsAllowed: true } },
            ctx: { tx: TX },
            fallback: FALLBACK
        });

        // Assert
        expect(lockedPolicies.readForUpdate).toHaveBeenCalledWith({
            tx: TX,
            vertical: 'venue',
            listingId: 'v-1'
        });
        expect(stored).toEqual({ paymentMethods: ['cash'], minNights: 3 });
    });

    it.each([
        ['the body does not send policies', { name: 'x' }, { tx: TX }, 'v-1'],
        ['the body sends policies: undefined', { policies: undefined }, { tx: TX }, 'v-1'],
        ['there is no transaction to hold the lock', { policies: {} }, {}, 'v-1'],
        ['the id is unknown', { policies: {} }, { tx: TX }, undefined]
    ] as const)('uses the pre-read without locking when %s', async (_case, payload, ctx, listingId) => {
        // Act
        const { stored } = await readStoredPoliciesForMerge({
            vertical: 'accommodation',
            listingId,
            payload,
            ctx: ctx as ServiceContext,
            fallback: FALLBACK
        });

        // Assert
        expect(lockedPolicies.readForUpdate).not.toHaveBeenCalled();
        expect(stored).toBe(FALLBACK);
    });

    it('falls back to the pre-read when the locked read finds no row', async () => {
        // Arrange
        lockedPolicies.readForUpdate.mockResolvedValueOnce({ found: false, policies: null });

        // Act
        const { stored } = await readStoredPoliciesForMerge({
            vertical: 'experience',
            listingId: 'e-1',
            payload: { policies: null },
            ctx: { tx: TX },
            fallback: FALLBACK
        });

        // Assert
        expect(stored).toBe(FALLBACK);
    });
});

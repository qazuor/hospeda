/**
 * commerce-listing-subscription-statuses.test.ts
 *
 * Unit tests for `getCommerceListingSubscriptionStatuses` (HOS-166
 * judgment-day W1) — the batched sibling of `getCommerceListingSubscriptionStatus`
 * used by the owner listing index to surface per-listing subscription state
 * (dunning/suspended) without an N+1 query.
 *
 * `@repo/db` is stubbed with a minimal chainable query mock; the real function
 * under test is exercised end-to-end against it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ select: mockSelect })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
    inArray: vi.fn((col: unknown, vals: unknown[]) => ({ type: 'inArray', col, vals })),
    commerceListingSubscriptions: {
        entityType: 'entity_type',
        entityId: 'entity_id',
        status: 'status'
    }
}));

import { getCommerceListingSubscriptionStatuses } from '../../../src/services/commerce/commerce-visibility';

describe('getCommerceListingSubscriptionStatuses', () => {
    beforeEach(() => {
        mockSelect.mockClear();
        mockFrom.mockClear();
        mockWhere.mockReset();
    });

    it('should return an empty Map without querying when entityIds is empty', async () => {
        const result = await getCommerceListingSubscriptionStatuses({
            entityType: 'gastronomy',
            entityIds: []
        });

        expect(result.size).toBe(0);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should map each row to its entityId → status pair', async () => {
        mockWhere.mockResolvedValue([
            { entityId: 'aaaa', status: 'active' },
            { entityId: 'bbbb', status: 'past_due' }
        ]);

        const result = await getCommerceListingSubscriptionStatuses({
            entityType: 'gastronomy',
            entityIds: ['aaaa', 'bbbb', 'cccc']
        });

        expect(result.get('aaaa')).toBe('active');
        expect(result.get('bbbb')).toBe('past_due');
        // 'cccc' never subscribed — absent from the link table, absent from the map.
        expect(result.has('cccc')).toBe(false);
    });

    it('should return an empty Map when no listing in the batch has a subscription row', async () => {
        mockWhere.mockResolvedValue([]);

        const result = await getCommerceListingSubscriptionStatuses({
            entityType: 'experience',
            entityIds: ['aaaa']
        });

        expect(result.size).toBe(0);
    });
});

/**
 * Unit tests for `findOwnerVerticalSubscription` (HOS-934).
 *
 * `getByCustomerId()` never populates `productDomain` on the subscriptions it
 * returns (qzpay-core's mapper builds them field-by-field from the fields
 * `QZPaySubscription` declares, and `productDomain` is a qzpay-drizzle column
 * outside that interface — see `hydrateSubscriptionProductDomains`'s doc in
 * `@repo/service-core`). The fixtures below therefore never set
 * `productDomain` directly — that field is recovered by the batched `SELECT`
 * `hydrateSubscriptionProductDomains` runs, mocked here through `getDb()`
 * (globally mocked in `test/setup.ts`).
 *
 * @module test/services/commerce-subscription-attach.service
 */

import { getDb } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOwnerVerticalSubscription } from '../../src/services/commerce-subscription-attach.service';

/**
 * Configures the mocked `getDb()` to answer
 * `hydrateSubscriptionProductDomains`'s batched recovery `SELECT` with the
 * given id → stored `product_domain` map.
 */
function mockGetDb(productDomains: Record<string, string | null>) {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(
                    Object.entries(productDomains).map(([id, productDomain]) => ({
                        id,
                        productDomain
                    }))
                )
            })
        })
    } as never);
}

/** Builds a QZPay-shaped subscription row WITHOUT `productDomain` (HOS-934). */
function buildSubscription(input: { id: string; status: string }) {
    return { id: input.id, status: input.status };
}

describe('findOwnerVerticalSubscription (HOS-934)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('finds the gastronomy subscription for a gastronomy-only owner, scoped to gastronomy', async () => {
        // Arrange
        const gastronomySub = buildSubscription({ id: 'sub-gastronomy', status: 'active' });
        const getByCustomerId = vi.fn().mockResolvedValue([gastronomySub]);
        mockGetDb({ 'sub-gastronomy': 'gastronomy' });

        // Act
        const match = await findOwnerVerticalSubscription({
            billing: { subscriptions: { getByCustomerId } },
            customerId: 'customer-1',
            vertical: 'gastronomy'
        });

        // Assert
        expect(match?.id).toBe('sub-gastronomy');
    });

    it('does not match a gastronomy-only owner subscription when scoped to experience', async () => {
        // Arrange
        const gastronomySub = buildSubscription({ id: 'sub-gastronomy', status: 'active' });
        const getByCustomerId = vi.fn().mockResolvedValue([gastronomySub]);
        mockGetDb({ 'sub-gastronomy': 'gastronomy' });

        // Act
        const match = await findOwnerVerticalSubscription({
            billing: { subscriptions: { getByCustomerId } },
            customerId: 'customer-1',
            vertical: 'experience'
        });

        // Assert — control against the HOS-934 fail-open bug: without
        // hydration this would incorrectly match under ANY domain.
        expect(match).toBeNull();
    });

    it('(control) still finds an accommodation subscription scoped to accommodation — the fix must not invert the bug', async () => {
        // Arrange
        const accommodationSub = buildSubscription({ id: 'sub-accommodation', status: 'active' });
        const getByCustomerId = vi.fn().mockResolvedValue([accommodationSub]);
        mockGetDb({ 'sub-accommodation': 'accommodation' });

        // Act
        const match = await findOwnerVerticalSubscription({
            billing: { subscriptions: { getByCustomerId } },
            customerId: 'customer-1',
            vertical: 'gastronomy'
        });

        // Assert — an accommodation-only subscription must never satisfy a
        // commerce vertical scope.
        expect(match).toBeNull();
    });
});

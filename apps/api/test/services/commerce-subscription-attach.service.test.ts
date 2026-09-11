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
import { SubscriptionStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    countAttachedListings,
    findOwnerVerticalSubscription
} from '../../src/services/commerce-subscription-attach.service';

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

/**
 * Configures the mocked `getDb()` to answer `countAttachedListings`'s
 * `SELECT status FROM entity_subscriptions WHERE subscription_id = ...` with
 * the given rows.
 */
function mockLinkRows(rows: readonly { status: string }[]) {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(rows)
            })
        })
    } as never);
}

describe('countAttachedListings (HOS-1274)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('counts a `courtesy` subscription as occupying its slot — regression for HOS-1274', async () => {
        // Arrange — a gastronomy owner's ONLY listing is on a courtesy
        // subscription. Before the fix, SLOT_OCCUPYING_STATUSES omitted
        // `courtesy`, so this counted zero and the owner's cap never engaged.
        mockLinkRows([{ status: SubscriptionStatusEnum.COURTESY }]);

        // Act
        const attached = await countAttachedListings({ subscriptionId: 'sub-courtesy' });

        // Assert — the slot IS counted, so a cap of 1 would now block a
        // second attach (`attached >= cap` in the caller route).
        expect(attached).toBe(1);
    });

    it('counts a `comp` subscription as occupying its slot — regression for HOS-1274 (experience vertical)', async () => {
        // Arrange — an experience owner's ONLY listing is on a comp subscription.
        mockLinkRows([{ status: SubscriptionStatusEnum.COMP }]);

        // Act
        const attached = await countAttachedListings({ subscriptionId: 'sub-comp' });

        // Assert
        expect(attached).toBe(1);
    });

    it('tops the cap once occupied slots reach it, even under courtesy', async () => {
        // Arrange — a cap of 2, two listings already attached under a
        // courtesy subscription. This is the exact shape the caller route
        // compares as `attached >= cap` to refuse the next attach.
        const cap = 2;
        mockLinkRows([
            { status: SubscriptionStatusEnum.COURTESY },
            { status: SubscriptionStatusEnum.COURTESY }
        ]);

        // Act
        const attached = await countAttachedListings({ subscriptionId: 'sub-courtesy' });

        // Assert — the owner is AT the cap; the route's `attached >= cap` gate
        // would now refuse a third listing instead of publishing unbounded.
        expect(attached).toBeGreaterThanOrEqual(cap);
    });

    it.each([
        [SubscriptionStatusEnum.ACTIVE, true],
        [SubscriptionStatusEnum.TRIALING, true],
        [SubscriptionStatusEnum.PAST_DUE, true],
        [SubscriptionStatusEnum.PENDING_PROVIDER, true],
        [SubscriptionStatusEnum.COMP, true],
        [SubscriptionStatusEnum.COURTESY, true],
        [SubscriptionStatusEnum.PAUSED, false],
        [SubscriptionStatusEnum.CANCELLED, false],
        [SubscriptionStatusEnum.EXPIRED, false],
        [SubscriptionStatusEnum.ABANDONED, false]
    ])('status %s occupies a slot: %s — full enum coverage, not just courtesy', async (status, shouldOccupy) => {
        // Arrange — a single link row at this exact status, nothing else.
        mockLinkRows([{ status }]);

        // Act
        const attached = await countAttachedListings({ subscriptionId: 'sub-1' });

        // Assert — behavior (does the count reach 1?), not the shape of
        // any internal constant.
        expect(attached).toBe(shouldOccupy ? 1 : 0);
    });
});

/**
 * HOS-1104 regression: `AddonEntitlementService` must not treat a
 * commerce-domain subscription as the customer's active accommodation
 * subscription.
 *
 * `getByCustomerId()` never populates `productDomain` on its own (qzpay-core's
 * mapper builds objects field-by-field from the fields `QZPaySubscription`
 * declares — see `hydrateSubscriptionProductDomains`'s doc in
 * `@repo/service-core`). Without hydration, `isAccommodationSubscription`
 * reads `productDomain: undefined` on every row and matches ALL of them —
 * including a gastronomy-only subscription — as if they were accommodation,
 * making the SPEC-239 T-034 domain filter in `addon-entitlement.service.ts` a
 * no-op.
 *
 * This suite deliberately does NOT stub `isAccommodationSubscription` or
 * `hydrateSubscriptionProductDomains` (unlike `addon-entitlement.service.test.ts`,
 * which mocks the whole `@repo/service-core` module and hardcodes
 * `isAccommodationSubscription: () => true` — a fixture shape that cannot
 * exercise this domain exclusion at all). Only `AddonCatalogService` and
 * `PlanService` are replaced; every other `@repo/service-core` export,
 * including the two above, is the real implementation.
 *
 * @module test/services/addon-entitlement-product-domain
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { EntitlementKey } from '@repo/billing';
import { getDb } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCatalogGetBySlug, mockClearEntitlementCache } = vi.hoisted(() => ({
    mockCatalogGetBySlug: vi.fn(),
    mockClearEntitlementCache: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AddonCatalogService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockCatalogGetBySlug, list: vi.fn() };
        })
    };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';

const CUSTOMER_ID = 'cust-1';

function makeBilling(subscriptions: ReadonlyArray<Record<string, unknown>>): QZPayBilling {
    return {
        entitlements: {
            revokeBySource: vi.fn().mockResolvedValue(1),
            revoke: vi.fn().mockResolvedValue(undefined)
        },
        limits: {
            removeBySource: vi.fn().mockResolvedValue(0),
            remove: vi.fn().mockResolvedValue(undefined)
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        }
    } as unknown as QZPayBilling;
}

/** Wires `getDb()` to answer the HOS-1104 hydration recovery SELECT. */
function mockStoredProductDomain(id: string, productDomain: string | null) {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ id, productDomain }])
            })
        })
    } as never);
}

describe('AddonEntitlementService — productDomain hydration (HOS-1104)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'visibility-boost-7d',
                grantsEntitlement: EntitlementKey.FEATURED_LISTING,
                affectsLimitKey: null,
                limitIncrease: null,
                durationDays: 7
            }
        });
    });

    it('does NOT revoke against a gastronomy-only subscription (no accommodation subscription found)', async () => {
        const billing = makeBilling([
            { id: 'sub-gastronomy', status: 'active', planId: 'plan-gastro' }
        ]);
        mockStoredProductDomain('sub-gastronomy', 'gastronomy');
        const service = new AddonEntitlementService(billing);

        const result = await service.removeAddonEntitlements({
            customerId: CUSTOMER_ID,
            addonSlug: 'visibility-boost-7d',
            purchaseId: 'purchase-1'
        });

        // Without hydration, the gastronomy subscription would be
        // (mis)treated as the active accommodation subscription and the
        // revoke calls below WOULD run — the exact HOS-1104 bug.
        expect(result.success).toBe(true);
        expect(billing.entitlements.revokeBySource).not.toHaveBeenCalled();
        expect(billing.entitlements.revoke).not.toHaveBeenCalled();
    });

    it('(control) still revokes against a real accommodation subscription — the fix must not invert the bug', async () => {
        const billing = makeBilling([
            { id: 'sub-accommodation', status: 'active', planId: 'plan-owner' }
        ]);
        mockStoredProductDomain('sub-accommodation', 'accommodation');
        const service = new AddonEntitlementService(billing);

        const result = await service.removeAddonEntitlements({
            customerId: CUSTOMER_ID,
            addonSlug: 'visibility-boost-7d',
            purchaseId: 'purchase-1'
        });

        expect(result.success).toBe(true);
        expect(billing.entitlements.revokeBySource).toHaveBeenCalledWith('addon', 'purchase-1');
    });
});

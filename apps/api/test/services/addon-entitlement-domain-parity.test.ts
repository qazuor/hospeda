/**
 * HOS-1270 regression: `AddonEntitlementService` must gate the GRANT, the
 * REVOCATION, and the legacy metadata READ of an add-on's entitlements/limits
 * by the ADD-ON's OWN product domain — the same predicate the checkout gate
 * (`addon.checkout.ts`, HOS-1178) already uses — instead of the
 * accommodation-only `isAccommodationSubscription`.
 *
 * Before this fix, a gastronomy/experience owner could pass the checkout
 * domain gate, pay for an add-on, and then:
 *   - never receive the entitlement/limit (grant used
 *     `isAccommodationSubscription`, which never matches a gastronomy-only
 *     subscription);
 *   - never have it revoked on cancellation (same predicate, same miss);
 *   - and, in the DUAL case (an owner who ALSO holds an accommodation
 *     subscription), receive a limit computed off the WRONG plan — the
 *     accommodation one, which does not declare `max_gastronomies` — landing
 *     the cap at `0 + increase` instead of `realGastronomyBase + increase`.
 *     With a large enough existing base, that is a cap that goes DOWN after
 *     a paid purchase.
 *
 * This suite deliberately does NOT stub `subscriptionMatchesDomain` or
 * `hydrateSubscriptionProductDomains` (mirrors
 * `addon-entitlement-product-domain.test.ts`'s HOS-1104 suite) — only
 * `AddonCatalogService` and `PlanService` are replaced. Every other
 * `@repo/service-core` export, including the domain predicate itself, is the
 * real implementation.
 *
 * @module test/services/addon-entitlement-domain-parity
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCatalogGetBySlug, mockPlanGetById, mockPlanGetBySlug, mockClearEntitlementCache } =
    vi.hoisted(() => ({
        mockCatalogGetBySlug: vi.fn(),
        mockPlanGetById: vi.fn(),
        mockPlanGetBySlug: vi.fn(),
        mockClearEntitlementCache: vi.fn()
    }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AddonCatalogService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockCatalogGetBySlug, list: vi.fn() };
        }),
        PlanService: vi.fn().mockImplementation(function () {
            return { getById: mockPlanGetById, getBySlug: mockPlanGetBySlug };
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
            grant: vi.fn().mockResolvedValue(undefined),
            revokeBySource: vi.fn().mockResolvedValue(1),
            revoke: vi.fn().mockResolvedValue(undefined)
        },
        limits: {
            set: vi.fn().mockResolvedValue(undefined),
            removeBySource: vi.fn().mockResolvedValue(1),
            remove: vi.fn().mockResolvedValue(undefined)
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        }
    } as unknown as QZPayBilling;
}

/**
 * Wires the "sum all active addon purchases" query used by
 * `applyAddonEntitlements`'s limit branch. The checkout flow inserts the
 * `billing_addon_purchases` row BEFORE calling `applyAddonEntitlements` (see
 * this service's own docblock), so by the time the grant runs, the row for
 * THIS purchase is already 'active' in the table and must be included here —
 * omitting it (as an empty array) would under-count the real integration by
 * exactly the increase being tested, silently passing a test that a real
 * purchase would still fail.
 */
function mockActiveAddonPurchases(addonSlugs: readonly string[]) {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(addonSlugs.map((addonSlug) => ({ addonSlug })))
            })
        })
    } as never);
}

const GASTRONOMY_ADDON = {
    slug: 'extra-gastronomies-1',
    grantsEntitlement: null,
    affectsLimitKey: LimitKey.MAX_GASTRONOMIES,
    limitIncrease: 1,
    durationDays: null,
    productDomain: ProductDomainEnum.GASTRONOMY
};

const EXPERIENCE_ADDON = {
    slug: 'extra-experiences-1',
    grantsEntitlement: null,
    affectsLimitKey: LimitKey.MAX_EXPERIENCES,
    limitIncrease: 1,
    durationDays: null,
    productDomain: ProductDomainEnum.EXPERIENCE
};

const ACCOMMODATION_ADDON = {
    slug: 'visibility-boost-7d',
    grantsEntitlement: EntitlementKey.FEATURED_LISTING,
    affectsLimitKey: null,
    limitIncrease: null,
    durationDays: 7,
    productDomain: ProductDomainEnum.ACCOMMODATION
};

describe('AddonEntitlementService — domain parity between checkout and grant/revoke/read (HOS-1270)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockActiveAddonPurchases([]);
    });

    describe.each([
        ['gastronomy', GASTRONOMY_ADDON, LimitKey.MAX_GASTRONOMIES],
        ['experience', EXPERIENCE_ADDON, LimitKey.MAX_EXPERIENCES]
    ] as const)('%s owner buys a %s-only add-on', (domain, addon, limitKey) => {
        beforeEach(() => {
            mockCatalogGetBySlug.mockResolvedValue({ success: true, data: addon });
        });

        it('grants the limit increase (used to return NO_ACTIVE_SUBSCRIPTION and grant nothing)', async () => {
            // The checkout flow already inserted this purchase's row (status
            // 'active') before calling applyAddonEntitlements — see the
            // service's own docblock — so the aggregation query must see it.
            mockActiveAddonPurchases([addon.slug]);
            const billing = makeBilling([
                {
                    id: `sub-${domain}`,
                    status: 'active',
                    planId: 'plan-vertical',
                    productDomain: domain
                }
            ]);
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not by id' }
            });
            mockPlanGetBySlug.mockResolvedValue({
                success: true,
                data: { limits: { [limitKey]: 2 } }
            });
            const service = new AddonEntitlementService(billing);

            const result = await service.applyAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: addon.slug,
                purchaseId: 'purchase-1'
            });

            expect(result.success).toBe(true);
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ customerId: CUSTOMER_ID, limitKey, maxValue: 3 })
            );
        });

        it('revokes the limit on cancellation (used to silently skip revocation)', async () => {
            const billing = makeBilling([
                {
                    id: `sub-${domain}`,
                    status: 'active',
                    planId: 'plan-vertical',
                    productDomain: domain
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.removeAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: addon.slug,
                purchaseId: 'purchase-1'
            });

            expect(result.success).toBe(true);
            expect(billing.limits.removeBySource).toHaveBeenCalledWith('addon', 'purchase-1');
        });
    });

    describe('dual-domain owner (accommodation AND gastronomy) — the worse sub-case', () => {
        beforeEach(() => {
            mockCatalogGetBySlug.mockResolvedValue({ success: true, data: GASTRONOMY_ADDON });
        });

        it('resolves the base limit from the GASTRONOMY plan, not the accommodation one (cap must not drop)', async () => {
            mockActiveAddonPurchases([GASTRONOMY_ADDON.slug]);
            const billing = makeBilling([
                {
                    id: 'sub-accommodation',
                    status: 'active',
                    planId: 'plan-owner',
                    productDomain: 'accommodation'
                },
                {
                    id: 'sub-gastronomy',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy'
                }
            ]);

            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not by id' }
            });
            mockPlanGetBySlug.mockImplementation(async (slug: string) => {
                if (slug === 'plan-owner') {
                    // The accommodation plan does NOT declare max_gastronomies —
                    // exactly the plan the pre-fix code would have picked.
                    return { success: true, data: { limits: { max_accommodations: 1 } } };
                }
                if (slug === 'plan-gastro') {
                    return {
                        success: true,
                        data: { limits: { [LimitKey.MAX_GASTRONOMIES]: 5 } }
                    };
                }
                return { success: false, error: { code: 'NOT_FOUND', message: slug } };
            });

            const service = new AddonEntitlementService(billing);

            const result = await service.applyAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: GASTRONOMY_ADDON.slug,
                purchaseId: 'purchase-dual'
            });

            expect(result.success).toBe(true);
            // Correct: base 5 (gastronomy plan) + increase 1 = 6.
            // The pre-fix bug would resolve base 0 (accommodation plan has no
            // max_gastronomies key) + 1 = 1 — a DROP for any owner whose real
            // cap was already above 1.
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    limitKey: LimitKey.MAX_GASTRONOMIES,
                    maxValue: 6
                })
            );
        });
    });

    describe('control: accommodation owner is unaffected by the fix', () => {
        beforeEach(() => {
            mockCatalogGetBySlug.mockResolvedValue({ success: true, data: ACCOMMODATION_ADDON });
        });

        it('still grants the entitlement for a plain accommodation subscription', async () => {
            const billing = makeBilling([
                {
                    id: 'sub-accommodation',
                    status: 'active',
                    planId: 'plan-owner',
                    productDomain: 'accommodation'
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.applyAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: ACCOMMODATION_ADDON.slug,
                purchaseId: 'purchase-acc'
            });

            expect(result.success).toBe(true);
            expect(billing.entitlements.grant).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    entitlementKey: EntitlementKey.FEATURED_LISTING
                })
            );
        });

        it('still revokes the entitlement for a plain accommodation subscription', async () => {
            const billing = makeBilling([
                {
                    id: 'sub-accommodation',
                    status: 'active',
                    planId: 'plan-owner',
                    productDomain: 'accommodation'
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.removeAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: ACCOMMODATION_ADDON.slug,
                purchaseId: 'purchase-acc'
            });

            expect(result.success).toBe(true);
            expect(billing.entitlements.revokeBySource).toHaveBeenCalledWith(
                'addon',
                'purchase-acc'
            );
        });

        it('does NOT grant an accommodation add-on to a gastronomy-only subscription (fix must not invert the bug)', async () => {
            const billing = makeBilling([
                {
                    id: 'sub-gastronomy',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy'
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.applyAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: ACCOMMODATION_ADDON.slug,
                purchaseId: 'purchase-acc'
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
            expect(billing.entitlements.grant).not.toHaveBeenCalled();
        });
    });

    describe('fails closed when the addon has no declared product domain', () => {
        it('applyAddonEntitlements refuses rather than defaulting to accommodation', async () => {
            mockCatalogGetBySlug.mockResolvedValue({
                success: true,
                data: { ...GASTRONOMY_ADDON, productDomain: undefined }
            });
            const billing = makeBilling([
                {
                    id: 'sub-gastronomy',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy'
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.applyAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: GASTRONOMY_ADDON.slug,
                purchaseId: 'purchase-1'
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('ADDON_DOMAIN_UNKNOWN');
            expect(billing.limits.set).not.toHaveBeenCalled();
        });

        it('removeAddonEntitlements refuses rather than defaulting to accommodation', async () => {
            mockCatalogGetBySlug.mockResolvedValue({
                success: true,
                data: { ...GASTRONOMY_ADDON, productDomain: undefined }
            });
            const billing = makeBilling([
                {
                    id: 'sub-gastronomy',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy'
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.removeAddonEntitlements({
                customerId: CUSTOMER_ID,
                addonSlug: GASTRONOMY_ADDON.slug,
                purchaseId: 'purchase-1'
            });

            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('ADDON_DOMAIN_UNKNOWN');
            expect(billing.limits.removeBySource).not.toHaveBeenCalled();
        });
    });

    describe('getCustomerAddonAdjustments — legacy metadata read is not accommodation-scoped', () => {
        it('reads legacy addonAdjustments metadata off a gastronomy-only subscription', async () => {
            // The billing_addon_purchases TABLE read returns nothing — forcing
            // the result to come entirely from the legacy metadata fallback.
            vi.mocked(getDb).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            } as never);

            const legacyAdjustment = {
                addonSlug: 'extra-gastronomies-1',
                limitKey: LimitKey.MAX_GASTRONOMIES,
                limitIncrease: 1,
                appliedAt: new Date().toISOString()
            };

            const billing = makeBilling([
                {
                    id: 'sub-gastronomy',
                    status: 'active',
                    planId: 'plan-gastro',
                    productDomain: 'gastronomy',
                    metadata: { addonAdjustments: JSON.stringify([legacyAdjustment]) }
                }
            ]);
            const service = new AddonEntitlementService(billing);

            const result = await service.getCustomerAddonAdjustments(CUSTOMER_ID);

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toContainEqual(legacyAdjustment);
        });
    });
});

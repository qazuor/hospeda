/**
 * Parity regression test for addon.checkout.ts catalog cutover (SPEC-127 T-004)
 *
 * Verifies that both `createAddonCheckout` and `confirmAddonPurchase` resolve
 * addon definitions via the DB-backed `AddonCatalogService.getBySlug()` instead
 * of the static `getAddonBySlug` from `@repo/billing` (config catalog).
 *
 * Assertions for each entry point:
 * 1. `AddonCatalogService.getBySlug` is called with the input addon slug.
 * 2. `getAddonBySlug` from `@repo/billing` is NEVER called (mock present, must
 *    stay silent — behavioral regression guard against revert to config reads).
 * 3. NOT_FOUND from the service maps to `{ code: 'NOT_FOUND' }`.
 *
 * No real database or MercadoPago calls. All external dependencies are mocked.
 *
 * @module test/services/addon.checkout.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockAddonCatalogGetBySlug, mockGetAddonBySlug } = vi.hoisted(() => ({
    mockAddonCatalogGetBySlug: vi.fn(),
    mockGetAddonBySlug: vi.fn()
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

// NON-NEGOTIABLE: importOriginal spread is required to preserve RoleEnum and
// other symbols used transitively via src/middlewares/entitlement.ts. A bare
// mock kills those imports and causes runtime errors.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AddonCatalogService: vi.fn().mockImplementation(() => ({
            getBySlug: mockAddonCatalogGetBySlug
        })),
        PlanService: vi.fn().mockImplementation(() => ({
            getById: vi.fn().mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } }),
            getBySlug: vi.fn().mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } })
        }))
    };
});

// getAddonBySlug must NOT be called after cutover.
// Its presence here is a behavioral regression guard — if the source ever reverts
// to importing from @repo/billing, this mock will intercept the call and the
// `not.toHaveBeenCalled()` assertions below will fail.
vi.mock('@repo/billing', () => ({
    getAddonBySlug: mockGetAddonBySlug
}));

vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({
        transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
            cb({
                insert: vi.fn(() => ({
                    values: vi.fn(() => ({
                        returning: vi.fn().mockResolvedValue([{ id: 'p-cutover-uuid' }])
                    }))
                })),
                execute: vi.fn().mockResolvedValue({ rows: [] })
            })
        )
    })),
    withTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
            insert: vi.fn(() => ({
                values: vi.fn(() => ({
                    returning: vi.fn().mockResolvedValue([{ id: 'p-cutover-uuid' }])
                }))
            })),
            execute: vi.fn().mockResolvedValue({ rows: [] })
        })
    )
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customerId',
        subscriptionId: 'subscriptionId',
        addonSlug: 'addonSlug',
        status: 'status',
        purchasedAt: 'purchasedAt',
        expiresAt: 'expiresAt',
        paymentId: 'paymentId',
        limitAdjustments: 'limitAdjustments',
        entitlementAdjustments: 'entitlementAdjustments',
        metadata: 'metadata',
        deletedAt: 'deletedAt'
    }
}));

vi.mock('mercadopago', () => ({
    MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
    Preference: vi.fn().mockImplementation(() => ({
        create: vi.fn().mockResolvedValue({
            id: 'pref_cutover_test',
            init_point: 'https://www.mercadopago.com.ar/checkout/cutover',
            sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/cutover'
        })
    }))
}));

vi.mock('node:crypto', async () => {
    const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
    return { ...actual, randomUUID: vi.fn(() => 'cutover-uuid-0000-0000-0000-000000000000') };
});

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-cutover-token',
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/services/promo-code.service', () => ({
    PromoCodeService: vi.fn().mockImplementation(() => ({
        validate: vi.fn().mockResolvedValue({ valid: true, discountAmount: 0 }),
        getByCode: vi.fn().mockResolvedValue({ success: true, data: { id: 'promo_uuid' } })
    }))
}));

// Import after all mocks
import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { ConfirmPurchaseInput, PurchaseAddonInput } from '@repo/service-core';
import type { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { confirmAddonPurchase, createAddonCheckout } from '../../src/services/addon.checkout';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUB_ADDON = {
    slug: 'extra-photos-20',
    name: 'Extra Photos 20',
    description: 'Add 20 extra photos',
    billingType: 'recurring' as const,
    priceArs: 5000,
    annualPriceArs: null,
    durationDays: null,
    isActive: true,
    targetCategories: ['owner'] as Array<'owner' | 'complex'>,
    sortOrder: 1,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 20,
    grantsEntitlement: null
};

function makeBillingForCheckout(): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: 'cust_cutover',
                email: 'cutover@example.com',
                metadata: { name: 'Cutover Test' }
            })
        },
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([{ id: 'sub_cutover', status: 'active', planId: 'plan_basico' }])
        }
    } as unknown as QZPayBilling;
}

function makeBillingForConfirm(): QZPayBilling {
    return {
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([{ id: 'sub_cutover', status: 'active', planId: 'plan_basico' }])
        }
    } as unknown as QZPayBilling;
}

function makeEntitlementService(): AddonEntitlementService {
    return {
        applyAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        getCustomerAddonAdjustments: vi.fn().mockResolvedValue({ success: true, data: [] })
    } as unknown as AddonEntitlementService;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon.checkout.ts catalog cutover parity (SPEC-127 T-004)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAddonCatalogGetBySlug.mockReset();
        mockGetAddonBySlug.mockReset();
    });

    // =========================================================================
    // createAddonCheckout
    // =========================================================================

    describe('createAddonCheckout — addon resolution via AddonCatalogService.getBySlug', () => {
        const input: PurchaseAddonInput = {
            customerId: 'cust_cutover',
            addonSlug: 'extra-photos-20',
            userId: 'user_cutover'
        };

        it('should call AddonCatalogService.getBySlug with the input slug', async () => {
            // Arrange
            mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: STUB_ADDON });

            // Act
            await createAddonCheckout(makeBillingForCheckout(), input);

            // Assert — DB catalog consulted, not config getAddonBySlug
            expect(mockAddonCatalogGetBySlug).toHaveBeenCalledWith('extra-photos-20');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should return { code: NOT_FOUND } when AddonCatalogService.getBySlug returns NOT_FOUND', async () => {
            // Arrange
            mockAddonCatalogGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'extra-photos-20' not found" }
            });

            // Act
            const result = await createAddonCheckout(makeBillingForCheckout(), input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(mockAddonCatalogGetBySlug).toHaveBeenCalledWith('extra-photos-20');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // confirmAddonPurchase
    // =========================================================================

    describe('confirmAddonPurchase — addon resolution via AddonCatalogService.getBySlug', () => {
        const input: ConfirmPurchaseInput = {
            customerId: 'cust_cutover',
            addonSlug: 'extra-photos-20',
            paymentId: 'pay_cutover'
        };

        it('should call AddonCatalogService.getBySlug with the input slug', async () => {
            // Arrange
            mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: STUB_ADDON });

            // Act
            await confirmAddonPurchase(makeBillingForConfirm(), makeEntitlementService(), input);

            // Assert — DB catalog consulted, not config getAddonBySlug
            expect(mockAddonCatalogGetBySlug).toHaveBeenCalledWith('extra-photos-20');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should return { code: NOT_FOUND } when AddonCatalogService.getBySlug returns NOT_FOUND', async () => {
            // Arrange
            mockAddonCatalogGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'extra-photos-20' not found" }
            });

            // Act
            const result = await confirmAddonPurchase(
                makeBillingForConfirm(),
                makeEntitlementService(),
                input
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(mockAddonCatalogGetBySlug).toHaveBeenCalledWith('extra-photos-20');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });
    });
});

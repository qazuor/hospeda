/**
 * Tests for addon.checkout services:
 *
 * - `createAddonCheckout` — SPEC-109 Phase 1: verifies the MercadoPago preference
 *   payload includes the quality-checklist fields (`payer.email`, `payer.first_name`,
 *   `payer.last_name`, `items[].category_id`) required for production approval.
 *
 * - `confirmAddonPurchase` — T-013: verifies purchaseId propagation, unique
 *   constraint handling, subscription re-check, and pre-condition guards.
 *
 * @module test/services/addon.checkout.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { ConfirmPurchaseInput, PurchaseAddonInput } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { confirmAddonPurchase, createAddonCheckout } from '../../src/services/addon.checkout';

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------

/**
 * Hoisted mock functions for DB chain and schemas.
 * Using vi.hoisted ensures these are available before vi.mock factory runs.
 */
const {
    mockDbTransaction,
    mockWithTransaction,
    mockDbInsertReturning,
    mockDbInsertValues,
    mockBillingAddonPurchasesTable
} = vi.hoisted(() => {
    // returning() chain: insert() -> values() -> returning()
    const mockDbInsertReturning = vi.fn().mockResolvedValue([{ id: 'purchase_uuid_abc' }]);
    const mockDbInsertValues = vi.fn(() => ({ returning: mockDbInsertReturning }));
    const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }));

    // SPEC-064: tx.execute() is used for SELECT FOR UPDATE dedup check inside the transaction.
    // Return empty rows to indicate no existing active purchase (allow insert).
    const mockTxExecute = vi.fn().mockResolvedValue({ rows: [] });

    // transaction() wraps insert; callback receives tx with insert + execute (SPEC-064)
    const mockDbTransaction = vi.fn(
        async (
            callback: (tx: {
                insert: typeof mockDbInsert;
                execute: typeof mockTxExecute;
            }) => Promise<unknown>
        ) => {
            return callback({ insert: mockDbInsert, execute: mockTxExecute });
        }
    );

    // SPEC-064: withTransaction replaces db.transaction() for atomic operations.
    const mockWithTransaction = vi.fn(
        async (
            callback: (tx: {
                insert: typeof mockDbInsert;
                execute: typeof mockTxExecute;
            }) => Promise<unknown>,
            existingTx?: unknown
        ) => {
            if (existingTx)
                return callback(
                    existingTx as { insert: typeof mockDbInsert; execute: typeof mockTxExecute }
                );
            return mockDbTransaction(callback);
        }
    );

    const mockBillingAddonPurchasesTable = {
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
        deletedAt: 'deleted_at'
    };

    return {
        mockDbTransaction,
        mockWithTransaction,
        mockDbInsertReturning,
        mockDbInsertValues,
        mockBillingAddonPurchasesTable
    };
});

// Mock @repo/db/client - dynamic import used inside confirmAddonPurchase
vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({
        transaction: mockDbTransaction
    })),
    // SPEC-064: withTransaction wraps the DB insert in an atomic transaction
    withTransaction: mockWithTransaction
}));

// Mock @repo/db/schemas/billing - dynamic import used inside confirmAddonPurchase
vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: mockBillingAddonPurchasesTable
}));

// Mock @repo/billing to provide a known addon definition and an empty plan list.
// ALL_PLANS is imported at the top level of addon.checkout.ts and must be present
// in the mock to avoid a TypeError when confirmAddonPurchase calls ALL_PLANS.find().
// An empty array is sufficient because the code uses optional chaining when
// accessing plan limits (canonicalPlan?.limits.find(...)).
vi.mock('@repo/billing', () => ({
    ALL_PLANS: [],
    getAddonBySlug: vi.fn((slug: string) => {
        if (slug === 'extra-photos-20') {
            return {
                slug: 'extra-photos-20',
                name: 'Extra Photos 20',
                description: 'Add 20 extra photos',
                billingType: 'recurring' as const,
                priceArs: 5000,
                durationDays: null,
                isActive: true,
                targetCategories: ['owner'] as const,
                sortOrder: 1,
                affectsLimitKey: 'max_photos_per_accommodation',
                limitIncrease: 20,
                grantsEntitlement: null
            };
        }
        if (slug === 'visibility-boost-7d') {
            return {
                slug: 'visibility-boost-7d',
                name: 'Visibility Boost 7d',
                description: 'Boost visibility for 7 days',
                billingType: 'one_time' as const,
                priceArs: 3000,
                durationDays: 7,
                isActive: true,
                targetCategories: ['owner', 'complex'] as const,
                sortOrder: 2,
                affectsLimitKey: null,
                limitIncrease: null,
                grantsEntitlement: 'featured_listing'
            };
        }
        return null;
    })
}));

// Mock logger to suppress output in tests
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// SPEC-109 Phase 1: capture the MercadoPago preference body to assert on the
// quality-checklist fields (`payer`, `items[].category_id`) without making a
// real HTTP call.
const { mockPreferenceCreate } = vi.hoisted(() => ({
    mockPreferenceCreate: vi.fn().mockResolvedValue({
        id: 'pref_test_123',
        init_point: 'https://www.mercadopago.com.ar/checkout/test',
        sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/test'
    })
}));

vi.mock('mercadopago', () => ({
    MercadoPagoConfig: vi.fn().mockImplementation((opts: { accessToken: string }) => ({
        accessToken: opts.accessToken
    })),
    Preference: vi.fn().mockImplementation(() => ({
        create: mockPreferenceCreate
    }))
}));

// SPEC-109 Phase 1: deterministic UUID for external_reference / idempotency key
// assertions. The default returns a stable value; individual tests can override
// via `mockRandomUUID.mockReturnValueOnce(...)`.
const { mockRandomUUID } = vi.hoisted(() => ({
    mockRandomUUID: vi.fn<() => string>(() => '11111111-2222-3333-4444-555555555555')
}));

vi.mock('node:crypto', async () => {
    const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
    return {
        ...actual,
        randomUUID: mockRandomUUID
    };
});

// SPEC-109 Phase 1: env values consumed by createAddonCheckout for the MP call,
// the checkout return URLs, the webhook notification URL, and the statement
// descriptor shown on the cardholder's bank statement.
vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-test-token',
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

// PromoCodeService is constructed inside createAddonCheckout. Stub it so the
// happy path skips real DB lookups.
vi.mock('../../src/services/promo-code.service', () => ({
    PromoCodeService: vi.fn().mockImplementation(() => ({
        validate: vi.fn().mockResolvedValue({ valid: true, discountAmount: 0 }),
        getByCode: vi.fn().mockResolvedValue({ success: true, data: { id: 'promo_uuid' } })
    }))
}));

// SPEC-127 T-001: PlanService mock — prepared for the T-002 fix that replaces
// ALL_PLANS.find(slug===planId) with dual-resolve via PlanService.getById +
// getBySlug fallback (see addon-plan-change.service.ts:66 for the pattern).
// addon.checkout.ts does NOT yet import @repo/service-core, so this mock has
// no effect on current code. Once T-002 wires in PlanService, the tests below
// will use these mocks to supply plan data for UUID planIds.
const { mockPlanServiceGetById, mockPlanServiceGetBySlug } = vi.hoisted(() => ({
    mockPlanServiceGetById: vi.fn(),
    mockPlanServiceGetBySlug: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PlanService: vi.fn().mockImplementation(() => ({
            getById: mockPlanServiceGetById,
            getBySlug: mockPlanServiceGetBySlug
        }))
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock of AddonEntitlementService with only the methods
 * exercised by confirmAddonPurchase.
 */
function createMockEntitlementService(): AddonEntitlementService {
    return {
        applyAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        getCustomerAddonAdjustments: vi.fn().mockResolvedValue({ success: true, data: [] })
    } as unknown as AddonEntitlementService;
}

/**
 * Creates a minimal mock of QZPayBilling with the subscription/plan methods
 * used by confirmAddonPurchase.
 */
function createMockBilling(
    subscriptions: Array<{ id: string; status: string; planId: string }>
): QZPayBilling {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        },
        plans: {
            get: vi.fn().mockResolvedValue({
                id: 'plan_basico',
                limits: { max_photos_per_accommodation: 5 }
            })
        }
    } as unknown as QZPayBilling;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('confirmAddonPurchase', () => {
    let mockBilling: QZPayBilling;
    let mockEntitlementService: AddonEntitlementService;

    const defaultInput: ConfirmPurchaseInput = {
        customerId: 'cust_abc',
        addonSlug: 'extra-photos-20',
        paymentId: 'pay_xyz'
    };

    const activeSubscriptions = [{ id: 'sub_001', status: 'active', planId: 'plan_basico' }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockBilling = createMockBilling(activeSubscriptions);
        mockEntitlementService = createMockEntitlementService();

        // Default PlanService mocks: NOT_FOUND for both lookups → soft-skip with previousValue = 0.
        // Tests that need a resolved plan override these individually.
        mockPlanServiceGetById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });

        // Reset default: successful insert returning a known purchaseId
        mockDbInsertReturning.mockResolvedValue([{ id: 'purchase_uuid_abc' }]);

        // Restore mockDbTransaction after clearAllMocks.
        // SPEC-064: tx must have both insert() and execute() (for SELECT FOR UPDATE dedup check).
        mockDbTransaction.mockImplementation(
            async (
                callback: (tx: {
                    insert: ReturnType<typeof vi.fn>;
                    execute: ReturnType<typeof vi.fn>;
                }) => Promise<unknown>
            ) => {
                const mockInsert = vi.fn(() => ({ values: mockDbInsertValues }));
                const mockExecute = vi.fn().mockResolvedValue({ rows: [] }); // no duplicate → allow insert
                mockDbInsertValues.mockReturnValue({ returning: mockDbInsertReturning });
                return callback({ insert: mockInsert, execute: mockExecute });
            }
        );

        // Restore mockWithTransaction (SPEC-064) after clearAllMocks.
        mockWithTransaction.mockImplementation(
            async (
                callback: (tx: {
                    insert: ReturnType<typeof vi.fn>;
                    execute: ReturnType<typeof vi.fn>;
                }) => Promise<unknown>,
                existingTx?: unknown
            ) => {
                if (existingTx)
                    return callback(
                        existingTx as {
                            insert: ReturnType<typeof vi.fn>;
                            execute: ReturnType<typeof vi.fn>;
                        }
                    );
                return mockDbTransaction(callback);
            }
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-013: purchaseId is captured and forwarded to applyAddonEntitlements
    // =========================================================================

    describe('purchaseId propagation', () => {
        it('should pass the purchaseId returned by DB insert to applyAddonEntitlements', async () => {
            // Arrange
            const expectedPurchaseId = 'purchase_uuid_abc';
            mockDbInsertReturning.mockResolvedValue([{ id: expectedPurchaseId }]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(true);
            expect(mockEntitlementService.applyAddonEntitlements).toHaveBeenCalledOnce();
            expect(mockEntitlementService.applyAddonEntitlements).toHaveBeenCalledWith({
                customerId: defaultInput.customerId,
                addonSlug: defaultInput.addonSlug,
                purchaseId: expectedPurchaseId
            });
        });

        it('should forward a different purchaseId when the DB returns a different UUID', async () => {
            // Arrange
            const expectedPurchaseId = '11111111-2222-3333-4444-555555555555';
            mockDbInsertReturning.mockResolvedValue([{ id: expectedPurchaseId }]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(true);
            expect(mockEntitlementService.applyAddonEntitlements).toHaveBeenCalledWith(
                expect.objectContaining({ purchaseId: expectedPurchaseId })
            );
        });

        it('should return INTERNAL_ERROR when the insert returns an empty array', async () => {
            // Arrange - empty returning() simulates an unexpected DB response
            mockDbInsertReturning.mockResolvedValue([]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toContain('Failed to insert add-on purchase record');
            // applyAddonEntitlements must NOT be called when insert fails
            expect(mockEntitlementService.applyAddonEntitlements).not.toHaveBeenCalled();
        });

        it('should still succeed (non-fatal) when applyAddonEntitlements fails after a successful insert', async () => {
            // Arrange - insert succeeds but entitlement application fails
            vi.mocked(mockEntitlementService.applyAddonEntitlements).mockResolvedValue({
                success: false,
                error: { code: 'ENTITLEMENT_ERROR', message: 'QZPay unavailable' }
            });

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert - table insert is the primary source of truth; entitlement failure is a warning
            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // T-013: Unique constraint violation (23505) handling
    // =========================================================================

    describe('unique constraint violation handling', () => {
        it('should return ADDON_ALREADY_ACTIVE when Postgres throws a 23505 unique violation', async () => {
            // Arrange - simulate Postgres unique constraint error
            const constraintError = Object.assign(
                new Error('duplicate key value violates unique constraint'),
                {
                    code: '23505'
                }
            );
            mockDbTransaction.mockRejectedValue(constraintError);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ADDON_ALREADY_ACTIVE');
            expect(result.error?.message).toBe('Addon already active for this customer');
        });

        it('should NOT call applyAddonEntitlements when a 23505 violation occurs', async () => {
            // Arrange
            const constraintError = Object.assign(new Error('duplicate key'), { code: '23505' });
            mockDbTransaction.mockRejectedValue(constraintError);

            // Act
            await confirmAddonPurchase(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(mockEntitlementService.applyAddonEntitlements).not.toHaveBeenCalled();
        });

        it('should re-throw and return INTERNAL_ERROR for non-constraint DB errors', async () => {
            // Arrange - a DB error without code '23505' should bubble up
            const genericDbError = new Error('connection timeout');
            mockDbTransaction.mockRejectedValue(genericDbError);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert - outer catch converts it to INTERNAL_ERROR
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toContain('Failed to confirm add-on purchase');
        });

        it('should return ADDON_ALREADY_ACTIVE even for trialing subscriptions', async () => {
            // Arrange
            mockBilling = createMockBilling([
                { id: 'sub_trial', status: 'trialing', planId: 'plan_basico' }
            ]);
            const constraintError = Object.assign(new Error('duplicate key'), { code: '23505' });
            mockDbTransaction.mockRejectedValue(constraintError);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ADDON_ALREADY_ACTIVE');
        });
    });

    // =========================================================================
    // Pre-condition guard tests
    // =========================================================================

    describe('pre-condition guards', () => {
        it('should return NOT_FOUND when add-on slug does not exist', async () => {
            // Act
            const result = await confirmAddonPurchase(mockBilling, mockEntitlementService, {
                ...defaultInput,
                addonSlug: 'non-existent-addon'
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return NO_SUBSCRIPTION when customer has no subscriptions', async () => {
            // Arrange
            mockBilling = createMockBilling([]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_SUBSCRIPTION');
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });

        it('should return NO_ACTIVE_SUBSCRIPTION when only canceled subscriptions exist', async () => {
            // Arrange
            mockBilling = createMockBilling([
                { id: 'sub_001', status: 'canceled', planId: 'plan_basico' }
            ]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_ACTIVE_SUBSCRIPTION');
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });

        it('should still succeed when the subscription planId cannot be resolved by PlanService', async () => {
            // G-025 (updated for SPEC-127 T-002): confirmAddonPurchase resolves plan limits via
            // PlanService (DB-backed, dual-resolve). When both getById and getBySlug fail for the
            // planId, the code falls back to previousValue = 0 via optional chaining and continues
            // normally. An unresolvable planId is not a fatal error — purchase proceeds.

            // Arrange - make both PlanService lookups return failure
            mockPlanServiceGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND' }
            });
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND' }
            });

            // Act - activeSubscription has planId: 'plan_basico' which PlanService cannot resolve
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert - purchase proceeds with previousValue = 0 for limit adjustments
            expect(result.success).toBe(true);
            expect(mockDbTransaction).toHaveBeenCalledOnce();
        });

        it('should accept trialing subscriptions as valid for purchase', async () => {
            // Arrange
            mockBilling = createMockBilling([
                { id: 'sub_trial', status: 'trialing', planId: 'plan_basico' }
            ]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(true);
            expect(mockDbTransaction).toHaveBeenCalledOnce();
        });

        // SPEC-127 T-001 regression: dual-resolve planId (UUID vs slug)
        it('should record limitAdjustments with plan baseline when planId is a UUID (not a slug)', async () => {
            // Arrange
            // Post-SPEC-168: subscriptions may carry a billing_plans UUID as planId.
            // The owner-basico plan has max_photos_per_accommodation = 5 baseline.
            // extra-photos-20 has limitIncrease = 20, so expectedNewValue = 5 + 20 = 25.
            // Bug: ALL_PLANS.find(p => p.slug === uuid) returns undefined →
            //   previousValue falls back to 0 → newValue = 0 + 20 = 20 (WRONG).
            // Fix will use PlanService.getById(uuid) → correct baseline.
            const planUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            mockBilling = createMockBilling([
                { id: 'sub_uuid', status: 'active', planId: planUuid }
            ]);

            // PlanService.getById will return the plan with the correct baseline limit.
            // BillingPlanResponse.limits is Record<string, number> (DB shape, not LimitDefinition[]).
            mockPlanServiceGetById.mockResolvedValue({
                success: true,
                data: {
                    id: planUuid,
                    slug: 'owner-basico',
                    category: 'owner',
                    limits: { max_photos_per_accommodation: 5 }
                }
            });
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND' }
            });

            mockDbInsertReturning.mockResolvedValue([{ id: 'purchase_uuid_limit_test' }]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert — purchase must succeed
            expect(result.success).toBe(true);

            // The values passed to the DB insert must reflect the real plan baseline (5),
            // not the fallback-to-zero that happens when the UUID planId is unresolved.
            expect(mockDbInsertValues).toHaveBeenCalledOnce();
            const calls = mockDbInsertValues.mock.calls as unknown as Array<[unknown]>;
            const insertedValues = calls[0]![0] as {
                limitAdjustments: Array<{
                    limitKey: string;
                    increase: number;
                    previousValue: number;
                    newValue: number;
                }>;
            };
            expect(insertedValues.limitAdjustments).toHaveLength(1);
            expect(insertedValues.limitAdjustments[0]).toMatchObject({
                limitKey: 'max_photos_per_accommodation',
                increase: 20,
                previousValue: 5,
                newValue: 25
            });
        });
    });

    // =========================================================================
    // T-013 GAP-038-41: Transaction rollback simulation
    // =========================================================================

    describe('entitlement service throw after successful insert', () => {
        it('should return INTERNAL_ERROR when applyAddonEntitlements throws after insert succeeds', async () => {
            // Arrange - insert succeeds and returns a purchaseId, but entitlement service throws
            // (not returns failure — throws an unhandled exception).
            //
            // Implementation note: confirmAddonPurchase wraps the whole operation in a try/catch.
            // When applyAddonEntitlements() throws (as opposed to returning { success: false }),
            // the outer catch converts it to INTERNAL_ERROR. The DB row IS committed because the
            // inner transaction completed before the throw; however the outer function cannot
            // distinguish between a DB failure and an entitlement throw at the top-level catch,
            // so it surfaces INTERNAL_ERROR.
            //
            // Contrast with the "non-fatal result path" test (return { success: false }) above,
            // which keeps success: true because the service explicitly handles the Result type.
            mockDbInsertReturning.mockResolvedValue([{ id: 'purchase_throw_uuid' }]);
            vi.mocked(mockEntitlementService.applyAddonEntitlements).mockRejectedValue(
                new Error('QZPay network error after insert')
            );

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert - the outer catch surfaces INTERNAL_ERROR (not success)
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toContain('Failed to confirm add-on purchase');

            // The DB insert was attempted before the throw
            expect(mockDbTransaction).toHaveBeenCalledOnce();

            // applyAddonEntitlements was called (and threw)
            expect(mockEntitlementService.applyAddonEntitlements).toHaveBeenCalledOnce();
        });
    });

    // =========================================================================
    // Entitlement add-on (grantsEntitlement path)
    // =========================================================================

    describe('entitlement add-on path (visibility-boost-7d)', () => {
        it('should forward purchaseId to applyAddonEntitlements for entitlement-type addons', async () => {
            // Arrange
            const expectedPurchaseId = 'purchase_boost_uuid';
            mockDbInsertReturning.mockResolvedValue([{ id: expectedPurchaseId }]);

            // Act
            const result = await confirmAddonPurchase(mockBilling, mockEntitlementService, {
                ...defaultInput,
                addonSlug: 'visibility-boost-7d'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockEntitlementService.applyAddonEntitlements).toHaveBeenCalledWith({
                customerId: defaultInput.customerId,
                addonSlug: 'visibility-boost-7d',
                purchaseId: expectedPurchaseId
            });
        });
    });

    // =========================================================================
    // GAP-043-57: Subscription re-check regression tests
    // Subscription could be cancelled between checkout creation and confirmation.
    // =========================================================================

    describe('subscription re-check before DB insert (GAP-043-57)', () => {
        it('should return SUBSCRIPTION_CANCELLED when subscription is cancelled between checkout and confirmation', async () => {
            // Arrange: initial check returns active, re-check (second call) returns cancelled
            const billingWithCancelledRecheck = {
                subscriptions: {
                    getByCustomerId: vi
                        .fn()
                        .mockResolvedValueOnce([
                            { id: 'sub_001', status: 'active', planId: 'plan_basico' }
                        ])
                        .mockResolvedValueOnce([
                            { id: 'sub_001', status: 'canceled', planId: 'plan_basico' }
                        ])
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ id: 'plan_basico' })
                }
            } as unknown as import('@qazuor/qzpay-core').QZPayBilling;

            // Act
            const result = await confirmAddonPurchase(
                billingWithCancelledRecheck,
                mockEntitlementService,
                defaultInput
            );

            // Assert: rejected before the DB insert even runs
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SUBSCRIPTION_CANCELLED');
            expect(result.error?.message).toContain('subscription was cancelled during checkout');
            expect(mockDbTransaction).not.toHaveBeenCalled();
            expect(mockEntitlementService.applyAddonEntitlements).not.toHaveBeenCalled();
        });

        it('should return SUBSCRIPTION_CANCELLED when re-check returns an empty subscription list', async () => {
            // Arrange: initial check returns active, re-check returns empty (all gone)
            const billingWithEmptyRecheck = {
                subscriptions: {
                    getByCustomerId: vi
                        .fn()
                        .mockResolvedValueOnce([
                            { id: 'sub_001', status: 'active', planId: 'plan_basico' }
                        ])
                        .mockResolvedValueOnce([])
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ id: 'plan_basico' })
                }
            } as unknown as import('@qazuor/qzpay-core').QZPayBilling;

            // Act
            const result = await confirmAddonPurchase(
                billingWithEmptyRecheck,
                mockEntitlementService,
                defaultInput
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('SUBSCRIPTION_CANCELLED');
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });

        it('should succeed when re-check still shows an active subscription', async () => {
            // Arrange: both the initial check and re-check return active
            // (default mockBilling returns the same active subscription both times)
            mockDbInsertReturning.mockResolvedValue([{ id: 'purchase_recheck_ok' }]);

            // Act
            const result = await confirmAddonPurchase(
                mockBilling,
                mockEntitlementService,
                defaultInput
            );

            // Assert: re-check passes, DB insert proceeds normally
            expect(result.success).toBe(true);
            expect(mockDbTransaction).toHaveBeenCalledOnce();
        });

        it('should succeed when re-check shows a trialing subscription', async () => {
            // Arrange: initial check active, re-check trialing — trialing is still valid
            const billingWithTrialingRecheck = {
                subscriptions: {
                    getByCustomerId: vi
                        .fn()
                        .mockResolvedValueOnce([
                            { id: 'sub_001', status: 'active', planId: 'plan_basico' }
                        ])
                        .mockResolvedValueOnce([
                            { id: 'sub_001', status: 'trialing', planId: 'plan_basico' }
                        ])
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ id: 'plan_basico' })
                }
            } as unknown as import('@qazuor/qzpay-core').QZPayBilling;

            mockDbInsertReturning.mockResolvedValue([{ id: 'purchase_trialing_ok' }]);

            // Act
            const result = await confirmAddonPurchase(
                billingWithTrialingRecheck,
                mockEntitlementService,
                defaultInput
            );

            // Assert: trialing counts as valid active subscription
            expect(result.success).toBe(true);
            expect(mockDbTransaction).toHaveBeenCalledOnce();
        });
    });
});

// ---------------------------------------------------------------------------
// SPEC-109 Phase 1 — createAddonCheckout: MP quality fields
// ---------------------------------------------------------------------------

/**
 * Builds a billing mock that returns a configurable customer and an active
 * subscription. Used to exercise `createAddonCheckout` without hitting QZPay.
 */
function createBillingForCheckout({
    customer,
    subscription = { id: 'sub_001', status: 'active', planId: 'plan_basico' }
}: {
    customer: {
        id: string;
        email: string;
        metadata?: Record<string, unknown> | null;
    };
    subscription?: { id: string; status: string; planId: string };
}): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue(customer)
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([subscription])
        }
    } as unknown as QZPayBilling;
}

describe('createAddonCheckout (SPEC-109 Phase 1)', () => {
    const defaultInput: PurchaseAddonInput = {
        customerId: 'cust_abc',
        addonSlug: 'extra-photos-20',
        userId: 'user_xyz'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPreferenceCreate.mockResolvedValue({
            id: 'pref_test_123',
            init_point: 'https://www.mercadopago.com.ar/checkout/test',
            sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/test'
        });
        // Restore the default deterministic UUID after clearAllMocks.
        mockRandomUUID.mockReturnValue('11111111-2222-3333-4444-555555555555');

        // Default PlanService mocks: NOT_FOUND for both lookups → resolvePlanByIdOrSlug
        // returns null → targetCategories gate short-circuits (allows checkout).
        // Tests that need a specific plan category override these individually.
        mockPlanServiceGetById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /** Shape of the preference body asserted on by SPEC-109 Phase 1 tests. */
    interface AssertablePreferenceBody {
        readonly items: ReadonlyArray<{
            readonly category_id?: string;
            readonly title: string;
            readonly quantity: number;
        }>;
        readonly payer: {
            readonly email: string;
            readonly first_name: string;
            readonly last_name: string;
        };
        readonly external_reference: string;
        readonly statement_descriptor: string;
    }

    /** Top-level shape of the argument forwarded to `Preference.create()`. */
    interface AssertableCreateArg {
        readonly body: AssertablePreferenceBody;
        readonly requestOptions?: { readonly idempotencyKey?: string };
    }

    /**
     * Reads the full argument that the SDK was called with (body +
     * requestOptions). Individual tests assert on the sub-field they care
     * about.
     */
    function getCreatedPreferenceArg(callIndex = 0): AssertableCreateArg {
        expect(mockPreferenceCreate.mock.calls.length).toBeGreaterThan(callIndex);
        return mockPreferenceCreate.mock.calls[callIndex]?.[0] as AssertableCreateArg;
    }

    /**
     * Reads only the preference body that the SDK was called with so
     * individual tests can assert on `payer`, `items[].category_id`, etc.
     */
    function getCreatedPreferenceBody(): AssertablePreferenceBody {
        expect(mockPreferenceCreate).toHaveBeenCalledOnce();
        return getCreatedPreferenceArg().body;
    }

    describe('payer fields (gaps #1, #2, #3)', () => {
        it('populates payer.email from customer.email', async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'guest@example.com',
                    metadata: { name: 'Juan Perez' }
                }
            });

            const result = await createAddonCheckout(billing, defaultInput);

            expect(result.success).toBe(true);
            const body = getCreatedPreferenceBody();
            expect(body.payer.email).toBe('guest@example.com');
        });

        it('splits metadata.name on the first space into first_name / last_name', async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'juan@example.com',
                    metadata: { name: 'Juan Perez' }
                }
            });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            expect(body.payer.first_name).toBe('Juan');
            expect(body.payer.last_name).toBe('Perez');
        });

        it('keeps the full surname when metadata.name has multiple spaces', async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'maria@example.com',
                    metadata: { name: 'Maria de los Angeles Gonzalez' }
                }
            });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            expect(body.payer.first_name).toBe('Maria');
            expect(body.payer.last_name).toBe('de los Angeles Gonzalez');
        });

        it('falls back to the email local-part when metadata.name is missing', async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'anon.user@example.com',
                    metadata: null
                }
            });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            expect(body.payer.first_name).toBe('anon.user');
            // MercadoPago rejects empty last_name; fallback is a single space.
            expect(body.payer.last_name).toBe(' ');
        });

        it('uses a single-space last_name when metadata.name has no space', async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'cher@example.com',
                    metadata: { name: 'Cher' }
                }
            });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            expect(body.payer.first_name).toBe('Cher');
            expect(body.payer.last_name).toBe(' ');
        });

        it('falls back to email local-part when metadata.name is an empty string', async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'blank@example.com',
                    metadata: { name: '   ' }
                }
            });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            expect(body.payer.first_name).toBe('blank');
            expect(body.payer.last_name).toBe(' ');
        });
    });

    describe('items.category_id (gap #4)', () => {
        it("sets every item's category_id to 'services'", async () => {
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'guest@example.com',
                    metadata: { name: 'Juan Perez' }
                }
            });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            expect(body.items).toHaveLength(1);
            expect(body.items[0]?.category_id).toBe('services');
        });
    });

    describe('UUID external_reference + X-Idempotency-Key (gaps #5, #6)', () => {
        const customer = {
            id: 'cust_abc',
            email: 'guest@example.com',
            metadata: { name: 'Juan Perez' }
        };

        it('embeds the generated UUID into external_reference with the addon_<slug>_ prefix', async () => {
            mockRandomUUID.mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
            const billing = createBillingForCheckout({ customer });

            const result = await createAddonCheckout(billing, defaultInput);

            expect(result.success).toBe(true);
            const body = getCreatedPreferenceBody();
            expect(body.external_reference).toBe(
                'addon_extra-photos-20_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            );
        });

        it('does NOT use Date.now() in external_reference (no all-digits suffix)', async () => {
            // Regression guard for SPEC-109 gap #5. Date.now() returns a 13-digit
            // integer; randomUUID() returns a 36-char hex+dash string. If the code
            // ever reverts to Date.now() this assertion catches it.
            const billing = createBillingForCheckout({ customer });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            const suffix = body.external_reference.replace(/^addon_extra-photos-20_/, '');
            expect(suffix).not.toMatch(/^\d+$/);
            expect(suffix).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
            );
        });

        it('forwards the same UUID as the MP X-Idempotency-Key', async () => {
            mockRandomUUID.mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
            const billing = createBillingForCheckout({ customer });

            await createAddonCheckout(billing, defaultInput);

            const arg = getCreatedPreferenceArg();
            expect(arg.requestOptions?.idempotencyKey).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        });

        it('uses the SAME UUID for external_reference and idempotencyKey', async () => {
            mockRandomUUID.mockReturnValue('99999999-8888-7777-6666-555555555555');
            const billing = createBillingForCheckout({ customer });

            await createAddonCheckout(billing, defaultInput);

            const arg = getCreatedPreferenceArg();
            const refSuffix = arg.body.external_reference.replace(/^addon_extra-photos-20_/, '');
            expect(refSuffix).toBe(arg.requestOptions?.idempotencyKey);
        });

        it('uses the env-configured statement_descriptor (gap #7)', async () => {
            const billing = createBillingForCheckout({ customer });

            await createAddonCheckout(billing, defaultInput);

            const body = getCreatedPreferenceBody();
            // The mocked env returns 'HOSPEDA' — the production default. If this
            // changes via env override, the value on the bank statement updates
            // without a code deploy.
            expect(body.statement_descriptor).toBe('HOSPEDA');
        });

        it('generates a fresh UUID on each call (no shared state across checkouts)', async () => {
            mockRandomUUID
                .mockReturnValueOnce('first-uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
                .mockReturnValueOnce('second-uuid-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
            const billing = createBillingForCheckout({ customer });

            await createAddonCheckout(billing, defaultInput);
            await createAddonCheckout(billing, defaultInput);

            const first = getCreatedPreferenceArg(0);
            const second = getCreatedPreferenceArg(1);

            expect(first.requestOptions?.idempotencyKey).toBe(
                'first-uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
            );
            expect(second.requestOptions?.idempotencyKey).toBe(
                'second-uuid-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
            );
            expect(first.requestOptions?.idempotencyKey).not.toBe(
                second.requestOptions?.idempotencyKey
            );
        });
    });

    // =========================================================================
    // SPEC-127 T-001 regression: dual-resolve planId (UUID vs slug)
    // =========================================================================

    describe('targetCategories gate with UUID planId (SPEC-127 dual-resolve regression)', () => {
        // SPEC-127 T-001 regression: dual-resolve planId (UUID vs slug)
        it('should reject checkout when UUID planId resolves to an excluded plan category', async () => {
            // Arrange
            // Post-SPEC-168: subscriptions may carry a billing_plans UUID as planId.
            // The addon extra-photos-20 has targetCategories: ['owner'].
            // This subscription's planId is a UUID that maps to category 'complex' —
            // which is excluded from the addon's targetCategories.
            //
            // Bug: ALL_PLANS.find(p => p.slug === uuid) returns undefined because
            // UUIDs never match slugs. So customerPlan is undefined, the guard
            //   if (customerPlan && !addon.targetCategories.includes(customerPlan.category))
            // evaluates to false (short-circuit on undefined), and the checkout
            // proceeds silently — INCORRECTLY allowing the restricted addon.
            //
            // Fix (T-002) will replace the ALL_PLANS.find with PlanService dual-resolve:
            // getById(uuid) → real plan with category 'complex' → gate fires → rejected.
            const planUuid = 'f1e2d3c4-b5a6-7890-fedc-ba9876543210';
            const billing = createBillingForCheckout({
                customer: {
                    id: 'cust_abc',
                    email: 'complex@example.com',
                    metadata: { name: 'Complex Owner' }
                },
                subscription: { id: 'sub_complex', status: 'active', planId: planUuid }
            });

            // PlanService.getById will return a 'complex' category plan.
            // BillingPlanResponse.limits is Record<string, number> (DB shape, not LimitDefinition[]).
            mockPlanServiceGetById.mockResolvedValue({
                success: true,
                data: {
                    id: planUuid,
                    slug: 'complex-basico',
                    category: 'complex',
                    limits: { max_photos_per_accommodation: 10 }
                }
            });
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND' }
            });

            // Act
            const result = await createAddonCheckout(billing, defaultInput);

            // Assert — extra-photos-20 is owner-only; a 'complex' plan should be rejected.
            // Currently FAILS: current code silently allows it (customerPlan = undefined).
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ADDON_NOT_AVAILABLE_FOR_PLAN');
        });
    });
});

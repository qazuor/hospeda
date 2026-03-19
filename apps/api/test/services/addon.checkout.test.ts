/**
 * Tests for confirmAddonPurchase - T-013
 *
 * Verifies:
 * - purchaseId is captured from the DB insert `.returning()` result and forwarded
 *   to `entitlementService.applyAddonEntitlements({ ..., purchaseId })`
 * - Postgres unique constraint violation (code '23505') is handled gracefully
 *   with a dedicated ADDON_ALREADY_ACTIVE error code (not an unhandled throw)
 * - Insert failure without a constraint code re-throws and is caught by outer handler
 *
 * @module test/services/addon.checkout.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { ConfirmPurchaseInput } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { confirmAddonPurchase } from '../../src/services/addon.checkout';

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------

/**
 * Hoisted mock functions for DB chain and schemas.
 * Using vi.hoisted ensures these are available before vi.mock factory runs.
 */
const {
    mockDbTransaction,
    mockDbInsertReturning,
    mockDbInsertValues,
    mockBillingAddonPurchasesTable
} = vi.hoisted(() => {
    // returning() chain: insert() -> values() -> returning()
    const mockDbInsertReturning = vi.fn().mockResolvedValue([{ id: 'purchase_uuid_abc' }]);
    const mockDbInsertValues = vi.fn(() => ({ returning: mockDbInsertReturning }));
    const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }));

    // transaction() wraps insert; callback receives tx which mirrors db
    const mockDbTransaction = vi.fn(
        async (callback: (tx: { insert: typeof mockDbInsert }) => Promise<unknown>) => {
            return callback({ insert: mockDbInsert });
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
        mockDbInsertReturning,
        mockDbInsertValues,
        mockBillingAddonPurchasesTable
    };
});

// Mock @repo/db/client - dynamic import used inside confirmAddonPurchase
vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({
        transaction: mockDbTransaction
    }))
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

        // Reset default: successful insert returning a known purchaseId
        mockDbInsertReturning.mockResolvedValue([{ id: 'purchase_uuid_abc' }]);
        mockDbTransaction.mockImplementation(
            async (callback: (tx: { insert: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
                const mockInsert = vi.fn(() => ({ values: mockDbInsertValues }));
                mockDbInsertValues.mockReturnValue({ returning: mockDbInsertReturning });
                return callback({ insert: mockInsert });
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

        it('should still succeed when the subscription planId is not found in ALL_PLANS', async () => {
            // G-025: confirmAddonPurchase now resolves plan limits from the static ALL_PLANS
            // array (not billing.plans.get). When the planId is not in ALL_PLANS the code
            // falls back to previousValue = 0 via optional chaining and continues normally.
            // This is intentional: an unknown planId is not a fatal error.

            // Act - activeSubscription has planId: 'plan_basico' which is not in ALL_PLANS: []
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

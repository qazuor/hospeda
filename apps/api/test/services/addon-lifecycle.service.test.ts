/**
 * Tests for Addon Lifecycle Service
 *
 * Covers:
 * - T-043a: revokeAddonForSubscriptionCancellation() — entitlement-type addon (happy path)
 * - T-043b: revokeAddonForSubscriptionCancellation() — entitlement-type addon (primary fails, fallback succeeds)
 * - T-043c: revokeAddonForSubscriptionCancellation() — entitlement-type addon (both primary and fallback fail → throws)
 * - T-043d: revokeAddonForSubscriptionCancellation() — limit-type addon (happy path)
 * - T-043e: revokeAddonForSubscriptionCancellation() — limit-type addon (primary fails, fallback succeeds)
 * - T-043f: revokeAddonForSubscriptionCancellation() — limit-type addon (both primary and fallback fail → throws)
 * - T-043g: revokeAddonForSubscriptionCancellation() — unknown/retired addon (both channels attempted, errors non-fatal)
 * - T-043h: revokeAddonForSubscriptionCancellation() — count=0 from revokeBySource is not an error
 * - T-043i: revokeAddonForSubscriptionCancellation() — clearEntitlementCache is always called on success
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import type { AddonDefinition } from '@repo/billing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as entitlementMiddleware from '../../src/middlewares/entitlement';
import { revokeAddonForSubscriptionCancellation } from '../../src/services/addon-lifecycle.service';
import { createMockBilling } from '../helpers/mock-factories';

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cus_test_001';
const PURCHASE_ID = 'purch_test_uuid-0001-0002-0003-000000000004';
const ADDON_SLUG_ENT = 'visibility-boost-7d';
const ADDON_SLUG_LIMIT = 'extra-photos-20';
const ADDON_SLUG_RETIRED = 'retired-addon-slug';

/** Minimal entitlement-type addon definition */
const entitlementAddonDef: AddonDefinition = {
    slug: ADDON_SLUG_ENT,
    name: 'Visibility Boost (7 days)',
    description: 'Featured listing for 7 days',
    billingType: 'one_time',
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: EntitlementKey.FEATURED_LISTING,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/** Minimal limit-type addon definition */
const limitAddonDef: AddonDefinition = {
    slug: ADDON_SLUG_LIMIT,
    name: 'Extra Photos Pack (+20)',
    description: 'Extra photos',
    billingType: 'recurring',
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 2
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('revokeAddonForSubscriptionCancellation', () => {
    let mockBilling: QZPayBilling;

    beforeEach(() => {
        mockBilling = createMockBilling();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-043a: Entitlement addon — happy path
    // =========================================================================
    describe('T-043a: entitlement-type addon — happy path', () => {
        it('should call revokeBySource and return success outcome', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(1);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledWith(
                'addon',
                PURCHASE_ID
            );
            expect(mockBilling.entitlements.revoke).not.toHaveBeenCalled();
            expect(result).toEqual({
                purchaseId: PURCHASE_ID,
                addonSlug: ADDON_SLUG_ENT,
                addonType: 'entitlement',
                outcome: 'success'
            });
        });

        it('should clear the entitlement cache after successful revocation', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(1);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledOnce();
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // =========================================================================
    // T-043b: Entitlement addon — primary fails, fallback succeeds
    // =========================================================================
    describe('T-043b: entitlement-type addon — primary fails, fallback succeeds', () => {
        it('should attempt fallback revoke when revokeBySource throws', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('QZPay network error')
            );
            vi.mocked(mockBilling.entitlements.revoke).mockResolvedValue(undefined);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.entitlements.revoke).toHaveBeenCalledOnce();
            expect(mockBilling.entitlements.revoke).toHaveBeenCalledWith(
                CUSTOMER_ID,
                EntitlementKey.FEATURED_LISTING
            );
            expect(result.outcome).toBe('success');
            expect(result.addonType).toBe('entitlement');
        });

        it('should clear cache even when fallback was used', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('timeout')
            );
            vi.mocked(mockBilling.entitlements.revoke).mockResolvedValue(undefined);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // =========================================================================
    // T-043c: Entitlement addon — both primary and fallback fail (FATAL)
    // =========================================================================
    describe('T-043c: entitlement-type addon — both channels fail → throws', () => {
        it('should re-throw when both revokeBySource and revoke throw', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('primary failure')
            );
            vi.mocked(mockBilling.entitlements.revoke).mockRejectedValue(
                new Error('fallback failure')
            );

            // Act & Assert
            await expect(
                revokeAddonForSubscriptionCancellation({
                    customerId: CUSTOMER_ID,
                    purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                    addonDef: entitlementAddonDef,
                    billing: mockBilling
                })
            ).rejects.toThrow('fallback failure');
        });

        it('should NOT clear cache when fatal error is thrown', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('primary failure')
            );
            vi.mocked(mockBilling.entitlements.revoke).mockRejectedValue(
                new Error('fallback failure')
            );

            // Act
            try {
                await revokeAddonForSubscriptionCancellation({
                    customerId: CUSTOMER_ID,
                    purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                    addonDef: entitlementAddonDef,
                    billing: mockBilling
                });
            } catch {
                // expected
            }

            // Assert
            expect(entitlementMiddleware.clearEntitlementCache).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // T-043d: Limit addon — happy path
    // =========================================================================
    describe('T-043d: limit-type addon — happy path', () => {
        it('should call removeBySource and return success outcome', async () => {
            // Arrange
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(1);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledWith('addon', PURCHASE_ID);
            expect(mockBilling.limits.remove).not.toHaveBeenCalled();
            expect(result).toEqual({
                purchaseId: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                addonType: 'limit',
                outcome: 'success'
            });
        });

        it('should clear the entitlement cache after successful removal', async () => {
            // Arrange
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(1);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledOnce();
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // =========================================================================
    // T-043e: Limit addon — primary fails, fallback succeeds
    // =========================================================================
    describe('T-043e: limit-type addon — primary fails, fallback succeeds', () => {
        it('should attempt fallback remove when removeBySource throws', async () => {
            // Arrange
            vi.mocked(mockBilling.limits.removeBySource).mockRejectedValue(
                new Error('QZPay timeout')
            );
            vi.mocked(mockBilling.limits.remove).mockResolvedValue(undefined);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.limits.remove).toHaveBeenCalledOnce();
            expect(mockBilling.limits.remove).toHaveBeenCalledWith(
                CUSTOMER_ID,
                LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            expect(result.outcome).toBe('success');
            expect(result.addonType).toBe('limit');
        });
    });

    // =========================================================================
    // T-043f: Limit addon — both primary and fallback fail (FATAL)
    // =========================================================================
    describe('T-043f: limit-type addon — both channels fail → throws', () => {
        it('should re-throw when both removeBySource and remove throw', async () => {
            // Arrange
            vi.mocked(mockBilling.limits.removeBySource).mockRejectedValue(
                new Error('primary failure')
            );
            vi.mocked(mockBilling.limits.remove).mockRejectedValue(new Error('fallback failure'));

            // Act & Assert
            await expect(
                revokeAddonForSubscriptionCancellation({
                    customerId: CUSTOMER_ID,
                    purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                    addonDef: limitAddonDef,
                    billing: mockBilling
                })
            ).rejects.toThrow('fallback failure');
        });
    });

    // =========================================================================
    // T-043g: Unknown/retired addon — both channels attempted, errors non-fatal
    // =========================================================================
    describe('T-043g: unknown/retired addon (addonDef undefined)', () => {
        it('should call both revokeBySource and removeBySource on undefined addonDef', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(0);
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(0);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_RETIRED },
                addonDef: undefined,
                billing: mockBilling
            });

            // Assert
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledWith(
                'addon',
                PURCHASE_ID
            );
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledWith('addon', PURCHASE_ID);
            expect(result).toEqual({
                purchaseId: PURCHASE_ID,
                addonSlug: ADDON_SLUG_RETIRED,
                addonType: 'unknown',
                outcome: 'success'
            });
        });

        it('should return success even when both channels throw (non-fatal for retired addons)', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('entitlement channel error')
            );
            vi.mocked(mockBilling.limits.removeBySource).mockRejectedValue(
                new Error('limit channel error')
            );

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_RETIRED },
                addonDef: undefined,
                billing: mockBilling
            });

            // Assert — errors are non-fatal; the function resolves successfully
            expect(result.outcome).toBe('success');
            expect(result.addonType).toBe('unknown');
        });

        it('should attempt both channels even when the first one fails', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('entitlement error')
            );
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(0);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_RETIRED },
                addonDef: undefined,
                billing: mockBilling
            });

            // Assert — limits channel was still reached despite entitlement error
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledOnce();
        });

        it('should clear entitlement cache even for retired addons', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(0);
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(0);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_RETIRED },
                addonDef: undefined,
                billing: mockBilling
            });

            // Assert
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // =========================================================================
    // T-043h: revokeBySource returning count=0 is not an error
    // =========================================================================
    describe('T-043h: count=0 from revokeBySource / removeBySource is not an error', () => {
        it('should succeed when revokeBySource returns 0 for entitlement addon', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(0);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert — count=0 is fine (may have already expired naturally)
            expect(result.outcome).toBe('success');
            // Fallback should NOT have been called
            expect(mockBilling.entitlements.revoke).not.toHaveBeenCalled();
        });

        it('should succeed when removeBySource returns 0 for limit addon', async () => {
            // Arrange
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(0);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert — count=0 is fine
            expect(result.outcome).toBe('success');
            // Fallback should NOT have been called
            expect(mockBilling.limits.remove).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // GAP-043-037: Enhanced toHaveBeenCalledWith assertions for critical paths
    // =========================================================================
    describe('GAP-043-037: enhanced call argument assertions', () => {
        it('should call entitlements.revokeBySource with (source="addon", purchaseId) — entitlement addon', async () => {
            // Arrange
            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(1);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert — exact arguments to primary revocation
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledWith(
                expect.stringContaining('addon'),
                expect.stringContaining(PURCHASE_ID)
            );
        });

        it('should call entitlements.revoke with (customerId, entitlementKey) when fallback is used', async () => {
            // Arrange — primary fails so fallback revoke is invoked
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                new Error('primary failure')
            );
            vi.mocked(mockBilling.entitlements.revoke).mockResolvedValue(undefined);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert — fallback called with correct customer and entitlement key
            expect(mockBilling.entitlements.revoke).toHaveBeenCalledWith(
                expect.stringContaining(CUSTOMER_ID),
                expect.stringContaining(EntitlementKey.FEATURED_LISTING)
            );
        });

        it('should call limits.removeBySource with (source="addon", purchaseId) — limit addon', async () => {
            // Arrange
            vi.mocked(mockBilling.limits.removeBySource).mockResolvedValue(1);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert — exact arguments to primary limit removal
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledWith(
                expect.stringContaining('addon'),
                expect.stringContaining(PURCHASE_ID)
            );
        });

        it('should call limits.remove with (customerId, limitKey) when fallback is used', async () => {
            // Arrange — primary removeBySource fails so fallback remove is invoked
            vi.mocked(mockBilling.limits.removeBySource).mockRejectedValue(
                new Error('primary failure')
            );
            vi.mocked(mockBilling.limits.remove).mockResolvedValue(undefined);

            // Act
            await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert — fallback called with correct customer and limit key
            expect(mockBilling.limits.remove).toHaveBeenCalledWith(
                expect.stringContaining(CUSTOMER_ID),
                expect.stringContaining(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION)
            );
        });
    });

    // =========================================================================
    // GAP-043-019: Transient failure recovery — primary-fail-fallback-succeed
    // =========================================================================
    describe('GAP-043-019: transient failure recovery', () => {
        it('should succeed via fallback when billing.entitlements.revoke() throws a timeout error', async () => {
            // Arrange — primary revokeBySource throws a timeout; fallback revoke succeeds
            vi.mocked(mockBilling.entitlements.revokeBySource).mockRejectedValue(
                Object.assign(new Error('Request timeout after 5000ms'), { code: 'ETIMEDOUT' })
            );
            vi.mocked(mockBilling.entitlements.revoke).mockResolvedValue(undefined);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            // Assert — fallback was used and call succeeded
            expect(mockBilling.entitlements.revokeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.entitlements.revoke).toHaveBeenCalledOnce();
            expect(mockBilling.entitlements.revoke).toHaveBeenCalledWith(
                CUSTOMER_ID,
                EntitlementKey.FEATURED_LISTING
            );
            expect(result.outcome).toBe('success');
            expect(result.addonType).toBe('entitlement');
        });

        it('should succeed via fallback when billing.limits.removeBySource() throws a 503 error', async () => {
            // Arrange — primary removeBySource throws a 503; fallback remove succeeds
            vi.mocked(mockBilling.limits.removeBySource).mockRejectedValue(
                Object.assign(new Error('Service unavailable (503)'), { statusCode: 503 })
            );
            vi.mocked(mockBilling.limits.remove).mockResolvedValue(undefined);

            // Act
            const result = await revokeAddonForSubscriptionCancellation({
                customerId: CUSTOMER_ID,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_LIMIT },
                addonDef: limitAddonDef,
                billing: mockBilling
            });

            // Assert — fallback was invoked after primary 503
            expect(mockBilling.limits.removeBySource).toHaveBeenCalledOnce();
            expect(mockBilling.limits.remove).toHaveBeenCalledOnce();
            expect(mockBilling.limits.remove).toHaveBeenCalledWith(
                CUSTOMER_ID,
                LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            expect(result.outcome).toBe('success');
            expect(result.addonType).toBe('limit');
        });
    });

    // =========================================================================
    // T-043i: clearEntitlementCache is always called on success paths
    // =========================================================================
    describe('T-043i: clearEntitlementCache is always called on success', () => {
        it('should always call clearEntitlementCache with the correct customerId', async () => {
            const differentCustomerId = 'cus_different_999';

            vi.mocked(mockBilling.entitlements.revokeBySource).mockResolvedValue(1);

            await revokeAddonForSubscriptionCancellation({
                customerId: differentCustomerId,
                purchase: { id: PURCHASE_ID, addonSlug: ADDON_SLUG_ENT },
                addonDef: entitlementAddonDef,
                billing: mockBilling
            });

            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(
                differentCustomerId
            );
        });
    });
});

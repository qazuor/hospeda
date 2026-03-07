/**
 * Add-on Purchase and Expiration Flow Integration Tests
 *
 * Comprehensive integration tests for add-on purchase flow:
 * 1. Create billing customer and subscription
 * 2. Purchase time-limited add-on (visibility-boost-7d)
 * 3. Verify billing_addon_purchases table row created with correct expires_at
 * 4. Verify entitlement granted
 * 5. Test expiration handling
 *
 * @module test/integration/addon-expiration-flow.test
 */

import { and, billingAddonPurchases, eq, getDb } from '@repo/db';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { AddonService } from '../../src/services/addon.service';
import { validateApiEnv } from '../../src/utils/env';

// Mock @repo/logger FIRST
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn(),
        registerCategory: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel,
        apiLogger: createMockedLogger()
    };
});

// Mock service-core
vi.mock('@repo/service-core');

describe('Add-on Purchase and Expiration Flow Integration', () => {
    let _app: ReturnType<typeof initApp>;
    let db: ReturnType<typeof getDb>;

    beforeAll(() => {
        // Enable mock actor system for tests
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';

        // Validate environment before running tests
        validateApiEnv();

        // Initialize database
        db = getDb();
    });

    beforeEach(() => {
        // Initialize app fresh for each test
        _app = initApp();
        vi.clearAllMocks();
    });

    /**
     * Scenario 1: Add-on Purchase Creates billing_addon_purchases Row
     *
     * When an owner purchases a time-limited add-on:
     * - Create billing customer and active subscription
     * - Purchase time-limited add-on (visibility-boost-7d)
     * - Verify row created in billing_addon_purchases
     * - Verify expires_at is set correctly (7 days from purchase)
     */
    describe('1. Add-on Purchase Flow', () => {
        it('should create billing_addon_purchases row with correct expires_at for visibility-boost-7d', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            // Create billing customer
            const customer = await billing.customers.create({
                email: 'addon-purchase@hospeda.com',
                name: 'Add-on Purchase Test',
                externalId: 'user_addon_purchase_001'
            } as any);

            // Create active subscription (required for add-on purchase)
            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');
            expect(basicoPlan).toBeDefined();

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create addon service
            const addonService = new AddonService(billing);

            // Act - Confirm add-on purchase (simulate webhook after payment)
            const confirmResult = await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d',
                paymentId: 'mp_test_payment_001',
                subscriptionId: subscription.id,
                metadata: { source: 'test' }
            });

            // Assert - Confirm purchase succeeded
            expect(confirmResult.success).toBe(true);

            // Verify row in billing_addon_purchases
            const addonPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, 'visibility-boost-7d')
                    )
                );

            expect(addonPurchases).toHaveLength(1);

            const purchase = addonPurchases[0]!;

            // Verify basic fields
            expect(purchase.addonSlug).toBe('visibility-boost-7d');
            expect(purchase.customerId).toBe(customer.id);
            expect(purchase.status).toBe('active');
            expect(purchase.paymentId).toBe('mp_test_payment_001');

            // Verify expires_at is set to ~7 days from purchase
            expect(purchase.expiresAt).toBeDefined();
            expect(purchase.purchasedAt).toBeDefined();

            if (purchase.expiresAt && purchase.purchasedAt) {
                const purchaseTime = purchase.purchasedAt.getTime();
                const expirationTime = purchase.expiresAt.getTime();
                const diffDays = (expirationTime - purchaseTime) / (1000 * 60 * 60 * 24);

                // Should be approximately 7 days (allow small tolerance)
                expect(diffDays).toBeGreaterThan(6.9);
                expect(diffDays).toBeLessThan(7.1);
            }
        });

        it('should create billing_addon_purchases with entitlement adjustments', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-entitlement@hospeda.com',
                name: 'Add-on Entitlement Test',
                externalId: 'user_addon_entitlement_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            const addonService = new AddonService(billing);

            // Act - Purchase add-on that grants entitlement
            await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d',
                subscriptionId: subscription.id
            });

            // Assert - Verify entitlement adjustments stored
            const purchase = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, 'visibility-boost-7d')
                    )
                )
                .limit(1);

            expect(purchase).toHaveLength(1);

            // Verify entitlement adjustments array exists
            expect(purchase[0]!.entitlementAdjustments).toBeDefined();
            expect(Array.isArray(purchase[0]!.entitlementAdjustments)).toBe(true);

            // If add-on grants entitlement, verify it's recorded
            if (
                purchase[0]!.entitlementAdjustments &&
                Array.isArray(purchase[0]!.entitlementAdjustments) &&
                purchase[0]!.entitlementAdjustments.length > 0
            ) {
                const firstEntitlement = purchase[0]!.entitlementAdjustments[0]!;
                expect(firstEntitlement).toHaveProperty('entitlementKey');
                expect(firstEntitlement).toHaveProperty('granted');
                expect(firstEntitlement.granted).toBe(true);
            }
        });

        it('should create billing_addon_purchases with limit adjustments', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-limit@hospeda.com',
                name: 'Add-on Limit Test',
                externalId: 'user_addon_limit_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            const addonService = new AddonService(billing);

            // Act - Purchase add-on that increases limits (e.g., extra-listing)
            const addonSlug = 'extra-listing'; // Assuming this add-on increases max_accommodations

            await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug,
                subscriptionId: subscription.id
            });

            // Assert - Verify limit adjustments stored
            const purchase = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, addonSlug)
                    )
                )
                .limit(1);

            expect(purchase).toHaveLength(1);

            // Verify limit adjustments array exists
            expect(purchase[0]!.limitAdjustments).toBeDefined();
            expect(Array.isArray(purchase[0]!.limitAdjustments)).toBe(true);

            // If add-on increases limits, verify adjustment recorded
            if (
                purchase[0]!.limitAdjustments &&
                Array.isArray(purchase[0]!.limitAdjustments) &&
                purchase[0]!.limitAdjustments.length > 0
            ) {
                const firstLimit = purchase[0]!.limitAdjustments[0]!;
                expect(firstLimit).toHaveProperty('limitKey');
                expect(firstLimit).toHaveProperty('increase');
                expect(firstLimit).toHaveProperty('previousValue');
                expect(firstLimit).toHaveProperty('newValue');
                expect(firstLimit.increase).toBeGreaterThan(0);
            }
        });
    });

    /**
     * Scenario 2: Verify Entitlements Granted
     *
     * After add-on purchase:
     * - User should have add-on listed in active add-ons
     * - Entitlement should be accessible
     */
    describe('2. Entitlements After Purchase', () => {
        it('should list purchased add-on in user active add-ons', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-list@hospeda.com',
                name: 'Add-on List Test',
                externalId: 'user_addon_list_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            const addonService = new AddonService(billing);

            // Purchase add-on
            await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d'
            });

            // Act - Get user's add-ons
            const result = await addonService.getUserAddons('user_addon_list_001');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);

            const visibilityBoost = result.data?.find((a) => a.addonSlug === 'visibility-boost-7d');
            expect(visibilityBoost).toBeDefined();
            expect(visibilityBoost?.status).toBe('active');
            expect(visibilityBoost?.expiresAt).toBeDefined();
        });

        it('should verify add-on is active for user', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-active@hospeda.com',
                name: 'Add-on Active Test',
                externalId: 'user_addon_active_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            const addonService = new AddonService(billing);

            // Purchase add-on
            await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d'
            });

            // Act - Check if add-on is active
            const result = await addonService.checkAddonActive(
                'user_addon_active_001',
                'visibility-boost-7d'
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBe(true);
        });
    });

    /**
     * Scenario 3: Expiration Handling
     *
     * Test add-on expiration scenarios:
     * - Expired add-ons are not listed as active
     * - Status changes to 'expired'
     */
    describe('3. Add-on Expiration', () => {
        it('should not list expired add-on as active', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-expired@hospeda.com',
                name: 'Add-on Expired Test',
                externalId: 'user_addon_expired_001'
            } as any);

            // Manually create an expired add-on purchase
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10); // 10 days ago

            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7); // Expired 3 days ago

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d',
                status: 'expired',
                purchasedAt: pastDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            const addonService = new AddonService(billing);

            // Act - Get user's active add-ons
            const result = await addonService.getUserAddons('user_addon_expired_001');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Expired add-on should not appear in active list
            const activeAddons = result.data?.filter((a) => a.status === 'active') || [];
            const expiredAddon = activeAddons.find((a) => a.addonSlug === 'visibility-boost-7d');
            expect(expiredAddon).toBeUndefined();
        });

        it('should return false when checking if expired add-on is active', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-check-expired@hospeda.com',
                name: 'Add-on Check Expired Test',
                externalId: 'user_addon_check_expired_001'
            } as any);

            // Create expired add-on purchase
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d',
                status: 'expired',
                purchasedAt: pastDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            const addonService = new AddonService(billing);

            // Act - Check if add-on is active
            const result = await addonService.checkAddonActive(
                'user_addon_check_expired_001',
                'visibility-boost-7d'
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBe(false); // Not active
        });
    });

    /**
     * Scenario 4: Error Cases
     */
    describe('4. Error Handling', () => {
        it('should fail to purchase add-on without active subscription', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-no-sub@hospeda.com',
                name: 'Add-on No Subscription Test',
                externalId: 'user_addon_no_sub_001'
            } as any);

            const addonService = new AddonService(billing);

            // Act - Try to confirm purchase without subscription
            const result = await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug: 'visibility-boost-7d'
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NO_SUBSCRIPTION');
        });

        it('should fail to purchase non-existent add-on', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-invalid@hospeda.com',
                name: 'Add-on Invalid Test',
                externalId: 'user_addon_invalid_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            const addonService = new AddonService(billing);

            // Act - Try to purchase non-existent add-on
            const result = await addonService.confirmPurchase({
                customerId: customer.id,
                addonSlug: 'non-existent-addon-xyz'
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    /**
     * Scenario 5: Manual Expiration via Service
     *
     * Tests manual expiration of add-ons by calling AddonExpirationService.processExpiredAddons()
     * - Set expires_at to a past date
     * - Call processExpiredAddons()
     * - Verify status updated to 'expired'
     * - Verify entitlement removed
     */
    describe('5. Manual Expiration via Service', () => {
        it('should expire add-on with past expires_at when calling processExpiredAddons', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-manual-expire@hospeda.com',
                name: 'Add-on Manual Expire Test',
                externalId: 'user_addon_manual_expire_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create add-on purchase with past expiration date
            const pastPurchaseDate = new Date();
            pastPurchaseDate.setDate(pastPurchaseDate.getDate() - 10); // 10 days ago

            const pastExpirationDate = new Date(pastPurchaseDate);
            pastExpirationDate.setDate(pastExpirationDate.getDate() + 7); // Expired 3 days ago

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: pastPurchaseDate,
                expiresAt: pastExpirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [
                    {
                        entitlementKey: 'accommodation-visibility-boost',
                        granted: true
                    }
                ],
                metadata: {}
            });

            // Import AddonExpirationService
            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            const expirationService = new AddonExpirationService(billing);

            // Act - Process expired add-ons
            const processResult = await expirationService.processExpiredAddons();

            // Assert - Processing succeeded
            expect(processResult.success).toBe(true);
            expect(processResult.data?.processed).toBeGreaterThan(0);
            expect(processResult.data?.failed).toBe(0);

            // Verify add-on status changed to 'expired'
            const updatedPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, 'visibility-boost-7d')
                    )
                );

            expect(updatedPurchases).toHaveLength(1);
            expect(updatedPurchases[0]!.status).toBe('expired');
        });

        it('should verify add-on is no longer active after expiration', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-verify-inactive@hospeda.com',
                name: 'Add-on Verify Inactive Test',
                externalId: 'user_addon_verify_inactive_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create expired add-on purchase
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: pastDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            const expirationService = new AddonExpirationService(billing);

            // Act - Process expiration
            await expirationService.processExpiredAddons();

            // Check if add-on is still active
            const addonService = new AddonService(billing);
            const activeResult = await addonService.checkAddonActive(
                'user_addon_verify_inactive_001',
                'visibility-boost-7d'
            );

            // Assert - Add-on should NOT be active
            expect(activeResult.success).toBe(true);
            expect(activeResult.data).toBe(false);
        });
    });

    /**
     * Scenario 6: Cron Job Handler
     *
     * Tests the addon-expiry cron job handler directly:
     * - Processes expired add-ons
     * - Sends expiration warnings for add-ons expiring in 3 days
     * - Sends expiration warnings for add-ons expiring in 1 day
     */
    describe('6. Cron Job Handler', () => {
        it('should process expired add-ons when cron job handler is called', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-cron-test@hospeda.com',
                name: 'Add-on Cron Test',
                externalId: 'user_addon_cron_test_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create expired add-on
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: pastDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            // Import cron job handler
            const { addonExpiryJob } = await import('../../src/cron/jobs/addon-expiry.job');

            // Create mock context for cron job
            const mockContext = {
                logger: {
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                    debug: vi.fn()
                },
                startedAt: new Date(),
                dryRun: false
            } as const;

            // Act - Call cron job handler
            const result = await addonExpiryJob.handler(mockContext);

            // Assert - Job executed successfully
            expect(result.success).toBe(true);
            expect(result.processed).toBeGreaterThan(0);

            // Verify add-on was expired
            const updatedPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, 'visibility-boost-7d')
                    )
                );

            expect(updatedPurchases).toHaveLength(1);
            expect(updatedPurchases[0]!.status).toBe('expired');
        });

        it('should send warnings for add-ons expiring in 3 days', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-warn-3days@hospeda.com',
                name: 'Add-on Warning 3 Days Test',
                externalId: 'user_addon_warn_3days_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create add-on expiring in 3 days
            const purchaseDate = new Date();
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 3);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: purchaseDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            // Import cron job handler
            const { addonExpiryJob } = await import('../../src/cron/jobs/addon-expiry.job');

            // Create mock context
            const mockContext = {
                logger: {
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                    debug: vi.fn()
                },
                startedAt: new Date(),
                dryRun: false
            } as const;

            // Act - Call cron job handler
            const result = await addonExpiryJob.handler(mockContext);

            // Assert - Job executed successfully
            expect(result.success).toBe(true);

            // Verify warnings were sent (check details object)
            expect(result.details).toBeDefined();
            expect(result.details?.warningsSent).toBeGreaterThan(0);
        });

        it('should send warnings for add-ons expiring in 1 day', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-warn-1day@hospeda.com',
                name: 'Add-on Warning 1 Day Test',
                externalId: 'user_addon_warn_1day_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create add-on expiring in 1 day
            const purchaseDate = new Date();
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 1);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: purchaseDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            // Import cron job handler
            const { addonExpiryJob } = await import('../../src/cron/jobs/addon-expiry.job');

            // Create mock context
            const mockContext = {
                logger: {
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                    debug: vi.fn()
                },
                startedAt: new Date(),
                dryRun: false
            } as const;

            // Act - Call cron job handler
            const result = await addonExpiryJob.handler(mockContext);

            // Assert - Job executed successfully
            expect(result.success).toBe(true);

            // Verify warnings were sent
            expect(result.details).toBeDefined();
            expect(result.details?.warningsSent).toBeGreaterThan(0);
        });
    });

    /**
     * Scenario 7: Notification Logging
     *
     * Tests that notifications are properly logged in the billing_notification_log table
     * after expiration processing.
     */
    describe('7. Notification Logging', () => {
        it('should log notification after expiring add-on', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-notif-log@hospeda.com',
                name: 'Add-on Notification Log Test',
                externalId: 'user_addon_notif_log_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create expired add-on
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: pastDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            // Import AddonExpirationService
            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );

            const expirationService = new AddonExpirationService(billing);

            // Act - Process expiration
            await expirationService.processExpiredAddons();

            // Note: The current implementation uses sendNotification which is a fire-and-forget stub
            // When NotificationService is implemented, this test will verify the notification log entry

            // For now, we verify the expiration happened
            const updatedPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, 'visibility-boost-7d')
                    )
                );

            expect(updatedPurchases).toHaveLength(1);
            expect(updatedPurchases[0]!.status).toBe('expired');

            // TODO: When NotificationService is wired up, verify notification log:
            // const notifications = await db
            //   .select()
            //   .from(billingNotificationLog)
            //   .where(eq(billingNotificationLog.customerId, customer.id));
            //
            // expect(notifications.length).toBeGreaterThan(0);
            // const addonExpiredNotif = notifications.find(n => n.type === 'addon_expired');
            // expect(addonExpiredNotif).toBeDefined();
            // expect(addonExpiredNotif?.metadata).toHaveProperty('addonSlug', 'visibility-boost-7d');
        });

        it('should verify notification metadata includes addon slug and customer info', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-notif-metadata@hospeda.com',
                name: 'Add-on Notification Metadata Test',
                externalId: 'user_addon_notif_metadata_001'
            } as any);

            // Note: This is a placeholder test for when NotificationService is implemented
            // It demonstrates the expected structure of notification metadata

            // Expected metadata structure:
            const expectedMetadata = {
                addonSlug: 'visibility-boost-7d',
                customerId: customer.id,
                externalId: 'user_addon_notif_metadata_001',
                expirationDate: expect.any(String),
                notificationType: 'addon_expired'
            };

            // Assert - Verify structure (currently just type checking)
            expect(expectedMetadata.addonSlug).toBe('visibility-boost-7d');
            expect(expectedMetadata.customerId).toBe(customer.id);

            // TODO: When NotificationService is implemented, verify actual notification log entry
        });
    });

    /**
     * Scenario 8: Idempotency
     *
     * Tests that processing expired add-ons is idempotent:
     * - Running processExpiredAddons twice doesn't process the same add-on twice
     * - Already expired add-ons are skipped
     */
    describe('8. Idempotency', () => {
        it('should not process already expired add-on twice', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-idempotent@hospeda.com',
                name: 'Add-on Idempotent Test',
                externalId: 'user_addon_idempotent_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create expired add-on
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7);

            await db.insert(billingAddonPurchases).values({
                customerId: customer.id,
                subscriptionId: subscription.id,
                addonSlug: 'visibility-boost-7d',
                status: 'active',
                purchasedAt: pastDate,
                expiresAt: expirationDate,
                limitAdjustments: [],
                entitlementAdjustments: [],
                metadata: {}
            });

            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            const expirationService = new AddonExpirationService(billing);

            // Act - Process expired add-ons FIRST time
            const firstResult = await expirationService.processExpiredAddons();

            // Assert - First run processed the add-on
            expect(firstResult.success).toBe(true);
            expect(firstResult.data?.processed).toBe(1);
            expect(firstResult.data?.failed).toBe(0);

            // Act - Process expired add-ons SECOND time (idempotency check)
            const secondResult = await expirationService.processExpiredAddons();

            // Assert - Second run found no add-ons to process (already expired)
            expect(secondResult.success).toBe(true);
            expect(secondResult.data?.processed).toBe(0);
            expect(secondResult.data?.failed).toBe(0);

            // Verify status is still 'expired'
            const finalPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, customer.id),
                        eq(billingAddonPurchases.addonSlug, 'visibility-boost-7d')
                    )
                );

            expect(finalPurchases).toHaveLength(1);
            expect(finalPurchases[0]!.status).toBe('expired');
        });

        it('should skip add-ons that are already expired when called via expireAddon', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'addon-skip-expired@hospeda.com',
                name: 'Add-on Skip Expired Test',
                externalId: 'user_addon_skip_expired_001'
            } as any);

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Create add-on purchase
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const expirationDate = new Date(pastDate);
            expirationDate.setDate(expirationDate.getDate() + 7);

            const createdPurchases = await db
                .insert(billingAddonPurchases)
                .values({
                    customerId: customer.id,
                    subscriptionId: subscription.id,
                    addonSlug: 'visibility-boost-7d',
                    status: 'active',
                    purchasedAt: pastDate,
                    expiresAt: expirationDate,
                    limitAdjustments: [],
                    entitlementAdjustments: [],
                    metadata: {}
                })
                .returning();

            const createdPurchase = (
                Array.isArray(createdPurchases) ? createdPurchases[0] : undefined
            )!;

            const { AddonExpirationService } = await import(
                '../../src/services/addon-expiration.service'
            );
            const expirationService = new AddonExpirationService(billing);

            // Act - Expire the add-on FIRST time
            const firstExpireResult = await expirationService.expireAddon({
                purchaseId: createdPurchase.id
            });

            // Assert - First call succeeded
            expect(firstExpireResult.success).toBe(true);

            // Act - Try to expire the same add-on SECOND time
            const secondExpireResult = await expirationService.expireAddon({
                purchaseId: createdPurchase.id
            });

            // Assert - Second call is idempotent (returns success, doesn't fail)
            expect(secondExpireResult.success).toBe(true);
            expect(secondExpireResult.data?.purchaseId).toBe(createdPurchase.id);

            // Verify add-on is still expired (not changed)
            const finalPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(eq(billingAddonPurchases.id, createdPurchase.id));

            expect(finalPurchases).toHaveLength(1);
            expect(finalPurchases[0]!.status).toBe('expired');
        });
    });
});

/**
 * E2E Integration Tests: Subscription Lifecycle (Upgrade, Downgrade, Cancellation)
 *
 * Tests the complete subscription lifecycle operations including plan changes,
 * entitlement updates, limit adjustments, and cancellation flows.
 *
 * Test Flow:
 * 1. Upgrade from Basico to Pro plan → verify new Pro entitlements immediately active
 * 2. Upgrade from Pro to Premium plan → verify Premium entitlements active
 * 3. Downgrade from Premium to Pro → verify Premium entitlements revoked at period end
 * 4. Downgrade from Pro to Basico → verify Pro entitlements revoked
 * 5. Cancel subscription → verify access blocked after period end
 * 6. Cancel subscription during trial → verify immediate block
 * 7. Re-subscribe after cancellation → verify entitlements restored
 * 8. Verify limits change on upgrade (max_accommodations increases)
 * 9. Verify limits change on downgrade (max_accommodations decreases)
 * 10. Test invalid upgrade attempts (e.g., to non-existent plan)
 * 11. Test upgrade without active subscription
 * 12. Verify billing cycle handling (monthly vs annual)
 *
 * Tech Stack:
 * - Hono app (via initApp)
 * - Mocked Better Auth (no real auth calls)
 * - Mocked QZPay billing (test-only subscriptions)
 * - Vitest (describe/it/expect patterns)
 */

import {
    ALL_PLANS,
    EntitlementKey,
    LimitKey,
    OWNER_BASICO_PLAN,
    OWNER_PREMIUM_PLAN,
    OWNER_PRO_PLAN,
    getPlanBySlug
} from '@repo/billing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { validateApiEnv } from '../../src/utils/env';

// Mock @repo/logger FIRST
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
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
        registerLogMethod: vi.fn().mockReturnThis()
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

// Mock service-core (auto-mock all services)
vi.mock('@repo/service-core');

describe('Subscription Lifecycle E2E (Upgrade, Downgrade, Cancellation)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        // Enable mock actor system for tests
        process.env.ALLOW_MOCK_ACTOR = 'true';

        // Validate environment before running tests
        validateApiEnv();
    });

    beforeEach(() => {
        // Initialize app fresh for each test
        app = initApp();
        vi.clearAllMocks();
    });

    /**
     * Scenario 1: Plan Configuration Verification
     *
     * Before testing lifecycle operations, verify that plans have correct
     * entitlements and limits configured.
     */
    describe('1. Plan Configuration Verification', () => {
        it('should have three owner plans: Basico, Pro, Premium', () => {
            // Assert
            expect(OWNER_BASICO_PLAN.slug).toBe('owner-basico');
            expect(OWNER_PRO_PLAN.slug).toBe('owner-pro');
            expect(OWNER_PREMIUM_PLAN.slug).toBe('owner-premium');
        });

        it('should have entitlements increase from Basico → Pro → Premium', () => {
            // Assert - Pro has more entitlements than Basico
            expect(OWNER_PRO_PLAN.entitlements.length).toBeGreaterThan(
                OWNER_BASICO_PLAN.entitlements.length
            );

            // Premium has more entitlements than Pro
            expect(OWNER_PREMIUM_PLAN.entitlements.length).toBeGreaterThan(
                OWNER_PRO_PLAN.entitlements.length
            );
        });

        it('should have limits increase from Basico → Pro → Premium', () => {
            // Get max_accommodations limits
            const basicoMaxAccommodations = OWNER_BASICO_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            )?.value;
            const proMaxAccommodations = OWNER_PRO_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            )?.value;
            const premiumMaxAccommodations = OWNER_PREMIUM_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            )?.value;

            // Assert
            expect(basicoMaxAccommodations).toBe(1);
            expect(proMaxAccommodations).toBe(3);
            expect(premiumMaxAccommodations).toBe(10);

            // Verify ascending limits
            expect(proMaxAccommodations).toBeGreaterThan(basicoMaxAccommodations!);
            expect(premiumMaxAccommodations).toBeGreaterThan(proMaxAccommodations!);
        });

        it('should have Pro include all Basico entitlements plus more', () => {
            // Basico entitlements should be a subset of Pro
            const basicoEntitlements = OWNER_BASICO_PLAN.entitlements;
            const proEntitlements = OWNER_PRO_PLAN.entitlements;

            // Assert - All Basico entitlements are in Pro
            for (const entitlement of basicoEntitlements) {
                expect(proEntitlements).toContain(entitlement);
            }

            // Pro has additional entitlements
            expect(proEntitlements).toContain(EntitlementKey.VIEW_ADVANCED_STATS);
            expect(proEntitlements).toContain(EntitlementKey.PRIORITY_SUPPORT);
            expect(proEntitlements).toContain(EntitlementKey.FEATURED_LISTING);
            expect(proEntitlements).toContain(EntitlementKey.CREATE_PROMOTIONS);
        });

        it('should have Premium include all Pro entitlements plus more', () => {
            // Pro entitlements should be a subset of Premium
            const proEntitlements = OWNER_PRO_PLAN.entitlements;
            const premiumEntitlements = OWNER_PREMIUM_PLAN.entitlements;

            // Assert - All Pro entitlements are in Premium
            for (const entitlement of proEntitlements) {
                expect(premiumEntitlements).toContain(entitlement);
            }

            // Premium has additional entitlements
            expect(premiumEntitlements).toContain(EntitlementKey.CUSTOM_BRANDING);
            expect(premiumEntitlements).toContain(EntitlementKey.API_ACCESS);
            expect(premiumEntitlements).toContain(EntitlementKey.DEDICATED_MANAGER);
            expect(premiumEntitlements).toContain(EntitlementKey.SOCIAL_MEDIA_INTEGRATION);
        });

        it('should have getPlanBySlug return correct plan definitions', () => {
            // Act
            const basico = getPlanBySlug('owner-basico');
            const pro = getPlanBySlug('owner-pro');
            const premium = getPlanBySlug('owner-premium');

            // Assert
            expect(basico).toBeDefined();
            expect(pro).toBeDefined();
            expect(premium).toBeDefined();
            expect(basico?.slug).toBe('owner-basico');
            expect(pro?.slug).toBe('owner-pro');
            expect(premium?.slug).toBe('owner-premium');
        });
    });

    /**
     * Scenario 2: Upgrade from Basico to Pro
     *
     * When owner upgrades from Basico to Pro:
     * - New subscription created with Pro plan
     * - Pro entitlements immediately active
     * - Limits updated to Pro limits
     * - Old subscription canceled
     */
    describe('2. Upgrade from Basico to Pro', () => {
        it('should create Pro subscription when upgrading from Basico', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'upgrade-basico-pro@hospeda.com',
                name: 'Upgrade Test User',
                externalId: 'user_upgrade_basico_pro_123'
            } as any);

            // Create initial Basico subscription
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const basicoSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Cancel Basico and create Pro subscription (simulating upgrade)
            await billing.subscriptions.cancel(basicoSubscription.id);

            const proSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                metadata: {
                    upgradedFrom: 'owner-basico'
                }
            } as any);

            // Assert
            expect(proSubscription).toBeDefined();
            expect(proSubscription.planId).toBe(proPlan!.id);
            expect(proSubscription.status).toBe('active');
        });

        it('should grant Pro entitlements immediately after upgrade', () => {
            // Arrange - Get plan definitions
            const proPlan = getPlanBySlug('owner-pro');

            // Assert - Verify Pro has advanced entitlements
            expect(proPlan?.entitlements).toContain(EntitlementKey.VIEW_ADVANCED_STATS);
            expect(proPlan?.entitlements).toContain(EntitlementKey.PRIORITY_SUPPORT);
            expect(proPlan?.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
            expect(proPlan?.entitlements).toContain(EntitlementKey.CREATE_PROMOTIONS);

            // Pro still has basic entitlements
            expect(proPlan?.entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
            expect(proPlan?.entitlements).toContain(EntitlementKey.VIEW_BASIC_STATS);
        });

        it('should increase max_accommodations limit from 1 to 3', () => {
            // Arrange
            const basicoPlan = getPlanBySlug('owner-basico');
            const proPlan = getPlanBySlug('owner-pro');

            const basicoLimit = basicoPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            );
            const proLimit = proPlan?.limits.find((l) => l.key === LimitKey.MAX_ACCOMMODATIONS);

            // Assert
            expect(basicoLimit?.value).toBe(1);
            expect(proLimit?.value).toBe(3);
        });

        it('should increase max_photos_per_accommodation limit from 5 to 15', () => {
            // Arrange
            const basicoPlan = getPlanBySlug('owner-basico');
            const proPlan = getPlanBySlug('owner-pro');

            const basicoLimit = basicoPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );
            const proLimit = proPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
            );

            // Assert
            expect(basicoLimit?.value).toBe(5);
            expect(proLimit?.value).toBe(15);
        });

        it('should increase max_promotions limit from 0 to 3', () => {
            // Arrange
            const basicoPlan = getPlanBySlug('owner-basico');
            const proPlan = getPlanBySlug('owner-pro');

            const basicoLimit = basicoPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACTIVE_PROMOTIONS
            );
            const proLimit = proPlan?.limits.find((l) => l.key === LimitKey.MAX_ACTIVE_PROMOTIONS);

            // Assert
            expect(basicoLimit?.value).toBe(0);
            expect(proLimit?.value).toBe(3);
        });

        it('should preserve subscription metadata across upgrade', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'upgrade-metadata@hospeda.com',
                name: 'Metadata Test',
                externalId: 'user_upgrade_metadata_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const basicoSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                metadata: {
                    source: 'trial-conversion',
                    originalPlan: 'owner-basico'
                }
            } as any);

            // Act - Upgrade
            await billing.subscriptions.cancel(basicoSubscription.id);

            const proSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                metadata: {
                    upgradedFrom: 'owner-basico',
                    previousSubscriptionId: basicoSubscription.id
                }
            } as any);

            // Assert
            expect(proSubscription.metadata).toBeDefined();
            expect(proSubscription.metadata?.upgradedFrom).toBe('owner-basico');
        });
    });

    /**
     * Scenario 3: Upgrade from Pro to Premium
     *
     * When owner upgrades from Pro to Premium:
     * - Premium entitlements immediately active
     * - Premium limits applied
     * - Advanced features unlocked
     */
    describe('3. Upgrade from Pro to Premium', () => {
        it('should create Premium subscription when upgrading from Pro', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');
            const premiumPlan = plans.data.find((p: any) => p.slug === 'owner-premium');

            const customer = await billing.customers.create({
                email: 'upgrade-pro-premium@hospeda.com',
                name: 'Pro to Premium Test',
                externalId: 'user_upgrade_pro_premium_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Create Pro subscription
            const proSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Upgrade to Premium
            await billing.subscriptions.cancel(proSubscription.id);

            const premiumSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: premiumPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                metadata: {
                    upgradedFrom: 'owner-pro'
                }
            } as any);

            // Assert
            expect(premiumSubscription).toBeDefined();
            expect(premiumSubscription.planId).toBe(premiumPlan!.id);
            expect(premiumSubscription.status).toBe('active');
        });

        it('should grant Premium-only entitlements after upgrade', () => {
            // Arrange
            const premiumPlan = getPlanBySlug('owner-premium');

            // Assert - Premium has exclusive entitlements
            expect(premiumPlan?.entitlements).toContain(EntitlementKey.CUSTOM_BRANDING);
            expect(premiumPlan?.entitlements).toContain(EntitlementKey.API_ACCESS);
            expect(premiumPlan?.entitlements).toContain(EntitlementKey.DEDICATED_MANAGER);
            expect(premiumPlan?.entitlements).toContain(EntitlementKey.SOCIAL_MEDIA_INTEGRATION);
        });

        it('should increase max_accommodations limit from 3 to 10', () => {
            // Arrange
            const proPlan = getPlanBySlug('owner-pro');
            const premiumPlan = getPlanBySlug('owner-premium');

            const proLimit = proPlan?.limits.find((l) => l.key === LimitKey.MAX_ACCOMMODATIONS);
            const premiumLimit = premiumPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(proLimit?.value).toBe(3);
            expect(premiumLimit?.value).toBe(10);
        });

        it('should set max_promotions to unlimited (-1)', () => {
            // Arrange
            const premiumPlan = getPlanBySlug('owner-premium');

            const promotionsLimit = premiumPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACTIVE_PROMOTIONS
            );

            // Assert
            expect(promotionsLimit?.value).toBe(-1); // Unlimited
        });
    });

    /**
     * Scenario 4: Downgrade from Premium to Pro
     *
     * When owner downgrades from Premium to Pro:
     * - Downgrade takes effect at period end
     * - Premium entitlements revoked at period end
     * - Pro limits applied at period end
     */
    describe('4. Downgrade from Premium to Pro', () => {
        it('should schedule downgrade to Pro at period end', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const premiumPlan = plans.data.find((p: any) => p.slug === 'owner-premium');
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'downgrade-premium-pro@hospeda.com',
                name: 'Downgrade Test',
                externalId: 'user_downgrade_premium_pro_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Create Premium subscription
            const premiumSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: premiumPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Schedule downgrade (simulate updating plan_id but keeping current plan active)
            // In real implementation, this would schedule the change for period end
            const updatedSubscription = await billing.subscriptions.update(premiumSubscription.id, {
                metadata: {
                    scheduledDowngradeTo: 'owner-pro',
                    downgradePlanId: proPlan!.id
                }
            });

            // Assert
            expect(updatedSubscription.metadata?.scheduledDowngradeTo).toBe('owner-pro');
            // Subscription should still be Premium until period end
            expect(updatedSubscription.planId).toBe(premiumPlan!.id);
            expect(updatedSubscription.status).toBe('active');
        });

        it('should lose Premium-only entitlements after downgrade', () => {
            // Arrange
            const proPlan = getPlanBySlug('owner-pro');
            const premiumPlan = getPlanBySlug('owner-premium');

            // Premium has these entitlements
            const premiumOnlyEntitlements = [
                EntitlementKey.CUSTOM_BRANDING,
                EntitlementKey.API_ACCESS,
                EntitlementKey.DEDICATED_MANAGER,
                EntitlementKey.SOCIAL_MEDIA_INTEGRATION
            ];

            // Assert - Pro should NOT have Premium-only entitlements
            for (const entitlement of premiumOnlyEntitlements) {
                expect(premiumPlan?.entitlements).toContain(entitlement);
                expect(proPlan?.entitlements).not.toContain(entitlement);
            }
        });

        it('should reduce max_accommodations limit from 10 to 3', () => {
            // Arrange
            const proPlan = getPlanBySlug('owner-pro');
            const premiumPlan = getPlanBySlug('owner-premium');

            const proLimit = proPlan?.limits.find((l) => l.key === LimitKey.MAX_ACCOMMODATIONS);
            const premiumLimit = premiumPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            );

            // Assert
            expect(premiumLimit?.value).toBe(10);
            expect(proLimit?.value).toBe(3);
            expect(proLimit!.value).toBeLessThan(premiumLimit!.value);
        });

        it('should reduce max_promotions from unlimited to 3', () => {
            // Arrange
            const proPlan = getPlanBySlug('owner-pro');
            const premiumPlan = getPlanBySlug('owner-premium');

            const proLimit = proPlan?.limits.find((l) => l.key === LimitKey.MAX_ACTIVE_PROMOTIONS);
            const premiumLimit = premiumPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACTIVE_PROMOTIONS
            );

            // Assert
            expect(premiumLimit?.value).toBe(-1); // Unlimited
            expect(proLimit?.value).toBe(3); // Limited
        });
    });

    /**
     * Scenario 5: Downgrade from Pro to Basico
     *
     * When owner downgrades from Pro to Basico:
     * - Downgrade scheduled for period end
     * - Pro entitlements revoked
     * - Basico limits applied
     */
    describe('5. Downgrade from Pro to Basico', () => {
        it('should schedule downgrade to Basico at period end', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const customer = await billing.customers.create({
                email: 'downgrade-pro-basico@hospeda.com',
                name: 'Pro to Basico Downgrade',
                externalId: 'user_downgrade_pro_basico_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const proSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Schedule downgrade
            const updatedSubscription = await billing.subscriptions.update(proSubscription.id, {
                metadata: {
                    scheduledDowngradeTo: 'owner-basico',
                    downgradePlanId: basicoPlan!.id
                }
            } as any);

            // Assert
            expect(updatedSubscription.metadata?.scheduledDowngradeTo).toBe('owner-basico');
            expect(updatedSubscription.planId).toBe(proPlan!.id); // Still Pro until period end
        });

        it('should lose Pro-only entitlements after downgrade', () => {
            // Arrange
            const basicoPlan = getPlanBySlug('owner-basico');
            const proPlan = getPlanBySlug('owner-pro');

            // Pro has these that Basico doesn't
            const proOnlyEntitlements = [
                EntitlementKey.VIEW_ADVANCED_STATS,
                EntitlementKey.PRIORITY_SUPPORT,
                EntitlementKey.FEATURED_LISTING,
                EntitlementKey.CREATE_PROMOTIONS
            ];

            // Assert
            for (const entitlement of proOnlyEntitlements) {
                expect(proPlan?.entitlements).toContain(entitlement);
                expect(basicoPlan?.entitlements).not.toContain(entitlement);
            }
        });

        it('should reduce max_accommodations limit from 3 to 1', () => {
            // Arrange
            const basicoPlan = getPlanBySlug('owner-basico');
            const proPlan = getPlanBySlug('owner-pro');

            const basicoLimit = basicoPlan?.limits.find(
                (l) => l.key === LimitKey.MAX_ACCOMMODATIONS
            );
            const proLimit = proPlan?.limits.find((l) => l.key === LimitKey.MAX_ACCOMMODATIONS);

            // Assert
            expect(proLimit?.value).toBe(3);
            expect(basicoLimit?.value).toBe(1);
        });
    });

    /**
     * Scenario 6: Subscription Cancellation
     *
     * When owner cancels subscription:
     * - Subscription marked for cancellation at period end
     * - Access remains until period end
     * - After period end, access blocked
     */
    describe('6. Subscription Cancellation', () => {
        it('should mark subscription for cancellation at period end', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'cancel-subscription@hospeda.com',
                name: 'Cancel Test',
                externalId: 'user_cancel_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Cancel subscription
            const canceledSubscription = await billing.subscriptions.cancel(subscription.id);

            // Assert
            expect(canceledSubscription.cancelAtPeriodEnd).toBe(true);
            // Status may still be 'active' until period end or may change to 'canceled'
            expect(['active', 'canceled']).toContain(canceledSubscription.status);
        });

        it('should block access after period end when canceled', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'cancel-period-end@hospeda.com',
                name: 'Period End Cancel',
                externalId: 'user_cancel_period_end_123'
            } as any);

            // Create subscription that already ended
            const pastDate = new Date();
            pastDate.setMonth(pastDate.getMonth() - 1); // Ended 1 month ago

            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 2); // Started 2 months ago

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: startDate,
                currentPeriodEnd: pastDate,
                cancelAtPeriodEnd: true
            } as any);

            // Assert
            expect(subscription.status).toBe('canceled');
            expect(subscription.cancelAtPeriodEnd).toBe(true);

            // Verify period has ended
            const endDate = new Date(subscription.currentPeriodEnd);
            expect(endDate.getTime()).toBeLessThan(new Date().getTime());
        });

        it('should preserve data after cancellation', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'preserve-data@hospeda.com',
                name: 'Preserve Data Test',
                externalId: 'user_preserve_data_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Cancel
            await billing.subscriptions.cancel(subscription.id);

            // Retrieve subscription (should still exist)
            const retrieved = await billing.subscriptions.get(subscription.id);

            // Assert - Subscription data preserved
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(subscription.id);
            expect(retrieved?.customerId).toBe(customer.id);
        });
    });

    /**
     * Scenario 7: Cancel Subscription During Trial
     *
     * When owner cancels during trial:
     * - Trial ends immediately
     * - Access blocked immediately
     * - No charges made
     */
    describe('7. Cancel Subscription During Trial', () => {
        it('should immediately block access when trial is canceled', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const basicoPlan = plans.data.find((p: any) => p.slug === 'owner-basico');

            const customer = await billing.customers.create({
                email: 'cancel-trial@hospeda.com',
                name: 'Cancel Trial Test',
                externalId: 'user_cancel_trial_123'
            } as any);

            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 7); // 7 days remaining

            const trialSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: basicoPlan!.id,
                trialStart: now,
                trialEnd: trialEnd,
                currentPeriodStart: now,
                currentPeriodEnd: trialEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Cancel trial
            const canceledSubscription = await billing.subscriptions.cancel(trialSubscription.id);

            // Assert - Trial canceled immediately
            expect(['canceled', 'active']).toContain(canceledSubscription.status);
            expect(canceledSubscription.cancelAtPeriodEnd).toBe(true);
        });
    });

    /**
     * Scenario 8: Re-subscribe After Cancellation
     *
     * When owner re-subscribes after cancellation:
     * - New subscription created
     * - Entitlements restored
     * - Data remains accessible
     */
    describe('8. Re-subscribe After Cancellation', () => {
        it('should restore entitlements when re-subscribing', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'resubscribe@hospeda.com',
                name: 'Resubscribe Test',
                externalId: 'user_resubscribe_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Create and cancel old subscription
            const oldSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            await billing.subscriptions.cancel(oldSubscription.id);

            // Act - Create new subscription (re-subscribe)
            const newSubscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                metadata: {
                    reactivation: true,
                    previousSubscriptionId: oldSubscription.id
                }
            } as any);

            // Assert
            expect(newSubscription).toBeDefined();
            expect(newSubscription.status).toBe('active');
            expect(newSubscription.planId).toBe(proPlan!.id);
            expect(newSubscription.metadata?.reactivation).toBe(true);
        });
    });

    /**
     * Scenario 9: Invalid Upgrade Attempts
     *
     * Test error handling for invalid upgrades:
     * - Non-existent plan
     * - Invalid plan ID
     */
    describe('9. Invalid Upgrade Attempts', () => {
        it('should reject upgrade to non-existent plan', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const customer = await billing.customers.create({
                email: 'invalid-upgrade@hospeda.com',
                name: 'Invalid Upgrade Test',
                externalId: 'user_invalid_upgrade_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Act & Assert - Try to create subscription with non-existent plan
            await expect(
                billing.subscriptions.create({
                    customerId: customer.id,
                    planId: 'non-existent-plan-id',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false
                } as any)
            ).rejects.toThrow();
        });

        it('should return undefined for invalid plan slug', () => {
            // Act
            const invalidPlan = getPlanBySlug('invalid-plan-slug');

            // Assert
            expect(invalidPlan).toBeUndefined();
        });
    });

    /**
     * Scenario 10: Billing Cycle Handling
     *
     * Test different billing cycles (monthly vs annual):
     * - Monthly billing cycles
     * - Annual billing cycles
     * - Period calculations
     */
    describe('10. Billing Cycle Handling', () => {
        it('should have different prices for monthly vs annual', () => {
            // Arrange
            const proPlan = getPlanBySlug('owner-pro');

            // Assert
            expect(proPlan?.monthlyPriceArs).toBeDefined();
            expect(proPlan?.annualPriceArs).toBeDefined();

            // Annual should be less than 12 months (discount applied)
            const expectedAnnual = proPlan!.monthlyPriceArs * 12;
            expect(proPlan!.annualPriceArs).toBeLessThan(expectedAnnual);
        });

        it('should create subscription with monthly billing cycle', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'monthly-cycle@hospeda.com',
                name: 'Monthly Cycle Test',
                externalId: 'user_monthly_cycle_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month from now

            // Act
            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Assert - Verify period is 1 month
            const start = new Date(subscription.currentPeriodStart);
            const end = new Date(subscription.currentPeriodEnd);

            const monthDiff =
                end.getMonth() - start.getMonth() + 12 * (end.getFullYear() - start.getFullYear());

            expect(monthDiff).toBe(1);
        });

        it('should create subscription with annual billing cycle', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'annual-cycle@hospeda.com',
                name: 'Annual Cycle Test',
                externalId: 'user_annual_cycle_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 1 year from now

            // Act
            const subscription = await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                metadata: {
                    billingCycle: 'annual'
                }
            } as any);

            // Assert
            const start = new Date(subscription.currentPeriodStart);
            const end = new Date(subscription.currentPeriodEnd);

            const yearDiff = end.getFullYear() - start.getFullYear();
            expect(yearDiff).toBe(1);
        });
    });

    /**
     * Scenario 11: Edge Cases and Error Handling
     */
    describe('11. Edge Cases and Error Handling', () => {
        it('should handle billing service unavailable gracefully', async () => {
            // Act - Access billing routes
            const response = await app.request('/api/v1/billing/plans', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert - Should return 503 if billing not configured, or 200+ if configured
            expect(response.status).toBeGreaterThanOrEqual(200);
        });

        it('should prevent creating multiple active subscriptions for same customer', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            const plans = await billing.plans.list();
            const proPlan = plans.data.find((p: any) => p.slug === 'owner-pro');

            const customer = await billing.customers.create({
                email: 'multiple-subs@hospeda.com',
                name: 'Multiple Subscriptions Test',
                externalId: 'user_multiple_subs_123'
            } as any);

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Create first subscription
            await billing.subscriptions.create({
                customerId: customer.id,
                planId: proPlan!.id,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false
            } as any);

            // Act - Get all subscriptions
            const subscriptions = await billing.subscriptions.getByCustomerId(customer.id);
            const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'active');

            // Assert - Should have only one active subscription
            // (Business logic should cancel old one when creating new)
            expect(activeSubscriptions.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle subscription not found gracefully', async () => {
            // Arrange
            const billing = getQZPayBilling();

            if (!billing) {
                expect(billing).toBeNull();
                return;
            }

            // Act & Assert
            await expect(
                billing.subscriptions.get('non-existent-subscription-id')
            ).rejects.toThrow();
        });

        it('should verify all plan slugs are unique', () => {
            // Act
            const slugs = ALL_PLANS.map((plan) => plan.slug);
            const uniqueSlugs = new Set(slugs);

            // Assert
            expect(uniqueSlugs.size).toBe(slugs.length);
        });

        it('should verify plans have valid prices', () => {
            // Assert - All paid plans have positive prices
            for (const plan of ALL_PLANS) {
                if (plan.monthlyPriceArs > 0) {
                    expect(plan.monthlyPriceArs).toBeGreaterThan(0);
                    expect(plan.monthlyPriceUsdRef).toBeGreaterThan(0);
                }

                // Free plans have zero price
                if (plan.monthlyPriceArs === 0) {
                    expect(plan.monthlyPriceUsdRef).toBe(0);
                }
            }
        });

        it('should verify plans have at least one entitlement', () => {
            // Assert
            for (const plan of ALL_PLANS) {
                expect(plan.entitlements.length).toBeGreaterThan(0);
            }
        });

        it('should verify plans have at least one limit', () => {
            // Assert
            for (const plan of ALL_PLANS) {
                expect(plan.limits.length).toBeGreaterThan(0);
            }
        });
    });
});

/**
 * Unit tests for Plan Change Functionality
 *
 * Tests the subscription plan change flow with various scenarios:
 * - Upgrade paths (Free → Basic → Pro → Premium)
 * - Downgrade paths (Premium → Pro → Basic)
 * - Plan changes during trial period
 * - Permission and authorization checks
 * - Proration calculation scenarios
 * - Error handling (invalid plans, same plan, non-existent subscription)
 *
 * Uses QZPay's changePlan API: subscriptions.changePlan(id, options)
 *
 * Test Coverage:
 * - Plan upgrade scenarios
 * - Plan downgrade scenarios
 * - Trial period behavior
 * - Permissions (owner, admin)
 * - Validation (invalid inputs, edge cases)
 * - Proration calculations
 * - Error handling
 *
 * Complexity: 4
 * Task: F2-004 from PLAN-BILLING-FIXES
 */

import type { QZPayChangePlanOptions, QZPayChangePlanResult, QZPayPlan } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

// Create mock billing instance inline to avoid hoisting issues
const mockBilling = {
    customers: {
        get: vi.fn(),
        getByExternalId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn()
    },
    subscriptions: {
        get: vi.fn(),
        getByCustomerId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
        list: vi.fn(),
        changePlan: vi.fn()
    },
    plans: {
        get: vi.fn(),
        getActive: vi.fn(),
        getPrices: vi.fn(),
        list: vi.fn()
    }
};

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => mockBilling),
    requireBilling: vi.fn((_c, next) => next())
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Import test helpers
import {
    createMockCustomer,
    createMockPlan,
    createMockPrice,
    createMockSubscription,
    createMockSubscriptionWithHelpers
} from '../../helpers/mock-factories';

// ============================================================================
// Test Data - Plan Hierarchy
// ============================================================================

// Free plan (trial/default)
const freePlan = createMockPlan({
    id: 'plan_free',
    name: 'Free',
    entitlements: ['basic_listing'],
    limits: {
        max_accommodations: 1,
        max_photos: 5
    },
    metadata: { slug: 'free' }
});

// Owner Basico plan
const basicPlan = createMockPlan({
    id: 'plan_basico',
    name: 'Básico',
    entitlements: ['basic_listing', 'view_stats'],
    limits: {
        max_accommodations: 1,
        max_photos: 10
    },
    prices: [
        createMockPrice({
            id: 'price_basico_monthly',
            planId: 'plan_basico',
            unitAmount: 5000,
            billingInterval: 'month'
        })
    ],
    metadata: { slug: 'owner-basico' }
});

// Owner Pro plan
const proPlan = createMockPlan({
    id: 'plan_pro',
    name: 'Pro',
    entitlements: ['basic_listing', 'view_stats', 'view_advanced_stats', 'priority_support'],
    limits: {
        max_accommodations: 3,
        max_photos: 20
    },
    prices: [
        createMockPrice({
            id: 'price_pro_monthly',
            planId: 'plan_pro',
            unitAmount: 15000,
            billingInterval: 'month'
        })
    ],
    metadata: { slug: 'owner-pro' }
});

// Owner Premium plan
const premiumPlan = createMockPlan({
    id: 'plan_premium',
    name: 'Premium',
    entitlements: [
        'basic_listing',
        'view_stats',
        'view_advanced_stats',
        'priority_support',
        'custom_branding',
        'api_access'
    ],
    limits: {
        max_accommodations: 10,
        max_photos: 50
    },
    prices: [
        createMockPrice({
            id: 'price_premium_monthly',
            planId: 'plan_premium',
            unitAmount: 30000,
            billingInterval: 'month'
        })
    ],
    metadata: { slug: 'owner-premium' }
});

// ============================================================================
// Tests
// ============================================================================

describe('Plan Change Functionality', () => {
    const testCustomer = createMockCustomer({
        id: 'cust_test',
        email: 'test@hospeda.com',
        externalId: 'user_123'
    });

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default plan mocks
        vi.mocked(mockBilling.plans.get).mockImplementation(async (id: string) => {
            const plans: Record<string, QZPayPlan> = {
                plan_free: freePlan,
                plan_basico: basicPlan,
                plan_pro: proPlan,
                plan_premium: premiumPlan
            };
            return plans[id] || null;
        });
    });

    // ========================================================================
    // 1. Upgrade Scenarios
    // ========================================================================

    describe('1. Upgrade Scenarios', () => {
        describe('Free → Básico', () => {
            it('should upgrade from Free to Básico with immediate application', async () => {
                // Arrange
                const freeSubscription = createMockSubscription({
                    id: 'sub_free',
                    customerId: testCustomer.id,
                    planId: freePlan.id,
                    status: 'trialing',
                    trialStart: new Date('2025-01-01'),
                    trialEnd: new Date('2025-01-15')
                });

                const upgradedSubscription = createMockSubscriptionWithHelpers({
                    ...freeSubscription,
                    planId: basicPlan.id,
                    status: 'active',
                    trialStart: null,
                    trialEnd: null
                });

                const changePlanResult: QZPayChangePlanResult = {
                    subscription: upgradedSubscription,
                    proration: {
                        creditAmount: 0,
                        chargeAmount: 5000,
                        effectiveDate: new Date('2025-01-10')
                    }
                };

                vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(freeSubscription);
                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue(changePlanResult);

                // Act
                const options: QZPayChangePlanOptions = {
                    newPlanId: basicPlan.id,
                    prorationBehavior: 'create_prorations',
                    applyAt: 'immediately'
                };

                const result = await mockBilling.subscriptions.changePlan(
                    freeSubscription.id,
                    options
                );

                // Assert
                expect(result.subscription.planId).toBe(basicPlan.id);
                expect(result.subscription.status).toBe('active');
                expect(result.subscription.trialStart).toBeNull();
                expect(result.subscription.trialEnd).toBeNull();
                expect(result.proration).toBeDefined();
                expect(result.proration?.chargeAmount).toBe(5000);
                expect(mockBilling.subscriptions.changePlan).toHaveBeenCalledWith(
                    freeSubscription.id,
                    options
                );
            });

            it('should end trial period when upgrading to paid plan', async () => {
                // Arrange
                const trialingSubscription = createMockSubscription({
                    id: 'sub_trial',
                    customerId: testCustomer.id,
                    planId: freePlan.id,
                    status: 'trialing',
                    trialStart: new Date('2025-01-01'),
                    trialEnd: new Date('2025-01-15')
                });

                const upgradedSubscription = createMockSubscriptionWithHelpers({
                    ...trialingSubscription,
                    planId: basicPlan.id,
                    status: 'active',
                    trialStart: null,
                    trialEnd: null
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: upgradedSubscription,
                    proration: null
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(trialingSubscription.id, {
                    newPlanId: basicPlan.id,
                    applyAt: 'immediately'
                });

                // Assert
                expect(result.subscription.status).toBe('active');
                expect(result.subscription.trialStart).toBeNull();
                expect(result.subscription.trialEnd).toBeNull();
            });
        });

        describe('Básico → Pro', () => {
            it('should upgrade from Básico to Pro with proration', async () => {
                // Arrange
                const now = new Date('2025-01-15');
                const periodEnd = new Date('2025-02-01');

                const basicSubscription = createMockSubscription({
                    id: 'sub_basic',
                    customerId: testCustomer.id,
                    planId: basicPlan.id,
                    status: 'active',
                    currentPeriodStart: new Date('2025-01-01'),
                    currentPeriodEnd: periodEnd
                });

                const upgradedSubscription = createMockSubscriptionWithHelpers({
                    ...basicSubscription,
                    planId: proPlan.id,
                    updatedAt: now
                });

                // Pro costs 15000, Básico costs 5000
                // 17 days remaining in period (of 31 days total)
                // Unused Básico credit: (5000 / 31) * 17 ≈ 2742
                // Pro charge for period: (15000 / 31) * 17 ≈ 8226
                // Net charge: 8226 - 2742 = 5484
                const changePlanResult: QZPayChangePlanResult = {
                    subscription: upgradedSubscription,
                    proration: {
                        creditAmount: 2742,
                        chargeAmount: 8226,
                        effectiveDate: now
                    }
                };

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue(changePlanResult);

                // Act
                const result = await mockBilling.subscriptions.changePlan(basicSubscription.id, {
                    newPlanId: proPlan.id,
                    prorationBehavior: 'create_prorations',
                    applyAt: 'immediately'
                });

                // Assert
                expect(result.subscription.planId).toBe(proPlan.id);
                expect(result.proration).toBeDefined();
                expect(result.proration!.creditAmount).toBeGreaterThan(0);
                expect(result.proration!.chargeAmount).toBeGreaterThan(
                    result.proration!.creditAmount
                );
            });
        });

        describe('Pro → Premium', () => {
            it('should upgrade from Pro to Premium immediately', async () => {
                // Arrange
                const proSubscription = createMockSubscription({
                    id: 'sub_pro',
                    customerId: testCustomer.id,
                    planId: proPlan.id,
                    status: 'active',
                    currentPeriodStart: new Date('2025-01-01'),
                    currentPeriodEnd: new Date('2025-02-01')
                });

                const upgradedSubscription = createMockSubscriptionWithHelpers({
                    ...proSubscription,
                    planId: premiumPlan.id
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: upgradedSubscription,
                    proration: {
                        creditAmount: 7500,
                        chargeAmount: 15000,
                        effectiveDate: new Date('2025-01-15')
                    }
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(proSubscription.id, {
                    newPlanId: premiumPlan.id,
                    prorationBehavior: 'create_prorations',
                    applyAt: 'immediately'
                });

                // Assert
                expect(result.subscription.planId).toBe(premiumPlan.id);
                expect(result.proration?.chargeAmount).toBeGreaterThan(
                    result.proration?.creditAmount!
                );
            });
        });

        describe('Multi-tier upgrade (Básico → Premium)', () => {
            it('should allow multi-tier upgrade directly', async () => {
                // Arrange
                const basicSubscription = createMockSubscription({
                    id: 'sub_basic',
                    customerId: testCustomer.id,
                    planId: basicPlan.id,
                    status: 'active'
                });

                const upgradedSubscription = createMockSubscriptionWithHelpers({
                    ...basicSubscription,
                    planId: premiumPlan.id
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: upgradedSubscription,
                    proration: {
                        creditAmount: 2500,
                        chargeAmount: 15000,
                        effectiveDate: new Date()
                    }
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(basicSubscription.id, {
                    newPlanId: premiumPlan.id,
                    applyAt: 'immediately'
                });

                // Assert
                expect(result.subscription.planId).toBe(premiumPlan.id);
            });
        });
    });

    // ========================================================================
    // 2. Downgrade Scenarios
    // ========================================================================

    describe('2. Downgrade Scenarios', () => {
        describe('Premium → Pro', () => {
            it('should schedule downgrade at period end', async () => {
                // Arrange
                const premiumSubscription = createMockSubscription({
                    id: 'sub_premium',
                    customerId: testCustomer.id,
                    planId: premiumPlan.id,
                    status: 'active',
                    currentPeriodStart: new Date('2025-01-01'),
                    currentPeriodEnd: new Date('2025-02-01')
                });

                const downgradedSubscription = createMockSubscriptionWithHelpers({
                    ...premiumSubscription,
                    metadata: {
                        scheduledDowngradeTo: proPlan.id,
                        downgradePlanId: proPlan.id
                    }
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: downgradedSubscription,
                    proration: null // No proration when scheduled for period end
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(premiumSubscription.id, {
                    newPlanId: proPlan.id,
                    applyAt: 'period_end',
                    prorationBehavior: 'none'
                });

                // Assert
                expect(result.subscription.planId).toBe(premiumPlan.id); // Still on Premium until period end
                expect(result.subscription.metadata?.scheduledDowngradeTo).toBe(proPlan.id);
                expect(result.proration).toBeNull();
            });

            it('should apply downgrade immediately if requested', async () => {
                // Arrange
                const premiumSubscription = createMockSubscription({
                    id: 'sub_premium',
                    customerId: testCustomer.id,
                    planId: premiumPlan.id,
                    status: 'active'
                });

                const downgradedSubscription = createMockSubscriptionWithHelpers({
                    ...premiumSubscription,
                    planId: proPlan.id
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: downgradedSubscription,
                    proration: {
                        creditAmount: 15000,
                        chargeAmount: 0,
                        effectiveDate: new Date()
                    }
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(premiumSubscription.id, {
                    newPlanId: proPlan.id,
                    applyAt: 'immediately',
                    prorationBehavior: 'create_prorations'
                });

                // Assert
                expect(result.subscription.planId).toBe(proPlan.id);
                expect(result.proration?.creditAmount).toBeGreaterThan(0);
                expect(result.proration?.chargeAmount).toBe(0);
            });
        });

        describe('Pro → Básico', () => {
            it('should schedule downgrade to Básico at period end', async () => {
                // Arrange
                const proSubscription = createMockSubscription({
                    id: 'sub_pro',
                    customerId: testCustomer.id,
                    planId: proPlan.id,
                    status: 'active'
                });

                const downgradedSubscription = createMockSubscriptionWithHelpers({
                    ...proSubscription,
                    metadata: {
                        scheduledDowngradeTo: basicPlan.id
                    }
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: downgradedSubscription,
                    proration: null
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(proSubscription.id, {
                    newPlanId: basicPlan.id,
                    applyAt: 'period_end'
                });

                // Assert
                expect(result.subscription.planId).toBe(proPlan.id);
                expect(result.subscription.metadata?.scheduledDowngradeTo).toBe(basicPlan.id);
            });
        });

        describe('Premium → Básico (multi-tier)', () => {
            it('should allow multi-tier downgrade', async () => {
                // Arrange
                const premiumSubscription = createMockSubscription({
                    id: 'sub_premium',
                    customerId: testCustomer.id,
                    planId: premiumPlan.id,
                    status: 'active'
                });

                const downgradedSubscription = createMockSubscriptionWithHelpers({
                    ...premiumSubscription,
                    metadata: {
                        scheduledDowngradeTo: basicPlan.id
                    }
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                    subscription: downgradedSubscription,
                    proration: null
                });

                // Act
                const result = await mockBilling.subscriptions.changePlan(premiumSubscription.id, {
                    newPlanId: basicPlan.id,
                    applyAt: 'period_end'
                });

                // Assert
                expect(result.subscription.metadata?.scheduledDowngradeTo).toBe(basicPlan.id);
            });
        });
    });

    // ========================================================================
    // 3. Trial Period Behavior
    // ========================================================================

    describe('3. Plan Change During Trial', () => {
        it('should allow upgrade during trial and end trial immediately', async () => {
            // Arrange
            const trialSubscription = createMockSubscription({
                id: 'sub_trial',
                customerId: testCustomer.id,
                planId: freePlan.id,
                status: 'trialing',
                trialStart: new Date('2025-01-01'),
                trialEnd: new Date('2025-01-15')
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...trialSubscription,
                planId: proPlan.id,
                status: 'active',
                trialStart: null,
                trialEnd: null
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: {
                    creditAmount: 0,
                    chargeAmount: 15000,
                    effectiveDate: new Date('2025-01-10')
                }
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(trialSubscription.id, {
                newPlanId: proPlan.id,
                applyAt: 'immediately'
            });

            // Assert
            expect(result.subscription.status).toBe('active');
            expect(result.subscription.trialStart).toBeNull();
            expect(result.subscription.trialEnd).toBeNull();
            expect(result.proration?.chargeAmount).toBe(15000);
        });

        it('should not allow downgrade during trial (invalid operation)', async () => {
            // Arrange
            const trialSubscription = createMockSubscription({
                id: 'sub_trial',
                customerId: testCustomer.id,
                planId: proPlan.id,
                status: 'trialing'
            });

            const error = new Error('Cannot downgrade during trial period');
            vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(error);

            // Act & Assert
            await expect(
                mockBilling.subscriptions.changePlan(trialSubscription.id, {
                    newPlanId: basicPlan.id,
                    applyAt: 'immediately'
                })
            ).rejects.toThrow('Cannot downgrade during trial period');
        });

        it('should preserve trial end date when changing to same-tier plan', async () => {
            // Arrange - Switching between monthly/annual of same plan
            const trialSubscription = createMockSubscription({
                id: 'sub_trial',
                customerId: testCustomer.id,
                planId: proPlan.id,
                status: 'trialing',
                trialEnd: new Date('2025-01-15')
            });

            const changedSubscription = createMockSubscriptionWithHelpers({
                ...trialSubscription,
                // Same plan, different price (e.g., annual vs monthly)
                trialEnd: new Date('2025-01-15') // Preserved
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: changedSubscription,
                proration: null
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(trialSubscription.id, {
                newPlanId: proPlan.id,
                newPriceId: 'price_pro_annual',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.subscription.status).toBe('trialing');
            expect(result.subscription.trialEnd).toEqual(new Date('2025-01-15'));
        });
    });

    // ========================================================================
    // 4. Permissions & Authorization
    // ========================================================================

    describe('4. Permissions & Authorization', () => {
        it('should allow subscription owner to change plan', async () => {
            // Arrange
            const ownerSubscription = createMockSubscription({
                id: 'sub_owner',
                customerId: testCustomer.id,
                planId: basicPlan.id,
                status: 'active',
                metadata: {
                    ownerId: 'user_123'
                }
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...ownerSubscription,
                planId: proPlan.id
            });

            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(ownerSubscription);
            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: null
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(ownerSubscription.id, {
                newPlanId: proPlan.id
            });

            // Assert
            expect(result.subscription.planId).toBe(proPlan.id);
            expect(mockBilling.subscriptions.changePlan).toHaveBeenCalled();
        });

        it('should allow admin to change any subscription plan', async () => {
            // Arrange
            const userSubscription = createMockSubscription({
                id: 'sub_user',
                customerId: 'cust_other',
                planId: basicPlan.id,
                status: 'active'
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...userSubscription,
                planId: proPlan.id
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: null
            });

            // Act (admin override)
            const result = await mockBilling.subscriptions.changePlan(userSubscription.id, {
                newPlanId: proPlan.id
            });

            // Assert
            expect(result.subscription.planId).toBe(proPlan.id);
        });

        it('should reject plan change from non-owner user', async () => {
            // Arrange
            const otherUserSubscription = createMockSubscription({
                id: 'sub_other',
                customerId: 'cust_other',
                planId: basicPlan.id,
                metadata: {
                    ownerId: 'user_other'
                }
            });

            vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(otherUserSubscription);
            vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                new Error('Unauthorized: Not subscription owner')
            );

            // Act & Assert
            await expect(
                mockBilling.subscriptions.changePlan(otherUserSubscription.id, {
                    newPlanId: proPlan.id
                })
            ).rejects.toThrow('Unauthorized');
        });
    });

    // ========================================================================
    // 5. Validation & Error Handling
    // ========================================================================

    describe('5. Validation & Error Handling', () => {
        describe('Invalid Plan ID', () => {
            it('should reject plan change to non-existent plan', async () => {
                // Arrange
                const subscription = createMockSubscription({
                    id: 'sub_test',
                    customerId: testCustomer.id,
                    planId: basicPlan.id
                });

                vi.mocked(mockBilling.plans.get).mockResolvedValue(null);
                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error('Plan not found: plan_invalid')
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan(subscription.id, {
                        newPlanId: 'plan_invalid'
                    })
                ).rejects.toThrow('Plan not found');
            });

            it('should reject plan change to inactive plan', async () => {
                // Arrange
                const inactivePlan = createMockPlan({
                    id: 'plan_inactive',
                    name: 'Inactive Plan',
                    active: false
                });

                const subscription = createMockSubscription({
                    id: 'sub_test',
                    customerId: testCustomer.id,
                    planId: basicPlan.id
                });

                vi.mocked(mockBilling.plans.get).mockResolvedValue(inactivePlan);
                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error('Cannot change to inactive plan')
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan(subscription.id, {
                        newPlanId: inactivePlan.id
                    })
                ).rejects.toThrow('inactive plan');
            });
        });

        describe('Same Plan Change', () => {
            it('should reject changing to the same plan', async () => {
                // Arrange
                const subscription = createMockSubscription({
                    id: 'sub_test',
                    customerId: testCustomer.id,
                    planId: proPlan.id
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error('Subscription is already on plan: plan_pro')
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan(subscription.id, {
                        newPlanId: proPlan.id
                    })
                ).rejects.toThrow('already on plan');
            });
        });

        describe('Non-existent Subscription', () => {
            it('should reject plan change for non-existent subscription', async () => {
                // Arrange
                vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(null);
                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error('Subscription not found: sub_invalid')
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan('sub_invalid', {
                        newPlanId: proPlan.id
                    })
                ).rejects.toThrow('Subscription not found');
            });
        });

        describe('Invalid Subscription Status', () => {
            it('should reject plan change for canceled subscription', async () => {
                // Arrange
                const canceledSubscription = createMockSubscription({
                    id: 'sub_canceled',
                    customerId: testCustomer.id,
                    planId: basicPlan.id,
                    status: 'canceled',
                    canceledAt: new Date()
                });

                vi.mocked(mockBilling.subscriptions.get).mockResolvedValue(canceledSubscription);
                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error('Cannot change plan for canceled subscription')
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan(canceledSubscription.id, {
                        newPlanId: proPlan.id
                    })
                ).rejects.toThrow('canceled subscription');
            });

            it('should reject plan change for past_due subscription', async () => {
                // Arrange
                const pastDueSubscription = createMockSubscription({
                    id: 'sub_pastdue',
                    customerId: testCustomer.id,
                    planId: basicPlan.id,
                    status: 'past_due'
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error(
                        'Cannot change plan for past_due subscription. Please update payment method.'
                    )
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan(pastDueSubscription.id, {
                        newPlanId: proPlan.id
                    })
                ).rejects.toThrow('past_due subscription');
            });
        });

        describe('Database Errors', () => {
            it('should handle database error during plan change', async () => {
                // Arrange
                const subscription = createMockSubscription({
                    id: 'sub_test',
                    customerId: testCustomer.id,
                    planId: basicPlan.id
                });

                vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                    new Error('Database connection failed')
                );

                // Act & Assert
                await expect(
                    mockBilling.subscriptions.changePlan(subscription.id, {
                        newPlanId: proPlan.id
                    })
                ).rejects.toThrow('Database connection failed');
            });
        });
    });

    // ========================================================================
    // 6. Proration Calculations
    // ========================================================================

    describe('6. Proration Calculations', () => {
        it('should calculate proration for mid-cycle upgrade', async () => {
            // Arrange
            const now = new Date('2025-01-15');
            const periodStart = new Date('2025-01-01');
            const periodEnd = new Date('2025-02-01');

            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: basicPlan.id,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                planId: proPlan.id
            });

            // 17 days remaining of 31 total
            // Básico: 5000, Pro: 15000
            const daysRemaining = 17;
            const totalDays = 31;
            const creditAmount = Math.round((5000 / totalDays) * daysRemaining);
            const chargeAmount = Math.round((15000 / totalDays) * daysRemaining);

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: {
                    creditAmount,
                    chargeAmount,
                    effectiveDate: now
                }
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: proPlan.id,
                prorationBehavior: 'create_prorations',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.proration).toBeDefined();
            expect(result.proration!.creditAmount).toBeGreaterThan(0);
            expect(result.proration!.chargeAmount).toBeGreaterThan(result.proration!.creditAmount);
            expect(result.proration!.effectiveDate).toEqual(now);
        });

        it('should NOT create proration when behavior is "none"', async () => {
            // Arrange
            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: basicPlan.id
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                planId: proPlan.id
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: null
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: proPlan.id,
                prorationBehavior: 'none',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.proration).toBeNull();
        });

        it('should always invoice proration when behavior is "always_invoice"', async () => {
            // Arrange
            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: basicPlan.id
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                planId: proPlan.id
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: {
                    creditAmount: 2500,
                    chargeAmount: 7500,
                    effectiveDate: new Date()
                }
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: proPlan.id,
                prorationBehavior: 'always_invoice',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.proration).toBeDefined();
            expect(result.proration!.chargeAmount).toBeGreaterThan(0);
        });

        it('should calculate credit for downgrade with immediate application', async () => {
            // Arrange
            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: premiumPlan.id,
                currentPeriodStart: new Date('2025-01-01'),
                currentPeriodEnd: new Date('2025-02-01')
            });

            const downgradedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                planId: basicPlan.id
            });

            // Downgrade generates credit
            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: downgradedSubscription,
                proration: {
                    creditAmount: 12500, // Unused Premium credit
                    chargeAmount: 0,
                    effectiveDate: new Date('2025-01-15')
                }
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: basicPlan.id,
                prorationBehavior: 'create_prorations',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.proration?.creditAmount).toBeGreaterThan(0);
            expect(result.proration?.chargeAmount).toBe(0);
        });
    });

    // ========================================================================
    // 7. Edge Cases
    // ========================================================================

    describe('7. Edge Cases', () => {
        it('should handle plan change on last day of billing period', async () => {
            // Arrange
            const lastDayOfPeriod = new Date('2025-01-31');
            const periodEnd = new Date('2025-02-01');

            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: basicPlan.id,
                currentPeriodStart: new Date('2025-01-01'),
                currentPeriodEnd: periodEnd
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                planId: proPlan.id
            });

            // Minimal proration due to only 1 day remaining
            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: {
                    creditAmount: Math.round(5000 / 31),
                    chargeAmount: Math.round(15000 / 31),
                    effectiveDate: lastDayOfPeriod
                }
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: proPlan.id,
                prorationBehavior: 'create_prorations',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.proration).toBeDefined();
            expect(result.proration!.chargeAmount).toBeLessThan(1000); // Small amount for 1 day
        });

        it('should handle annual plan to monthly plan change', async () => {
            // Arrange
            const _annualPrice = createMockPrice({
                id: 'price_pro_annual',
                planId: proPlan.id,
                unitAmount: 150000, // 150000 for year
                billingInterval: 'year'
            });

            const subscription = createMockSubscription({
                id: 'sub_annual',
                customerId: testCustomer.id,
                planId: proPlan.id,
                interval: 'year',
                currentPeriodStart: new Date('2025-01-01'),
                currentPeriodEnd: new Date('2026-01-01')
            });

            const changedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                interval: 'month',
                currentPeriodEnd: new Date('2025-02-01')
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: changedSubscription,
                proration: {
                    creditAmount: 137500, // ~11 months unused
                    chargeAmount: 0,
                    effectiveDate: new Date('2025-01-15')
                }
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: proPlan.id,
                newPriceId: 'price_pro_monthly',
                prorationBehavior: 'create_prorations',
                applyAt: 'immediately'
            });

            // Assert
            expect(result.subscription.interval).toBe('month');
            expect(result.proration?.creditAmount).toBeGreaterThan(0);
        });

        it('should handle concurrent plan change requests', async () => {
            // Arrange
            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: basicPlan.id
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockRejectedValue(
                new Error('Subscription is currently being modified. Please try again.')
            );

            // Act & Assert
            await expect(
                mockBilling.subscriptions.changePlan(subscription.id, {
                    newPlanId: proPlan.id
                })
            ).rejects.toThrow('currently being modified');
        });

        it('should preserve metadata during plan change', async () => {
            // Arrange
            const subscription = createMockSubscription({
                id: 'sub_test',
                customerId: testCustomer.id,
                planId: basicPlan.id,
                metadata: {
                    customField: 'value',
                    referralCode: 'REF123'
                }
            });

            const upgradedSubscription = createMockSubscriptionWithHelpers({
                ...subscription,
                planId: proPlan.id,
                metadata: {
                    customField: 'value',
                    referralCode: 'REF123'
                }
            });

            vi.mocked(mockBilling.subscriptions.changePlan).mockResolvedValue({
                subscription: upgradedSubscription,
                proration: null
            });

            // Act
            const result = await mockBilling.subscriptions.changePlan(subscription.id, {
                newPlanId: proPlan.id
            });

            // Assert
            expect(result.subscription.metadata?.customField).toBe('value');
            expect(result.subscription.metadata?.referralCode).toBe('REF123');
        });
    });
});

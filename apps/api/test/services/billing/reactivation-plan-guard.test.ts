/**
 * Unit tests for the reactivation plan-resolution guard (HOS-114 T-004,
 * extended for the annual interval by HOS-123 T-003).
 *
 * Covers:
 * - Valid monthly paid plan -> returns `{ plan, priceId, interval: 'monthly' }`
 *   with the plan's monthly price id.
 * - Unknown `planId` -> throws `SubscriptionCheckoutError('PLAN_NOT_FOUND')`
 *   (fail-closed), regardless of `billingInterval`.
 * - Free plan (`monthlyPrice.unitAmount === 0`) -> throws
 *   `SubscriptionCheckoutError('INVALID_REACTIVATION_PLAN')`.
 * - Annual-only plan requested as monthly (no active monthly price) -> throws
 *   `SubscriptionCheckoutError('ANNUAL_REACTIVATION_UNSUPPORTED')`.
 * - `billingInterval: 'annual'` + valid annual price -> returns
 *   `{ plan, priceId, interval: 'annual' }` (HOS-123).
 * - `billingInterval: 'annual'` + no active annual price -> throws
 *   `SubscriptionCheckoutError('NO_ANNUAL_PRICE')` (HOS-123).
 * - `billingInterval: 'annual'` + free annual price -> throws
 *   `SubscriptionCheckoutError('INVALID_REACTIVATION_PLAN')` (HOS-123).
 *
 * @module test/services/billing/reactivation-plan-guard
 */

import { describe, expect, it, vi } from 'vitest';
import { resolveReactivationPlan } from '../../../src/services/billing/reactivation-plan-guard';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';

const MONTHLY_PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const FREE_PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const ANNUAL_ONLY_PLAN_ID = '00000000-0000-4000-8000-0000000000cc';
const FREE_ANNUAL_PLAN_ID = '00000000-0000-4000-8000-0000000000dd';
const MONTHLY_PRICE_ID = 'price_monthly_1';
const ANNUAL_PRICE_ID = 'price_annual_1';

interface PriceFixture {
    id: string;
    billingInterval: 'month' | 'year' | 'day' | 'week';
    intervalCount: number;
    active: boolean;
    unitAmount: number;
}

function monthlyPrice(overrides: Partial<PriceFixture> = {}): PriceFixture {
    return {
        id: MONTHLY_PRICE_ID,
        billingInterval: 'month',
        intervalCount: 1,
        active: true,
        unitAmount: 3_500_000,
        ...overrides
    };
}

function annualPrice(overrides: Partial<PriceFixture> = {}): PriceFixture {
    return {
        id: ANNUAL_PRICE_ID,
        billingInterval: 'year',
        intervalCount: 1,
        active: true,
        unitAmount: 35_000_000,
        ...overrides
    };
}

function createPlan(id: string, name: string, prices: PriceFixture[]) {
    return { id, name, prices };
}

const MONTHLY_PAID_PLAN = createPlan(MONTHLY_PLAN_ID, 'owner-premium', [monthlyPrice()]);
const FREE_PLAN = createPlan(FREE_PLAN_ID, 'tourist-free', [monthlyPrice({ unitAmount: 0 })]);
const ANNUAL_ONLY_PLAN = createPlan(ANNUAL_ONLY_PLAN_ID, 'owner-annual-only', [annualPrice()]);
const FREE_ANNUAL_PLAN = createPlan(FREE_ANNUAL_PLAN_ID, 'tourist-free-annual', [
    annualPrice({ unitAmount: 0 })
]);

function createBillingMock(plans: ReturnType<typeof createPlan>[]) {
    return {
        plans: {
            list: vi.fn().mockResolvedValue({ data: plans })
        }
    };
}

describe('resolveReactivationPlan', () => {
    describe('when given a valid monthly paid plan', () => {
        it('should return the plan and its monthly price id', async () => {
            // Arrange
            const billing = createBillingMock([MONTHLY_PAID_PLAN]);

            // Act
            const result = await resolveReactivationPlan({
                billing: billing as any,
                planId: MONTHLY_PLAN_ID
            });

            // Assert
            expect(result.plan.id).toBe(MONTHLY_PLAN_ID);
            expect(result.priceId).toBe(MONTHLY_PRICE_ID);
            expect(result.interval).toBe('monthly');
        });

        it('should default to the monthly interval when billingInterval is omitted', async () => {
            // Arrange
            const billing = createBillingMock([MONTHLY_PAID_PLAN]);

            // Act
            const result = await resolveReactivationPlan({
                billing: billing as any,
                planId: MONTHLY_PLAN_ID
            });

            // Assert
            expect(result.interval).toBe('monthly');
        });

        it('should ignore an inactive monthly price row and resolve the active one', async () => {
            // Arrange
            const planWithStalePrice = createPlan(MONTHLY_PLAN_ID, 'owner-premium', [
                monthlyPrice({ id: 'price_inactive', active: false }),
                monthlyPrice({ id: 'price_active', active: true })
            ]);
            const billing = createBillingMock([planWithStalePrice]);

            // Act
            const result = await resolveReactivationPlan({
                billing: billing as any,
                planId: MONTHLY_PLAN_ID
            });

            // Assert
            expect(result.priceId).toBe('price_active');
        });
    });

    describe('when given an unknown planId', () => {
        it('should throw SubscriptionCheckoutError(PLAN_NOT_FOUND) and resolve no plan', async () => {
            // Arrange
            const billing = createBillingMock([MONTHLY_PAID_PLAN]);

            // Act & Assert
            await expect(
                resolveReactivationPlan({
                    billing: billing as any,
                    planId: 'nonexistent-plan-id'
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'PLAN_NOT_FOUND'
            });
        });

        it('should throw SubscriptionCheckoutError(PLAN_NOT_FOUND) regardless of billingInterval', async () => {
            // Arrange
            const billing = createBillingMock([MONTHLY_PAID_PLAN]);

            // Act & Assert
            await expect(
                resolveReactivationPlan({
                    billing: billing as any,
                    planId: 'nonexistent-plan-id',
                    billingInterval: 'annual'
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'PLAN_NOT_FOUND'
            });
        });

        it('should throw a real SubscriptionCheckoutError instance', async () => {
            // Arrange
            const billing = createBillingMock([]);

            // Act & Assert
            try {
                await resolveReactivationPlan({
                    billing: billing as any,
                    planId: 'nonexistent-plan-id'
                });
                expect.unreachable('resolveReactivationPlan should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(SubscriptionCheckoutError);
            }
        });
    });

    describe('when given a free plan', () => {
        it('should throw SubscriptionCheckoutError(INVALID_REACTIVATION_PLAN)', async () => {
            // Arrange
            const billing = createBillingMock([FREE_PLAN]);

            // Act & Assert
            await expect(
                resolveReactivationPlan({
                    billing: billing as any,
                    planId: FREE_PLAN_ID
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'INVALID_REACTIVATION_PLAN'
            });
        });
    });

    describe('when given an annual-only plan', () => {
        it('should throw SubscriptionCheckoutError(ANNUAL_REACTIVATION_UNSUPPORTED)', async () => {
            // Arrange
            const billing = createBillingMock([ANNUAL_ONLY_PLAN]);

            // Act & Assert
            await expect(
                resolveReactivationPlan({
                    billing: billing as any,
                    planId: ANNUAL_ONLY_PLAN_ID
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'ANNUAL_REACTIVATION_UNSUPPORTED'
            });
        });

        it('should not create any subscription (no side effects beyond plans.list)', async () => {
            // Arrange
            const billing = createBillingMock([ANNUAL_ONLY_PLAN]);

            // Act
            await resolveReactivationPlan({
                billing: billing as any,
                planId: ANNUAL_ONLY_PLAN_ID
            }).catch(() => undefined);

            // Assert
            expect(billing.plans.list).toHaveBeenCalledTimes(1);
        });
    });

    describe('when billingInterval is "annual"', () => {
        it('should return the plan and its annual price id', async () => {
            // Arrange
            const billing = createBillingMock([ANNUAL_ONLY_PLAN]);

            // Act
            const result = await resolveReactivationPlan({
                billing: billing as any,
                planId: ANNUAL_ONLY_PLAN_ID,
                billingInterval: 'annual'
            });

            // Assert
            expect(result.plan.id).toBe(ANNUAL_ONLY_PLAN_ID);
            expect(result.priceId).toBe(ANNUAL_PRICE_ID);
            expect(result.interval).toBe('annual');
        });

        it('should throw SubscriptionCheckoutError(NO_ANNUAL_PRICE) when the plan has no active annual price', async () => {
            // Arrange
            const billing = createBillingMock([MONTHLY_PAID_PLAN]);

            // Act & Assert
            await expect(
                resolveReactivationPlan({
                    billing: billing as any,
                    planId: MONTHLY_PLAN_ID,
                    billingInterval: 'annual'
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'NO_ANNUAL_PRICE'
            });
        });

        it('should throw SubscriptionCheckoutError(INVALID_REACTIVATION_PLAN) when the annual price is free', async () => {
            // Arrange
            const billing = createBillingMock([FREE_ANNUAL_PLAN]);

            // Act & Assert
            await expect(
                resolveReactivationPlan({
                    billing: billing as any,
                    planId: FREE_ANNUAL_PLAN_ID,
                    billingInterval: 'annual'
                })
            ).rejects.toMatchObject({
                name: 'SubscriptionCheckoutError',
                code: 'INVALID_REACTIVATION_PLAN'
            });
        });

        it('should ignore an inactive annual price row and resolve the active one', async () => {
            // Arrange
            const planWithStalePrice = createPlan(ANNUAL_ONLY_PLAN_ID, 'owner-annual-only', [
                annualPrice({ id: 'price_annual_inactive', active: false }),
                annualPrice({ id: 'price_annual_active', active: true })
            ]);
            const billing = createBillingMock([planWithStalePrice]);

            // Act
            const result = await resolveReactivationPlan({
                billing: billing as any,
                planId: ANNUAL_ONLY_PLAN_ID,
                billingInterval: 'annual'
            });

            // Assert
            expect(result.priceId).toBe('price_annual_active');
        });
    });
});

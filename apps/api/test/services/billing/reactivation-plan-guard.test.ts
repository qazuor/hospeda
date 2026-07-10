/**
 * Unit tests for the reactivation plan-resolution guard (HOS-114 T-004).
 *
 * Covers:
 * - Valid monthly paid plan -> returns `{ plan, priceId }` with the plan's
 *   monthly price id.
 * - Unknown `planId` -> throws `SubscriptionCheckoutError('PLAN_NOT_FOUND')`
 *   (fail-closed).
 * - Free plan (`monthlyPrice.unitAmount === 0`) -> throws
 *   `SubscriptionCheckoutError('INVALID_REACTIVATION_PLAN')`.
 * - Annual-only plan (no active monthly price) -> throws
 *   `SubscriptionCheckoutError('ANNUAL_REACTIVATION_UNSUPPORTED')`.
 *
 * @module test/services/billing/reactivation-plan-guard
 */

import { describe, expect, it, vi } from 'vitest';
import { resolveReactivationPlan } from '../../../src/services/billing/reactivation-plan-guard';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';

const MONTHLY_PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const FREE_PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const ANNUAL_ONLY_PLAN_ID = '00000000-0000-4000-8000-0000000000cc';
const MONTHLY_PRICE_ID = 'price_monthly_1';

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
        id: 'price_annual_1',
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
});

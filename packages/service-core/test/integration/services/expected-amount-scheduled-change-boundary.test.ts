import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription
} from './reconciliation-sweep-fixtures.js';
import { seedDifferentScheduledAmount } from './support/period-comparison-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

/**
 * HOS-2342: a customer downgrade queues `effectiveAt = nextChargeAt`, and the provider
 * already charges the destination price at that date. "Mi suscripción" asks the policy
 * with `chargeCreatedAt = nextChargeAt`, so the equal instant must resolve to the destination.
 */
describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2342 expected amount at the scheduled change boundary',
    () => {
        const at = new Date('2026-11-21T23:23:53.000Z');

        async function seedDowngrade() {
            const { fake } = createReconciliationFake(reconciliationClock);
            const seeded = await seedSubscription({
                status: 'ACTIVE',
                withLink: true,
                fake,
                amountMinor: 650_000
            });
            await seedDifferentScheduledAmount({
                subscriptionId: seeded.subscription.id,
                effectiveAt: at
            });
            return seeded.subscription;
        }

        it('charges the destination price when the next charge is exactly the effective instant', async () => {
            // Arrange
            const subscription = await seedDowngrade();
            // Act
            const result = await createCutExpectedAmountPolicy().expectedAmount({
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: at }
            });
            // Assert
            expect(result).toEqual({
                kind: 'COMPARABLE',
                amountMinor: 350_000,
                currency: 'ARS',
                source: 'SCHEDULED_CHANGE'
            });
        });

        it('keeps the anchored price for a charge one millisecond before the change', async () => {
            // Arrange
            const subscription = await seedDowngrade();
            // Act
            const result = await createCutExpectedAmountPolicy().expectedAmount({
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: new Date(at.getTime() - 1) }
            });
            // Assert
            expect(result).toEqual({
                kind: 'COMPARABLE',
                amountMinor: 650_000,
                currency: 'ARS',
                source: 'ANCHORED'
            });
        });
    }
);

import {
    eq,
    planMigrationSubscriptions,
    planMigrations,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { canPause } from '../../../src/services/billing/subscription/pause-policy.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { firstChargeHonouringNotice } from '../../../src/services/billing/subscription/price-increase-after-pause.js';
import { resumeSubscription } from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    adjustablePauseHarness,
    pausePlanPolicy,
    retirePauseRows,
    seedPausePrincipal
} from './support/pause-fixtures.js';
import { retirePriceIncreases, seedPriceIncrease } from './support/price-increase-fixtures.js';

const db = () => getServiceTestDb();
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};

afterEach(async () => {
    await retirePriceIncreases();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:4 price increase over a pause; provider amount mutation (S37) is B12',
    () => {
        it('allows S8, then reports the higher amount at the first resumed charge after notice', async () => {
            const harness = adjustablePauseHarness();
            const principal = await seedPausePrincipal({ harness });
            const announcedAt = new Date('2026-09-01T12:00:00.000Z');
            const effectiveAt = new Date('2026-10-31T12:00:00.000Z');
            const increase = await seedPriceIncrease({
                ...principal,
                sourcePlanVersionId: principal.planVersionId,
                announcedAt,
                effectiveAt
            });
            expect(increase.migration).toMatchObject({
                reason: 'PRICE_INCREASE',
                announcedAt,
                noticeDays: 60
            });
            expect(increase.participation).toMatchObject({
                subscriptionId: principal.subscriptionId,
                status: 'PENDIENTE',
                applicationDate: effectiveAt
            });
            expect(increase.scheduled).toMatchObject({
                subscriptionId: principal.subscriptionId,
                effectiveAt,
                planMigrationSubscriptionId: increase.participation.id
            });
            expect(
                await db()
                    .select()
                    .from(planMigrations)
                    .where(eq(planMigrations.id, increase.migration.id))
            ).toHaveLength(1);
            expect(
                await db()
                    .select()
                    .from(planMigrationSubscriptions)
                    .where(eq(planMigrationSubscriptions.id, increase.participation.id))
            ).toHaveLength(1);
            expect(
                await db()
                    .select()
                    .from(subscriptionScheduledChanges)
                    .where(eq(subscriptionScheduledChanges.id, increase.scheduled.id))
            ).toHaveLength(1);
            expect(
                await canPause(
                    { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                    { clock: harness.clock, planPolicy: pausePlanPolicy() }
                )
            ).toMatchObject({ allowed: true });
            const paused = await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                {
                    provider: harness.provider,
                    clock: harness.clock,
                    planPolicy: pausePlanPolicy(),
                    complements
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            if (paused.outcome !== 'PAUSED') throw new Error('S8 failed');
            expect(effectiveAt.getTime()).toBeGreaterThan(harness.clock.now().getTime());
            expect(effectiveAt.getTime()).toBeLessThan(paused.expectedEndAt.getTime());
            harness.fake.moveNextCharge({
                authorizationId: principal.authorizationId,
                at: new Date('2026-11-15T12:00:00.000Z')
            });
            harness.clock.set({ at: new Date('2026-10-20T12:00:00.000Z') });
            const result = await resumeSubscription(
                { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
                { provider: harness.provider, clock: harness.clock, complements }
            );
            expect(result.outcome).toBe('RESUMED');
            if (result.outcome !== 'RESUMED' || !result.nextChargeAt) throw new Error('S10 failed');
            expect(result.nextChargeAt).toEqual(new Date('2026-11-15T12:00:00.000Z'));
            expect(result.nextCharge).toEqual({
                at: result.nextChargeAt,
                amountMinor: 300000,
                currency: 'ARS'
            });
            expect(
                firstChargeHonouringNotice({
                    nextChargeAt: result.nextChargeAt,
                    announcedAt,
                    noticeDays: 60,
                    everyMonths: 1
                }).chargeAt
            ).toEqual(result.nextChargeAt);
            expect(
                (
                    await db()
                        .select({
                            status: subscriptions.status,
                            nextChargeAt: subscriptions.nextChargeAt
                        })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, principal.subscriptionId))
                )[0]
            ).toEqual({ status: 'ACTIVE', nextChargeAt: result.nextChargeAt });
        });

        it('keeps the old amount at an early charge before sixty days and defers the increase', async () => {
            const harness = adjustablePauseHarness();
            const principal = await seedPausePrincipal({ harness });
            const announcedAt = new Date('2026-09-20T12:00:00.000Z');
            const effectiveAt = new Date('2026-11-19T12:00:00.000Z');
            const increase = await seedPriceIncrease({
                ...principal,
                sourcePlanVersionId: principal.planVersionId,
                announcedAt,
                effectiveAt
            });
            expect(increase.participation.applicationDate).toEqual(effectiveAt);
            const paused = await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                {
                    provider: harness.provider,
                    clock: harness.clock,
                    planPolicy: pausePlanPolicy(),
                    complements
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            if (paused.outcome !== 'PAUSED') throw new Error('S8 failed');
            expect(effectiveAt.getTime()).toBeLessThan(paused.expectedEndAt.getTime());
            harness.fake.moveNextCharge({
                authorizationId: principal.authorizationId,
                at: new Date('2026-10-20T12:00:00.000Z')
            });
            harness.clock.set({ at: new Date('2026-10-15T12:00:00.000Z') });
            const result = await resumeSubscription(
                { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
                { provider: harness.provider, clock: harness.clock, complements }
            );
            expect(result.outcome).toBe('RESUMED');
            if (result.outcome !== 'RESUMED' || !result.nextChargeAt) throw new Error('S10 failed');
            expect(result.nextCharge).toEqual({
                at: new Date('2026-10-20T12:00:00.000Z'),
                amountMinor: 250000,
                currency: 'ARS'
            });
            expect(
                firstChargeHonouringNotice({
                    nextChargeAt: result.nextChargeAt,
                    announcedAt,
                    noticeDays: 60,
                    everyMonths: 1
                }).chargeAt
            ).toEqual(new Date('2026-11-20T12:00:00.000Z'));
        });

        it('reports the anchored amount when there is no increase', async () => {
            const harness = adjustablePauseHarness();
            const principal = await seedPausePrincipal({ harness });
            const paused = await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                {
                    provider: harness.provider,
                    clock: harness.clock,
                    planPolicy: pausePlanPolicy(),
                    complements
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            harness.fake.moveNextCharge({
                authorizationId: principal.authorizationId,
                at: new Date('2026-11-15T12:00:00.000Z')
            });
            harness.clock.set({ at: new Date('2026-11-01T12:00:00.000Z') });
            const result = await resumeSubscription(
                { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
                { provider: harness.provider, clock: harness.clock, complements }
            );
            expect(result.outcome).toBe('RESUMED');
            if (result.outcome !== 'RESUMED') throw new Error('S10 failed');
            expect(result.nextCharge).toEqual({
                at: new Date('2026-11-15T12:00:00.000Z'),
                amountMinor: 250000,
                currency: 'ARS'
            });
        });

        it('keeps S10 committed when the amount policy throws', async () => {
            const harness = adjustablePauseHarness();
            const principal = await seedPausePrincipal({ harness });
            const paused = await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                {
                    provider: harness.provider,
                    clock: harness.clock,
                    planPolicy: pausePlanPolicy(),
                    complements
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            harness.fake.moveNextCharge({
                authorizationId: principal.authorizationId,
                at: new Date('2026-11-15T12:00:00.000Z')
            });
            harness.clock.set({ at: new Date('2026-11-01T12:00:00.000Z') });
            const expectedAmount: ExpectedAmountPolicy = {
                expectedAmount: async () => {
                    throw new Error('Amount unavailable');
                }
            };
            const result = await resumeSubscription(
                { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
                { provider: harness.provider, clock: harness.clock, complements, expectedAmount }
            );
            expect(result.outcome).toBe('RESUMED');
            if (result.outcome !== 'RESUMED') throw new Error('S10 failed');
            expect(result.nextCharge).toBeNull();
            expect(
                (
                    await db()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, principal.subscriptionId))
                )[0]?.status
            ).toBe('ACTIVE');
        });
    }
);

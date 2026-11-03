import { billingOptions, courtesyGrants, eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { canPause } from '../../../src/services/billing/subscription/pause-policy.js';
import { readPauseQuota } from '../../../src/services/billing/subscription/pause-quota.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { complementNow, providerHarness } from './support/complement-fixtures.js';
import { pausePlanPolicy, retirePauseRows, seedPausePrincipal } from './support/pause-fixtures.js';

const clock = { now: () => complementNow };
afterEach(retirePauseRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('Pause policy reason order and quota', () => {
    it('returns the first applicable refusal reason', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness, paymentMethod: 'MANUAL' });
        await getServiceTestDb()
            .update(billingOptions)
            .set({ cycle: 'annual' })
            .where(eq(billingOptions.planVersionId, principal.planVersionId));
        expect(
            await canPause(
                { subscriptionId: principal.subscriptionId, requestedMonths: 5 },
                { clock, planPolicy: pausePlanPolicy(false) }
            )
        ).toEqual({ allowed: false, reason: 'MANUAL_PAYER' });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(
            await canPause(
                { subscriptionId: principal.subscriptionId, requestedMonths: 5 },
                { clock, planPolicy: pausePlanPolicy(false) }
            )
        ).toEqual({ allowed: false, reason: 'NOT_ACTIVE' });
    });

    it('rounds closed calendar months up and counts open requested months', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values([
                {
                    subscriptionId: principal.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    requestedMonths: 2,
                    startsAt: new Date('2026-06-01T12:00:00.000Z'),
                    expectedEndAt: new Date('2026-08-01T12:00:00.000Z'),
                    actualEndAt: new Date('2026-06-11T12:00:00.000Z')
                },
                {
                    subscriptionId: principal.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    requestedMonths: 2,
                    startsAt: new Date('2026-07-01T12:00:00.000Z'),
                    expectedEndAt: new Date('2026-09-01T12:00:00.000Z'),
                    actualEndAt: new Date('2026-08-02T12:00:00.000Z')
                },
                {
                    subscriptionId: principal.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    requestedMonths: 3,
                    startsAt: new Date('2026-09-01T12:00:00.000Z'),
                    expectedEndAt: new Date('2026-12-01T12:00:00.000Z')
                }
            ]);
        expect(
            await readPauseQuota({
                tx: getServiceTestDb(),
                userId: principal.userId,
                vertical: 'accommodation',
                now: complementNow
            })
        ).toEqual({ pausesInWindow: 3, monthsInWindow: 6 });
    });

    it('refuses while a courtesy grant with ends_at in the future exists', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        await getServiceTestDb()
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: principal.userId,
                grantedBy: principal.userId,
                subscriptionId: principal.subscriptionId,
                months: 2,
                startsAt: new Date('2026-10-01T12:00:00.000Z'),
                endsAt: new Date('2026-12-01T12:00:00.000Z'),
                reason: 'test courtesy'
            });
        expect(
            await canPause(
                { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                { clock, planPolicy: pausePlanPolicy() }
            )
        ).toEqual({ allowed: false, reason: 'COURTESY_IN_FORCE' });
    });
});

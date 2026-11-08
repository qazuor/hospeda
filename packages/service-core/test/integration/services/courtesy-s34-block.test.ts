import { courtesyGrants, eq, subscriptionPauses } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retireCourtesyFixtures, seedCourtesyPrincipal } from './support/courtesy-fixtures.js';
import { addonPolicyFromTx } from './support/coverage-fixtures.js';
import { pausePlanPolicy } from './support/pause-fixtures.js';

const db = getServiceTestDb();
afterEach(retireCourtesyFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9b:8 S34 and customer pause block', () => {
    it('extends the same grant and pause by two more months without another provider call', async () => {
        const s = await seedCourtesyPrincipal();
        const input = { subscriptionId: s.subscriptionId, grantedBy: s.userId, reason: 'S34 test' };
        const first = await grantTemporaryCourtesy({ ...input, months: 1 }, s.ports);
        const second = await grantTemporaryCourtesy({ ...input, months: 2 }, s.ports);
        expect(first).toMatchObject({
            outcome: 'GRANTED',
            endsAt: new Date('2026-11-14T12:00:00.000Z')
        });
        expect(second).toMatchObject({
            outcome: 'EXTENDED',
            endsAt: new Date('2027-01-14T12:00:00.000Z')
        });
        const pauses = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        const grants = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(pauses).toHaveLength(1);
        expect(grants).toHaveLength(1);
        expect(pauses[0]).toMatchObject({
            id: first.outcome === 'GRANTED' ? first.pauseId : '',
            expectedEndAt: new Date('2027-01-14T12:00:00.000Z'),
            actualEndAt: null
        });
        expect(grants[0]).toMatchObject({
            id: first.outcome === 'GRANTED' ? first.courtesyGrantId : '',
            months: 3,
            endsAt: pauses[0]?.expectedEndAt
        });
        expect(s.harness.calls).toEqual([
            `pause:${s.authorizationId}`,
            `read:${s.authorizationId}`
        ]);
    });
    it('refuses a customer-request pause and keeps it intact', async () => {
        const s = await seedCourtesyPrincipal();
        const paused = await pauseSubscription(
            { subscriptionId: s.subscriptionId, requestedMonths: 1 },
            {
                ...s.ports,
                planPolicy: pausePlanPolicy(),
                complements: {
                    addonPolicy: addonPolicyFromTx(db),
                    listing: async () => {
                        throw new Error('No listing addon seeded');
                    }
                }
            }
        );
        expect(paused.outcome).toBe('PAUSED');
        expect(
            await grantTemporaryCourtesy(
                {
                    subscriptionId: s.subscriptionId,
                    months: 1,
                    grantedBy: s.userId,
                    reason: 'blocked'
                },
                s.ports
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'SUBSCRIPTION_PAUSED' });
        const pauses = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        expect(pauses).toHaveLength(1);
        expect(pauses[0]).toMatchObject({ reason: 'CUSTOMER_REQUEST', actualEndAt: null });
    });
});

import { and, courtesyGrants, eq, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { forfeitCourtesyAndPause } from '../../../src/services/billing/subscription/forfeit-courtesy-pause.service.js';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { readPauseQuota } from '../../../src/services/billing/subscription/pause-quota.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retireComplementRows, seedCommittedComplement } from './support/complement-fixtures.js';
import {
    courtesyNow,
    retireCourtesyFixtures,
    seedCourtesyPrincipal
} from './support/courtesy-fixtures.js';
import { addonPolicyFromTx } from './support/coverage-fixtures.js';
import { pausePlanPolicy, seedClosedPause } from './support/pause-fixtures.js';

const db = getServiceTestDb();
const complements = {
    addonPolicy: addonPolicyFromTx(db),
    listing: async () => {
        throw new Error('Unexpected listing');
    }
};
const grant = async (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>) =>
    grantTemporaryCourtesy(
        { subscriptionId: s.subscriptionId, months: 2, grantedBy: s.userId, reason: 'S35 test' },
        s.ports
    );
const forfeit = async (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>, confirmed?: boolean) =>
    forfeitCourtesyAndPause(
        {
            subscriptionId: s.subscriptionId,
            requestedMonths: 2,
            courtesyForfeitConfirmed: confirmed
        },
        { ...s.ports, planPolicy: pausePlanPolicy(), complements }
    );
afterEach(async () => {
    await retireComplementRows();
    await retireCourtesyFixtures();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9b:8 S35 courtesy forfeit', () => {
    it('keeps the principal, courtesy pause and grant identical without confirmation', async () => {
        const s = await seedCourtesyPrincipal();
        expect((await grant(s)).outcome).toBe('GRANTED');
        const [beforeRow] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        const beforePauses = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        const beforeGrants = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        const calls = [...s.harness.calls];
        expect(await forfeit(s)).toEqual({
            outcome: 'REFUSED',
            reason: 'COURTESY_FORFEIT_NOT_CONFIRMED'
        });
        const [afterRow] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(afterRow).toEqual(beforeRow);
        expect(
            await db
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId))
        ).toEqual(beforePauses);
        expect(
            await db
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.subscriptionId, s.subscriptionId))
        ).toEqual(beforeGrants);
        expect(s.harness.calls).toEqual(calls);
    });
    it('closes courtesy first, ends its grant and opens one counted customer pause without principal provider calls', async () => {
        const s = await seedCourtesyPrincipal();
        expect((await grant(s)).outcome).toBe('GRANTED');
        const before = await readPauseQuota({
            tx: db,
            userId: s.userId,
            vertical: 'accommodation',
            now: courtesyNow
        });
        const calls = [...s.harness.calls];
        const result = await forfeit(s, true);
        expect(result).toMatchObject({
            outcome: 'PAUSED',
            expectedEndAt: new Date('2026-12-14T12:00:00.000Z')
        });
        const pauses = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        expect(pauses).toHaveLength(2);
        expect(pauses.find((p) => p.reason === 'COURTESY')).toMatchObject({
            actualEndAt: courtesyNow
        });
        expect(
            pauses.filter((p) => p.reason === 'CUSTOMER_REQUEST' && p.actualEndAt === null)
        ).toMatchObject([
            {
                requestedMonths: 2,
                startsAt: courtesyNow,
                expectedEndAt: new Date('2026-12-14T12:00:00.000Z')
            }
        ]);
        const [courtesy] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(courtesy?.endsAt).toEqual(courtesyNow);
        const [row] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(row?.status).toBe('PAUSED');
        const after = await readPauseQuota({
            tx: db,
            userId: s.userId,
            vertical: 'accommodation',
            now: courtesyNow
        });
        expect(after.pausesInWindow).toBe(before.pausesInWindow + 1);
        expect(after.monthsInWindow).toBe(before.monthsInWindow + 2);
        expect(s.harness.calls).toEqual(calls);
    });
    it('refuses a principal that is active', async () => {
        const s = await seedCourtesyPrincipal();
        expect(await forfeit(s, true)).toEqual({ outcome: 'REFUSED', reason: 'NOT_IN_COURTESY' });
        const open = await db
            .select()
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, s.subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );
        expect(open).toEqual([]);
    });
    it('pauses a vertical complement through S32', async () => {
        const s = await seedCourtesyPrincipal();
        expect((await grant(s)).outcome).toBe('GRANTED');
        const seeded = await seedCommittedComplement({
            fake: s.harness.fake,
            principalStatus: 'PAUSED',
            principal: { userId: s.userId, principalId: s.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const result = await forfeitCourtesyAndPause(
            {
                subscriptionId: s.subscriptionId,
                requestedMonths: 2,
                courtesyForfeitConfirmed: true
            },
            { ...s.ports, planPolicy: pausePlanPolicy(), complements: seeded.policy }
        );
        expect(result.outcome).toBe('PAUSED');
        if (result.outcome !== 'PAUSED') throw new Error('S35 did not pause');
        expect(result.complements.results).toMatchObject([{ outcome: 'PAUSED' }]);
        const [complement] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        expect(complement?.status).toBe('PAUSED');
    });
    it('keeps courtesy intact when the customer has exhausted the pause count', async () => {
        const s = await seedCourtesyPrincipal();
        expect((await grant(s)).outcome).toBe('GRANTED');
        // Seed three closed historical customer pauses: a second live principal is forbidden by the commitment index.
        for (const month of [1, 3, 5])
            await seedClosedPause({
                subscriptionId: s.subscriptionId,
                startsAt: new Date(Date.UTC(2026, month, 1, 12)),
                actualEndAt: new Date(Date.UTC(2026, month + 1, 1, 12)),
                requestedMonths: 1
            });
        const [beforePause] = await db
            .select()
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, s.subscriptionId),
                    eq(subscriptionPauses.reason, 'COURTESY')
                )
            );
        const [beforeGrant] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(await forfeit(s, true)).toEqual({
            outcome: 'REFUSED',
            reason: 'PAUSE_COUNT_EXHAUSTED'
        });
        const [afterPause] = await db
            .select()
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, s.subscriptionId),
                    eq(subscriptionPauses.reason, 'COURTESY')
                )
            );
        const [afterGrant] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(afterPause).toEqual(beforePause);
        expect(afterGrant).toEqual(beforeGrant);
    });
});

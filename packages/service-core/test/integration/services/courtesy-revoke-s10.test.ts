import {
    and,
    courtesyGrants,
    emailOutbox,
    eq,
    isNull,
    payments,
    reconciliationMarks,
    refunds,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { canPause } from '../../../src/services/billing/subscription/pause-policy.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { revokeTemporaryCourtesy } from '../../../src/services/billing/subscription/revoke-temporary-courtesy.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    courtesyNow,
    retireCourtesyFixtures,
    seedCourtesyPrincipal
} from './support/courtesy-fixtures.js';
import { addonPolicyFromTx } from './support/coverage-fixtures.js';
import { pausePlanPolicy } from './support/pause-fixtures.js';

const db = getServiceTestDb();
const complements = {
    addonPolicy: addonPolicyFromTx(db),
    listing: async () => {
        throw new Error('Unexpected listing');
    }
};
const grant = async (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>) =>
    grantTemporaryCourtesy(
        {
            subscriptionId: s.subscriptionId,
            months: 2,
            grantedBy: s.userId,
            reason: 'S10 revoke test'
        },
        s.ports
    );
const revoke = async (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>) =>
    revokeTemporaryCourtesy({ subscriptionId: s.subscriptionId }, { ...s.ports, complements });
afterEach(retireCourtesyFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9b:14 courtesy revocation is S10', () => {
    it('resumes through the provider, ends the grant and pause, and queues the charge date without refund', async () => {
        const s = await seedCourtesyPrincipal();
        const granted = await grant(s);
        expect(granted.outcome).toBe('GRANTED');
        const enqueuedAfter = new Date();
        const result = await revoke(s);
        expect(result.outcome).toBe('RESUMED');
        if (result.outcome !== 'RESUMED') throw new Error('S10 did not resume');
        expect(result.courtesyGrantId).toBe(
            granted.outcome === 'GRANTED' ? granted.courtesyGrantId : undefined
        );
        const [row] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        const [pause] = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        expect(pause).toMatchObject({ reason: 'COURTESY', actualEndAt: courtesyNow });
        const [courtesy] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(courtesy?.endsAt).toEqual(courtesyNow);
        const mail = await db
            .select({
                template: emailOutbox.template,
                payload: emailOutbox.payload,
                createdAt: emailOutbox.createdAt
            })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, s.userId),
                    eq(emailOutbox.template, 'billing.courtesy-revoked')
                )
            );
        expect(mail).toHaveLength(1);
        expect(mail[0]?.payload).toMatchObject({
            subscriptionId: s.subscriptionId,
            nextChargeOn: getLocalDateString({
                instant: result.nextChargeAt!,
                timeZone: 'Etc/GMT+4'
            })
        });
        expect(mail[0]?.createdAt).toEqual(expect.any(Date));
        expect(mail[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(enqueuedAfter.getTime());
        const ownRefunds = await db
            .select({ id: refunds.id })
            .from(refunds)
            .innerJoin(payments, eq(refunds.paymentId, payments.id))
            .where(eq(payments.subscriptionId, s.subscriptionId));
        expect(ownRefunds).toEqual([]);
        expect(s.harness.calls).toEqual([
            `pause:${s.authorizationId}`,
            `read:${s.authorizationId}`,
            `read:${s.authorizationId}`,
            `resume:${s.authorizationId}`,
            `read:${s.authorizationId}`
        ]);
        expect(
            await canPause(
                { subscriptionId: s.subscriptionId, requestedMonths: 1 },
                { clock: s.ports.clock, planPolicy: pausePlanPolicy() }
            )
        ).toMatchObject({ allowed: true });
    });
    it('keeps the row paused and the grant live if the provider reread still says paused', async () => {
        const s = await seedCourtesyPrincipal({ resumeAcknowledgesOnly: true });
        expect((await grant(s)).outcome).toBe('GRANTED');
        expect((await revoke(s)).outcome).toBe('NOT_APPLIED');
        const [row] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(row?.status).toBe('PAUSED');
        const [pause] = await db
            .select({ actualEndAt: subscriptionPauses.actualEndAt })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        expect(pause?.actualEndAt).toBeNull();
        const [courtesy] = await db
            .select({ endsAt: courtesyGrants.endsAt })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(courtesy?.endsAt).toEqual(new Date('2026-12-14T12:00:00.000Z'));
        const marks = await db
            .select({ reason: reconciliationMarks.reason })
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, s.subscriptionId),
                    eq(reconciliationMarks.reason, 'REANUDACION_NO_APLICADA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(marks).toEqual([{ reason: 'REANUDACION_NO_APLICADA' }]);
        const mail = await db
            .select({ id: emailOutbox.id })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, s.userId),
                    eq(emailOutbox.template, 'billing.courtesy-revoked')
                )
            );
        expect(mail).toEqual([]);
    });
    it('refuses a customer pause before contacting the provider', async () => {
        const s = await seedCourtesyPrincipal();
        expect(
            (
                await pauseSubscription(
                    { subscriptionId: s.subscriptionId, requestedMonths: 1 },
                    { ...s.ports, planPolicy: pausePlanPolicy(), complements }
                )
            ).outcome
        ).toBe('PAUSED');
        const calls = [...s.harness.calls];
        expect(await revoke(s)).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_COURTESY' });
        expect(s.harness.calls).toEqual(calls);
    });
});

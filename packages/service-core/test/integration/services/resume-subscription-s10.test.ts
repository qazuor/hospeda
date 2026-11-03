import {
    and,
    coveredPeriods,
    eq,
    isNull,
    manualPayments,
    payments,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ComplementPolicyPorts } from '../../../src/services/billing/subscription/complement-ports.js';
import { endDuePauses } from '../../../src/services/billing/subscription/end-due-pauses.service.js';
import { readPauseQuota } from '../../../src/services/billing/subscription/pause-quota.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { resumeSubscription } from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retireComplementRows, seedCommittedComplement } from './support/complement-fixtures.js';
import {
    adjustablePauseHarness,
    pausePlanPolicy,
    retirePauseRows,
    seedPausePrincipal
} from './support/pause-fixtures.js';

const db = () => getServiceTestDb();
const emptyComplements: ComplementPolicyPorts = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const ports = (
    harness: ReturnType<typeof adjustablePauseHarness>,
    complements: ComplementPolicyPorts = emptyComplements
) => ({
    provider: harness.provider,
    clock: harness.clock,
    complements
});
const pause = async (
    harness: ReturnType<typeof adjustablePauseHarness>,
    subscriptionId: string,
    requestedMonths: number,
    complements: ComplementPolicyPorts = emptyComplements
) =>
    pauseSubscription(
        { subscriptionId, requestedMonths },
        { ...ports(harness, complements), planPolicy: pausePlanPolicy() }
    );
const row = async (subscriptionId: string) => {
    const [subscription] = await db()
        .select({ status: subscriptions.status, nextChargeAt: subscriptions.nextChargeAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const [pauseRow] = await db()
        .select()
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, subscriptionId));
    return { subscription, pauseRow };
};

afterEach(async () => {
    await retireComplementRows();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:3 S10 principal return', () => {
    it('ends a customer pause at term, closes its row and resumes S33 complements', async () => {
        const harness = adjustablePauseHarness();
        const principal = await seedPausePrincipal({ harness });
        const complement = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const paused = await pause(harness, principal.subscriptionId, 2, complement.policy);
        expect(paused.outcome).toBe('PAUSED');
        if (paused.outcome !== 'PAUSED') throw new Error('S8 failed');
        expect((await row(complement.complementId)).subscription?.status).toBe('PAUSED');
        harness.clock.set({ at: paused.expectedEndAt });
        const result = await endDuePauses({ limit: 100 }, ports(harness, complement.policy));
        const actual = await row(principal.subscriptionId);
        const provider = await harness.fake.readAuthorization({
            authorizationId: principal.authorizationId
        });
        expect(result.resumed).toBe(1);
        expect(actual.subscription?.status).toBe('ACTIVE');
        expect(actual.pauseRow?.actualEndAt).toEqual(paused.expectedEndAt);
        expect((await row(complement.complementId)).subscription?.status).toBe('ACTIVE');
        expect(provider.snapshot.status).toBe('active');
        expect(actual.subscription?.nextChargeAt?.toISOString()).toBe(
            provider.snapshot.nextChargeAt
        );
        expect(actual.subscription?.nextChargeAt?.getTime()).toBeGreaterThan(
            paused.expectedEndAt.getTime()
        );
    });

    it('returns early after twenty days and counts only one used month', async () => {
        const harness = adjustablePauseHarness();
        const principal = await seedPausePrincipal({ harness });
        expect((await pause(harness, principal.subscriptionId, 3)).outcome).toBe('PAUSED');
        const early = new Date(harness.clock.now().getTime() + 20 * 86_400_000);
        harness.clock.set({ at: early });
        const result = await resumeSubscription(
            { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
            ports(harness)
        );
        const actual = await row(principal.subscriptionId);
        const quota = await readPauseQuota({
            tx: db(),
            userId: principal.userId,
            vertical: 'accommodation',
            now: early
        });
        expect(result.outcome).toBe('RESUMED');
        expect(actual.pauseRow?.actualEndAt).toEqual(early);
        expect(quota).toEqual({ pausesInWindow: 1, monthsInWindow: 1 });
    });

    it('leaves the pause open and opens one mark when the reread stays paused', async () => {
        const harness = adjustablePauseHarness({ resumeAcknowledgesOnly: true });
        const principal = await seedPausePrincipal({ harness });
        expect((await pause(harness, principal.subscriptionId, 2)).outcome).toBe('PAUSED');
        const result = await resumeSubscription(
            { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
            ports(harness)
        );
        const actual = await row(principal.subscriptionId);
        const marks = await db()
            .select({ reason: reconciliationMarks.reason })
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, principal.subscriptionId),
                    eq(reconciliationMarks.reason, 'REANUDACION_NO_APLICADA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(result.outcome).toBe('NOT_APPLIED');
        expect(actual.subscription?.status).toBe('PAUSED');
        expect(actual.pauseRow?.actualEndAt).toBeNull();
        expect(marks).toEqual([{ reason: 'REANUDACION_NO_APLICADA' }]);
    });

    it('advances every expired manual cycle without calling the provider or opening a payment', async () => {
        const harness = adjustablePauseHarness();
        const principal = await seedPausePrincipal({ harness, paymentMethod: 'MANUAL' });
        const now = harness.clock.now();
        const old = new Date(now);
        old.setUTCMonth(old.getUTCMonth() - 3);
        await db()
            .update(subscriptions)
            .set({ status: 'PAUSED', nextChargeAt: old })
            .where(eq(subscriptions.id, principal.subscriptionId));
        await db().insert(subscriptionPauses).values({
            subscriptionId: principal.subscriptionId,
            reason: 'COURTESY',
            startsAt: old,
            expectedEndAt: now,
            requestedMonths: 3
        });
        const result = await resumeSubscription(
            { subscriptionId: principal.subscriptionId, cause: 'TERM' },
            ports(harness)
        );
        const actual = await row(principal.subscriptionId);
        const expected = new Date(old);
        while (expected <= now) expected.setUTCMonth(expected.getUTCMonth() + 1);
        expect(result.outcome).toBe('RESUMED');
        expect(actual.subscription?.status).toBe('ACTIVE');
        expect(actual.subscription?.nextChargeAt).toEqual(expected);
        expect(harness.calls).toHaveLength(0);
        expect(
            (
                await db()
                    .select()
                    .from(manualPayments)
                    .where(eq(manualPayments.subscriptionId, principal.subscriptionId))
            ).length
        ).toBe(0);
        expect(
            (
                await db()
                    .select()
                    .from(payments)
                    .where(eq(payments.subscriptionId, principal.subscriptionId))
            ).length
        ).toBe(0);
        expect(
            (
                await db()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.subscriptionId, principal.subscriptionId))
            ).length
        ).toBe(0);
    });

    it('selects due rows by stored end regardless of reason and ignores a future provider return', async () => {
        const harness = adjustablePauseHarness();
        const future = await seedPausePrincipal({ harness });
        const courtesy = await seedPausePrincipal({ harness, paymentMethod: 'MANUAL' });
        const now = harness.clock.now();
        const end = new Date(now.getTime() + 86_400_000);
        await db()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, future.subscriptionId));
        await db().insert(subscriptionPauses).values({
            subscriptionId: future.subscriptionId,
            reason: 'CUSTOMER_REQUEST',
            startsAt: now,
            expectedEndAt: end,
            requestedMonths: 1
        });
        await db()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, courtesy.subscriptionId));
        await db()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: courtesy.subscriptionId,
                reason: 'COURTESY',
                startsAt: new Date(now.getTime() - 86_400_000),
                expectedEndAt: now,
                requestedMonths: 1
            });
        const result = await endDuePauses({ limit: 100 }, ports(harness));
        expect(result.resumed).toBe(1);
        expect((await row(future.subscriptionId)).subscription?.status).toBe('PAUSED');
        expect((await row(courtesy.subscriptionId)).subscription?.status).toBe('ACTIVE');
    });

    it('does not select a due complement pause', async () => {
        const harness = adjustablePauseHarness();
        const principal = await seedPausePrincipal({ harness });
        const complement = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        const now = harness.clock.now();
        await db()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, complement.complementId));
        await db()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: complement.complementId,
                reason: 'CUSTOMER_REQUEST',
                startsAt: new Date(now.getTime() - 86_400_000),
                expectedEndAt: now
            });
        const result = await endDuePauses({ limit: 100 }, ports(harness, complement.policy));
        expect(result.resumed).toBe(0);
        expect((await row(complement.complementId)).subscription?.status).toBe('PAUSED');
    });
});

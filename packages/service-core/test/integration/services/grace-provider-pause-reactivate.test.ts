import {
    and,
    coverageLosses,
    coveredPeriods,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { billingPeriodEnd } from '../../../src/services/billing/subscription/billing-period-end.js';
import { reactivateSuspendedOnCreditedPayment } from '../../../src/services/billing/subscription/reactivate-suspended.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { providerPauseFixture } from './support/provider-pause-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: { readonly subscriptionId: string; readonly userId: string }[] = [];

/** Retires only this file's seeded rows and closes any marks or retention links. */
afterEach(async () => {
    const db = getServiceTestDb();
    for (const own of seeded.splice(0)) {
        const ownPayments = await db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, own.subscriptionId));
        const paymentIds = ownPayments.map(({ id }) => id);
        if (paymentIds.length > 0)
            await db
                .delete(reconciliationMarkPayments)
                .where(inArray(reconciliationMarkPayments.paymentId, paymentIds));
        await db
            .delete(successionRetainedPayments)
            .where(eq(successionRetainedPayments.subscriptionId, own.subscriptionId));
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: own.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, own.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, own.subscriptionId));
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, own.userId));
        await db.delete(coverageLosses).where(eq(coverageLosses.userId, own.userId));
    }
});

async function ownRow(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('Subscription disappeared');
    return row;
}

async function openMarks(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
}

describe('HOS-1690 — S7 on a row S6 suspended from ACTIVE (AC:B7:13 in-flight edge)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — a charge in flight when S6 suspended from ACTIVE reactivates by S7 without reason 7',
        async () => {
            // Arrange
            const s = await providerPauseFixture({ activeApprovedCycle: true });
            seeded.push({ subscriptionId: s.subscriptionId, userId: s.fixture.user.id });
            await s.pause();
            await s.runPauseCheck();
            const suspended = await ownRow(s.subscriptionId);
            expect(suspended.status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(suspended.graceStartedAt).not.toBeNull();
            expect(suspended.graceEndsAt).not.toBeNull();

            // Act
            s.advanceToAttempt(2);
            const chargeId = s.failedChargeId;
            if (!chargeId) throw new Error('Expected the fixture charge');
            expect(await s.fixture.provider.readCharge({ chargeId })).toMatchObject({
                snapshot: { status: 'approved' }
            });
            const result = await recordChargeFact({ chargeId }, s.ports);

            // Assert
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            if (!payment) throw new Error('Payment fact missing');
            const [covered] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment.id));
            if (!covered) throw new Error('Covered period missing');
            const authorization = await s.provider.readAuthorization({
                authorizationId: s.fixture.started.authorizationId
            });
            const { periodEnd } = billingPeriodEnd({
                periodStart: covered.periodStart,
                everyMonths: authorization.snapshot.cadence.everyMonths
            });
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: {
                    outcome: 'REACTIVATED',
                    subscriptionId: s.subscriptionId,
                    destination: 'CANCEL_SCHEDULED',
                    serviceEndsAt: periodEnd
                }
            });
            const row = await ownRow(s.subscriptionId);
            expect(row.status).toBe('CANCEL_SCHEDULED');
            expect(row.serviceEndsAt).toEqual(periodEnd);
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            expect(await openMarks(s.subscriptionId)).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(reconciliationMarkPayments)
                    .where(eq(reconciliationMarkPayments.paymentId, payment.id))
            ).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — a payment credited before the S6 anchor does not reactivate',
        async () => {
            // Arrange
            const s = await providerPauseFixture({ activeApprovedCycle: true });
            seeded.push({ subscriptionId: s.subscriptionId, userId: s.fixture.user.id });
            await s.pause();
            await s.runPauseCheck();
            const suspended = await ownRow(s.subscriptionId);
            expect(suspended.status).toBe('SUSPENDED');
            expect(suspended.graceStartedAt).not.toBeNull();
            const anchoredAt = suspended.graceStartedAt;
            const [initialPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, s.fixture.initialChargeId));
            if (!initialPayment) throw new Error('Initial payment fact missing');
            expect(initialPayment.status).toBe('SUCCEEDED');

            // Act
            const result = await reactivateSuspendedOnCreditedPayment(
                { paymentId: initialPayment.id },
                { provider: s.provider, clock: s.fixture.clock }
            );

            // Assert
            expect(result).toMatchObject({ outcome: 'CONDITION_FAILED', failedCondition: 4 });
            const row = await ownRow(s.subscriptionId);
            expect(row.status).toBe('SUSPENDED');
            expect(row.graceStartedAt).toEqual(anchoredAt);
            expect(await openMarks(s.subscriptionId)).toHaveLength(0);
        }
    );
});

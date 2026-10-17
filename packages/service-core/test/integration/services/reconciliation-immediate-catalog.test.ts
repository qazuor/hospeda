import {
    and,
    billingDeadlineVersions,
    type DrizzleClient,
    emailOutbox,
    eq,
    inArray,
    payments,
    reconciliationSummaryWindowModel,
    reconciliationSummaryWindows,
    refunds,
    sql,
    userRole,
    users
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { enqueueRevocationRefundFailedNotice } from '../../../src/services/billing/reconciliation/revocation-refund-failed-notice.js';
import { runReconciliationSummaryTick } from '../../../src/services/billing/reconciliation/summary/run-summary-tick.service.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import { seedCoveragePayment, seedCoverageUser } from './support/coverage-fixtures.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';

afterAll(closeServiceTestPool);
const TEMPLATE = 'billing.revocation-refund-failed';

async function seedRecipients(tx: DrizzleClient) {
    const chosen = [await seedCoverageUser(tx), await seedCoverageUser(tx)];
    const unrelated = await seedCoverageUser(tx);
    await tx.insert(userRole).values(
        [...chosen, unrelated].map(({ userId }) => ({
            userId,
            role: 'SUPER_ADMIN' as const
        }))
    );
    const recipients = await Promise.all(
        chosen.map(async ({ userId }) => {
            const [user] = await tx
                .select({ email: users.email })
                .from(users)
                .where(eq(users.id, userId));
            if (!user) throw new Error('test recipient missing');
            return { userId, email: user.email };
        })
    );
    return { recipients, unrelatedId: unrelated.userId };
}

async function seedRefund(tx: DrizzleClient, reason: string) {
    const subject = await seedRenewalSubscription(tx, { nextChargeAt: null });
    await seedCoveragePayment(tx, { subscriptionId: subject.subscriptionId, status: 'SUCCEEDED' });
    const [payment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.subscriptionId, subject.subscriptionId));
    if (!payment) throw new Error('test payment missing');
    const [refund] = await tx
        .insert(refunds)
        .values({
            paymentId: payment.id,
            amount: 250000,
            reason,
            status: 'REQUESTED'
        })
        .returning({ id: refunds.id });
    if (!refund) throw new Error('test refund missing');
    return { refundId: refund.id, paymentId: payment.id, subscriptionId: subject.subscriptionId };
}

async function simulateRf5(
    tx: DrizzleClient,
    refundId: string,
    recipients: readonly { userId: string; email: string }[]
) {
    const [failed] = await tx
        .update(refunds)
        .set({ status: 'FAILED' })
        .where(and(eq(refunds.id, refundId), sql`${refunds.status} IN ('REQUESTED', 'CONFIRMED')`))
        .returning({ id: refunds.id });
    expect(failed).toBeDefined();
    return enqueueRevocationRefundFailedNotice(
        {
            tx,
            refundId,
            failedAt: new Date('2026-10-01T00:00:00.000Z'),
            correlationId: crypto.randomUUID()
        },
        { recipients: { list: async () => recipients } }
    );
}

async function refundRows(tx: DrizzleClient, refundId: string, recipientIds: readonly string[]) {
    return tx
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, TEMPLATE),
                sql`${emailOutbox.payload}->>'refundId' = ${refundId}`,
                inArray(emailOutbox.recipientUserId, [...recipientIds])
            )
        );
}

describe('TEST:B11:22 immediate reconciliation mail catalogue', () => {
    it.each([
        'REVOCATION',
        'ADDON_ORPHAN',
        'ONE_TIME_ADDON_REVOCATION'
    ] as const)('queues the failed refund immediately for %s and deduplicates', async (reason) => {
        await withServiceTestTransaction(async (tx) => {
            const { recipients } = await seedRecipients(tx);
            const { refundId, paymentId } = await seedRefund(tx, reason);
            const beforeWindows = await tx
                .select({ id: reconciliationSummaryWindows.id })
                .from(reconciliationSummaryWindows);
            const result = await simulateRf5(tx, refundId, recipients);
            expect(result).toEqual({ enqueued: 2, skipped: null });
            const rows = await refundRows(
                tx,
                refundId,
                recipients.map(({ userId }) => userId)
            );
            expect(rows).toHaveLength(2);
            expect(rows.map(({ recipientUserId }) => recipientUserId).sort()).toEqual(
                recipients.map(({ userId }) => userId).sort()
            );
            expect(rows.every(({ sendAfter }) => sendAfter === null)).toBe(true);
            expect(rows.every(({ template }) => template === TEMPLATE)).toBe(true);
            expect(rows[0]?.payload).toMatchObject({
                refundId,
                refundReason: reason,
                sourceKind: 'payment',
                sourceId: paymentId,
                amountMinor: 250000,
                currency: 'ARS',
                failedAt: '2026-10-01T00:00:00.000Z'
            });
            expect(rows.some(({ template }) => template === 'billing.reconciliation-summary')).toBe(
                false
            );
            const duplicate = await enqueueRevocationRefundFailedNotice(
                {
                    tx,
                    refundId,
                    failedAt: new Date('2026-10-01T00:00:00.000Z'),
                    correlationId: crypto.randomUUID()
                },
                { recipients: { list: async () => recipients } }
            );
            expect(duplicate).toEqual({ enqueued: 2, skipped: null });
            expect(
                await refundRows(
                    tx,
                    refundId,
                    recipients.map(({ userId }) => userId)
                )
            ).toHaveLength(2);
            const afterWindows = await tx
                .select({ id: reconciliationSummaryWindows.id })
                .from(reconciliationSummaryWindows);
            expect(afterWindows).toHaveLength(beforeWindows.length);
        });
    });

    it('skips a failed MARK_PROPOSAL and a revocation refund that is still REQUESTED', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { recipients } = await seedRecipients(tx);
            const proposal = await seedRefund(tx, 'MARK_PROPOSAL');
            const proposalResult = await simulateRf5(tx, proposal.refundId, recipients);
            expect(proposalResult).toEqual({ enqueued: 0, skipped: 'NOT_REVOCATION' });
            expect(
                await refundRows(
                    tx,
                    proposal.refundId,
                    recipients.map(({ userId }) => userId)
                )
            ).toHaveLength(0);
            const requested = await seedRefund(tx, 'REVOCATION');
            const pendingResult = await enqueueRevocationRefundFailedNotice(
                {
                    tx,
                    refundId: requested.refundId,
                    failedAt: new Date(),
                    correlationId: crypto.randomUUID()
                },
                { recipients: { list: async () => recipients } }
            );
            expect(pendingResult).toEqual({ enqueued: 0, skipped: 'NOT_FAILED' });
            expect(
                await refundRows(
                    tx,
                    requested.refundId,
                    recipients.map(({ userId }) => userId)
                )
            ).toHaveLength(0);
        });
    });

    it('throws for a missing refund and contains enqueue failures in a savepoint', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { recipients } = await seedRecipients(tx);
            await expect(
                enqueueRevocationRefundFailedNotice({
                    tx,
                    refundId: crypto.randomUUID(),
                    failedAt: new Date(),
                    correlationId: crypto.randomUUID()
                })
            ).rejects.toMatchObject({ reason: 'REFUND_NOT_FOUND' });
            const seeded = await seedRefund(tx, 'REVOCATION');
            await tx
                .update(refunds)
                .set({ status: 'FAILED' })
                .where(eq(refunds.id, seeded.refundId));
            const broken = [{ userId: crypto.randomUUID(), email: 'missing@example.test' }];
            const result = await enqueueRevocationRefundFailedNotice(
                {
                    tx,
                    refundId: seeded.refundId,
                    failedAt: new Date(),
                    correlationId: crypto.randomUUID()
                },
                { recipients: { list: async () => broken } }
            );
            expect(result).toEqual({ enqueued: 0, skipped: 'ENQUEUE_FAILED' });
            const [stillFailed] = await tx
                .select({ status: refunds.status })
                .from(refunds)
                .where(eq(refunds.id, seeded.refundId));
            expect(stillFailed?.status).toBe('FAILED');
            expect(recipients).toHaveLength(2);
        });
    });

    it('sends duplicate-charge immediately only for COBRO_DUPLICADO; other marks go in the summary', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { recipients } = await seedRecipients(tx);
            const correlationId = crypto.randomUUID();
            const notice = { recipients: { list: async () => recipients } };
            const duplicateSubject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            const duplicate = await openReconciliationMark(
                {
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: duplicateSubject.subscriptionId
                    },
                    reason: 'COBRO_DUPLICADO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                },
                { notice }
            );
            expect(duplicate.outcome).toBe('OPENED');
            const duplicateRows = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, 'billing.duplicate-charge-detected'),
                        sql`${emailOutbox.payload}->>'markId' = ${duplicate.mark.id}`,
                        inArray(
                            emailOutbox.recipientUserId,
                            recipients.map(({ userId }) => userId)
                        )
                    )
                );
            expect(duplicateRows).toHaveLength(2);
            expect(duplicateRows.every(({ sendAfter }) => sendAfter === null)).toBe(true);

            const ordinarySubject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            const ordinary = await openReconciliationMark(
                {
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: ordinarySubject.subscriptionId
                    },
                    reason: 'DIVERGENCIA_DE_MONTO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                },
                { notice }
            );
            expect(ordinary.outcome).toBe('OPENED');
            const immediateRows = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, 'billing.duplicate-charge-detected'),
                        sql`${emailOutbox.payload}->>'markId' = ${ordinary.mark.id}`,
                        inArray(
                            emailOutbox.recipientUserId,
                            recipients.map(({ userId }) => userId)
                        )
                    )
                );
            expect(immediateRows).toHaveLength(0);

            const [clock] = await tx
                .select({ now: sql<Date>`now()` })
                .from(users)
                .where(eq(users.id, recipients[0]!.userId));
            if (!clock) throw new Error('transaction clock missing');
            const [deadline] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(sql`${billingDeadlineVersions.version} DESC`)
                .limit(1);
            if (!deadline) throw new Error('deadline version missing');
            const transactionNow = new Date(String(clock.now));
            const closesAt = new Date(transactionNow.getTime() - 2_000);
            const previous = await reconciliationSummaryWindowModel.open({
                coversFrom: new Date(closesAt.getTime() - 60 * 60_000),
                openedAt: new Date(closesAt.getTime() - 60 * 60_000),
                closesAt,
                windowMinutes: 60,
                deadlinesVersion: deadline.version,
                tx
            });
            if (!previous) throw new Error('previous window missing');
            await reconciliationSummaryWindowModel.markSent({
                id: previous.id,
                sentAt: closesAt,
                eventCount: 0,
                tx
            });
            const summaryRecipients = { list: async () => recipients };
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(transactionNow.getTime() + 1_000), correlationId },
                    { tx, recipients: summaryRecipients }
                )
            ).toBe('WINDOW_OPENED');
            const openWindow = await reconciliationSummaryWindowModel.findOpen({ tx });
            if (!openWindow) throw new Error('summary window not opened');
            expect(
                await runReconciliationSummaryTick(
                    { now: openWindow.closesAt, correlationId },
                    { tx, recipients: summaryRecipients }
                )
            ).toBe('SENT');
            const summaries = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, 'billing.reconciliation-summary'),
                        inArray(
                            emailOutbox.recipientUserId,
                            recipients.map(({ userId }) => userId)
                        )
                    )
                );
            const markLine = (
                summaries[0]?.payload as { marks?: unknown[] } | undefined
            )?.marks?.find(
                (line) =>
                    (line as { subjectId?: string }).subjectId === ordinarySubject.subscriptionId
            );
            expect(markLine).toMatchObject({
                reason: 'DIVERGENCIA_DE_MONTO',
                subjectId: ordinarySubject.subscriptionId,
                count: 1
            });
        });
    });
});

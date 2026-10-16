import {
    and,
    domainEventModel,
    emailOutbox,
    eq,
    payments,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    sql,
    userRole,
    users
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { enqueueDuplicateChargeNotice } from '../../../src/services/billing/reconciliation/immediate-notice.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import type { ReconciliationMarkPayments } from '../../../src/services/billing/reconciliation/reconciliation-mark-payments.port.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import { seedCoveragePayment, seedCoverageUser } from './support/coverage-fixtures.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';

afterAll(closeServiceTestPool);
const TEMPLATE = 'billing.duplicate-charge-detected';

describe('TEST:B11:16 second clause / TEST:1607:15-16 immediate duplicate charge notice', () => {
    it('queues once per recipient on OPENED, never on ACCUMULATED, and isolates enqueue failures', async () => {
        await withServiceTestTransaction(async (tx) => {
            const subject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            await seedCoveragePayment(tx, {
                subscriptionId: subject.subscriptionId,
                status: 'PENDING'
            });
            const [paymentRow] = await tx
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, subject.subscriptionId));
            if (!paymentRow) throw new Error('test payment missing');
            const recipientIds = [await seedCoverageUser(tx), await seedCoverageUser(tx)];
            const unrelatedSuperAdmin = await seedCoverageUser(tx);
            await tx.insert(userRole).values(
                [...recipientIds, unrelatedSuperAdmin].map(({ userId }) => ({
                    userId,
                    role: 'SUPER_ADMIN' as const
                }))
            );
            const recipients = await Promise.all(
                recipientIds.map(async ({ userId }) => {
                    const [user] = await tx
                        .select({ email: users.email })
                        .from(users)
                        .where(eq(users.id, userId));
                    if (!user) throw new Error('test recipient missing');
                    return { userId, email: user.email };
                })
            );
            const payment = { source: 'PAYMENT' as const, id: paymentRow.id };
            let recipientListCalls = 0;
            const notice = {
                recipients: {
                    list: async () => {
                        recipientListCalls++;
                        return recipients;
                    }
                }
            };
            const markPayments: ReconciliationMarkPayments = {
                hang: async ({ markId, payment: hungPayment, tx: transaction }) => {
                    await transaction.insert(reconciliationMarkPayments).values({
                        markId,
                        paymentId: hungPayment.source === 'PAYMENT' ? hungPayment.id : null,
                        manualPaymentId:
                            hungPayment.source === 'MANUAL_PAYMENT' ? hungPayment.id : null
                    });
                },
                countUnresolved: async () => 0
            };
            const correlationId = crypto.randomUUID();
            const result = await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                    reason: 'COBRO_DUPLICADO',
                    payment,
                    actor: { type: 'job' },
                    correlationId,
                    tx
                },
                { markPayments, notice }
            );
            expect(result.outcome).toBe('OPENED');
            const hung = await tx
                .select()
                .from(reconciliationMarkPayments)
                .where(
                    and(
                        eq(reconciliationMarkPayments.markId, result.mark.id),
                        eq(reconciliationMarkPayments.paymentId, payment.id)
                    )
                );
            expect(hung).toHaveLength(1);
            const rowsForMark = () =>
                tx
                    .select()
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.template, TEMPLATE),
                            sql`${emailOutbox.payload}->>'markId' = ${result.mark.id}`
                        )
                    );
            const rows = await rowsForMark();
            expect(rows).toHaveLength(2);
            expect(rows.map(({ recipientUserId }) => recipientUserId).sort()).toEqual(
                recipients.map(({ userId }) => userId).sort()
            );
            expect(rows.every(({ sendAfter }) => sendAfter === null)).toBe(true);
            expect(rows[0]?.payload).toMatchObject({
                markId: result.mark.id,
                subjectType: 'subscription',
                subjectId: subject.subscriptionId,
                reason: 'COBRO_DUPLICADO',
                openedAt: result.mark.placedAt.toISOString(),
                paymentId: payment.id
            });
            const duplicateEnqueue = await enqueueDuplicateChargeNotice(
                {
                    tx,
                    markId: result.mark.id,
                    subject: { subjectType: 'subscription', subjectId: subject.subscriptionId },
                    openedAt: result.mark.placedAt,
                    paymentId: payment.id,
                    correlationId
                },
                { recipients: { list: async () => recipients } }
            );
            expect(duplicateEnqueue.enqueued).toBe(2);
            expect(await rowsForMark()).toHaveLength(2);
            const accumulated = await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                    reason: 'COBRO_DUPLICADO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                },
                { markPayments, notice }
            );
            expect(accumulated.outcome).toBe('ACCUMULATED');
            expect(await rowsForMark()).toHaveLength(2);
            expect(recipientListCalls).toBe(1);

            const lifted = await reconciliationMarkModel.lift({
                markId: result.mark.id,
                expectedVersion: result.mark.version,
                liftedBy: subject.userId,
                now: new Date('2026-10-14T12:01:00.000Z'),
                tx
            });
            expect(lifted.outcome).toBe('LIFTED');
            const reopened = await openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                reason: 'COBRO_DUPLICADO',
                actor: { type: 'job' },
                correlationId,
                tx
            });
            expect(reopened.outcome).toBe('OPENED');
            expect(reopened.mark.id).not.toBe(result.mark.id);
            const expectedSuperAdminIds = await tx
                .select({ userId: userRole.userId })
                .from(userRole)
                .where(eq(userRole.role, 'SUPER_ADMIN'));
            const reopenedRows = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, TEMPLATE),
                        sql`${emailOutbox.payload}->>'markId' = ${reopened.mark.id}`
                    )
                );
            expect(reopenedRows).toHaveLength(expectedSuperAdminIds.length);
            expect(reopenedRows.map(({ recipientUserId }) => recipientUserId).sort()).toEqual(
                expectedSuperAdminIds.map(({ userId }) => userId).sort()
            );
            expect(reopenedRows.map(({ recipientUserId }) => recipientUserId)).toContain(
                unrelatedSuperAdmin.userId
            );

            const ordinarySubject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            const ordinary = await openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: ordinarySubject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                actor: { type: 'job' },
                correlationId,
                tx
            });
            expect(ordinary.outcome).toBe('OPENED');
            const ordinaryRows = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, TEMPLATE),
                        sql`${emailOutbox.payload}->>'markId' = ${ordinary.mark.id}`
                    )
                );
            expect(ordinaryRows).toHaveLength(0);
            const ordinaryEvents = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: ordinarySubject.subscriptionId,
                tx
            });
            expect(
                ordinaryEvents.some(({ eventType }) => eventType === 'reconciliation.mark_opened')
            ).toBe(true);

            const failingRecipients = [
                {
                    list: async () => {
                        throw new Error('recipient lookup failed');
                    }
                },
                {
                    list: async () => [
                        { userId: crypto.randomUUID(), email: 'missing@example.test' }
                    ]
                }
            ];
            for (const failedRecipientPort of failingRecipients) {
                const failingSubject = await seedRenewalSubscription(tx, { nextChargeAt: null });
                const failed = await openReconciliationMark(
                    {
                        subject: {
                            kind: 'SUBSCRIPTION',
                            subscriptionId: failingSubject.subscriptionId
                        },
                        reason: 'COBRO_DUPLICADO',
                        payment,
                        actor: { type: 'job' },
                        correlationId,
                        tx
                    },
                    { markPayments, notice: { recipients: failedRecipientPort } }
                );
                expect(failed.outcome).toBe('OPENED');
                expect(failed.paymentHung).toBe(true);
                const failedRows = await tx
                    .select()
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.template, TEMPLATE),
                            sql`${emailOutbox.payload}->>'markId' = ${failed.mark.id}`
                        )
                    );
                expect(failedRows).toHaveLength(0);
                const failedPayments = await tx
                    .select()
                    .from(reconciliationMarkPayments)
                    .where(eq(reconciliationMarkPayments.markId, failed.mark.id));
                expect(failedPayments).toHaveLength(1);
                const events = await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: failingSubject.subscriptionId,
                    tx
                });
                expect(
                    events.some(
                        ({ eventType, changes }) =>
                            eventType === 'reconciliation.mark_opened' &&
                            changes.some(
                                ({ field, new: value }) =>
                                    field === 'reconciliation_mark.id' && value === failed.mark.id
                            )
                    )
                ).toBe(true);
            }

            const noRecipientSubject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            const noRecipients = await openReconciliationMark(
                {
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: noRecipientSubject.subscriptionId
                    },
                    reason: 'COBRO_DUPLICADO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                },
                { notice: { recipients: { list: async () => [] } } }
            );
            expect(noRecipients.outcome).toBe('OPENED');
            expect(
                await tx
                    .select()
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.template, TEMPLATE),
                            sql`${emailOutbox.payload}->>'markId' = ${noRecipients.mark.id}`
                        )
                    )
            ).toHaveLength(0);
        });
    });
});

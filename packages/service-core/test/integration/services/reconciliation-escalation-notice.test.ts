import { and, domainEvent, emailOutbox, eq, reconciliationMarkModel, sql, users } from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { enqueueMarkEscalatedNotice } from '../../../src/services/billing/reconciliation/escalation-notice.js';
import { runMarkEscalation } from '../../../src/services/billing/reconciliation/sweep/mark-escalation.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import {
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';

afterAll(closeServiceTestPool);
const TEMPLATE = 'billing.mark-escalated';

describe('TEST:1607:18 immediate escalation notice', () => {
    it('enqueues once per recipient only after the conditional escalation succeeds; retries enqueue failure', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const subject = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const recipients = await Promise.all([seedCoverageUser(tx), seedCoverageUser(tx)]);
            const emails = await Promise.all(
                recipients.map(async ({ userId: id }) => {
                    const [row] = await tx
                        .select({ email: users.email })
                        .from(users)
                        .where(eq(users.id, id));
                    if (!row) throw new Error('test recipient missing');
                    return { userId: id, email: row.email };
                })
            );
            const placedAt = new Date('2001-01-01T00:00:00.000Z');
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            const storedMark = (
                await reconciliationMarkModel.listOpenUnescalatedPage({ limit: 100, tx })
            ).find(({ id }) => id === mark.id);
            if (!storedMark?.deadlineDays) throw new Error('stored deadline 17 missing');
            const listPage =
                reconciliationMarkModel.listOpenUnescalatedPage.bind(reconciliationMarkModel);
            const spy = vi
                .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
                .mockImplementation(async (page) => {
                    const rows = await listPage({ ...page, limit: 10_000 });
                    return rows.filter(({ id }) => id === mark.id);
                });
            try {
                const run = (list: typeof emails) =>
                    runMarkEscalation(
                        { correlationId: crypto.randomUUID(), pageSize: 100 },
                        {
                            clock: { now: () => new Date('2026-10-14T12:00:00.000Z') },
                            tx,
                            notice: { recipients: { list: async () => list } }
                        }
                    );
                const failed = await run([
                    { userId: crypto.randomUUID(), email: 'missing@example.test' }
                ]);
                expect(failed.failures).toHaveLength(1);
                expect(
                    await reconciliationMarkModel.findById({ markId: mark.id, tx })
                ).toMatchObject({ escalatedAt: null });
                expect(
                    await tx
                        .select()
                        .from(emailOutbox)
                        .where(
                            and(
                                eq(emailOutbox.template, TEMPLATE),
                                sql`${emailOutbox.payload}->>'markId' = ${mark.id}`
                            )
                        )
                ).toHaveLength(0);

                const succeeded = await run(emails);
                expect(succeeded.escalated).toBe(1);
                const rows = await tx
                    .select()
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.template, TEMPLATE),
                            sql`${emailOutbox.payload}->>'markId' = ${mark.id}`
                        )
                    );
                expect(rows).toHaveLength(2);
                expect(rows.every(({ sendAfter }) => sendAfter === null)).toBe(true);
                expect(rows[0]?.payload).toMatchObject({
                    markId: mark.id,
                    subjectType: 'subscription',
                    subjectId: subject.subscriptionId,
                    reason: 'DIVERGENCIA_DE_MONTO',
                    placedAt: placedAt.toISOString(),
                    escalatedAt: '2026-10-14T12:00:00.000Z',
                    escalationDays: storedMark.deadlineDays
                });
                const secondPass = await run(emails);
                expect(secondPass.escalated).toBe(0);
                expect(
                    await tx
                        .select()
                        .from(emailOutbox)
                        .where(
                            and(
                                eq(emailOutbox.template, TEMPLATE),
                                sql`${emailOutbox.payload}->>'markId' = ${mark.id}`
                            )
                        )
                ).toHaveLength(2);
                await enqueueMarkEscalatedNotice(
                    {
                        tx,
                        markId: mark.id,
                        subject: {
                            subjectType: 'subscription',
                            subjectId: subject.subscriptionId
                        },
                        reason: mark.reason,
                        placedAt,
                        escalatedAt: new Date('2026-10-14T12:00:01.000Z'),
                        escalationDays: storedMark.deadlineDays,
                        correlationId: crypto.randomUUID()
                    },
                    { recipients: { list: async () => emails } }
                );
                expect(
                    await tx
                        .select()
                        .from(emailOutbox)
                        .where(
                            and(
                                eq(emailOutbox.template, TEMPLATE),
                                sql`${emailOutbox.payload}->>'markId' = ${mark.id}`
                            )
                        )
                ).toHaveLength(2);
            } finally {
                spy.mockRestore();
            }
        });
    });

    it('scales without mail for no recipients and does not mail when the conditional update loses', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const firstSubject = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const secondOwner = await seedCoverageUser(tx);
            const secondSubject = await seedCoverageSubscription(tx, {
                userId: secondOwner.userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const placedAt = new Date('2001-01-01T00:00:00.000Z');
            const noRecipientsMark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: firstSubject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            const racedMark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: secondSubject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            const markIds = [noRecipientsMark.id, racedMark.id];
            const listPage =
                reconciliationMarkModel.listOpenUnescalatedPage.bind(reconciliationMarkModel);
            const listSpy = vi
                .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
                .mockImplementation(async (page) => {
                    const rows = await listPage({ ...page, limit: 10_000 });
                    return rows.filter(({ id }) => markIds.includes(id));
                });
            const markEscalated =
                reconciliationMarkModel.markEscalated.bind(reconciliationMarkModel);
            const updateSpy = vi
                .spyOn(reconciliationMarkModel, 'markEscalated')
                .mockImplementation(async (input) =>
                    input.markId === racedMark.id ? false : markEscalated(input)
                );
            try {
                const result = await runMarkEscalation(
                    { correlationId: crypto.randomUUID(), pageSize: 100 },
                    {
                        clock: { now: () => new Date('2026-10-14T12:00:00.000Z') },
                        tx,
                        notice: { recipients: { list: async () => [] } }
                    }
                );
                expect(result.escalated).toBe(1);
                expect(result.alreadyHandled).toBe(1);
                expect(result.failures).toHaveLength(0);
                expect(
                    await reconciliationMarkModel.findById({ markId: noRecipientsMark.id, tx })
                ).toMatchObject({ escalatedAt: new Date('2026-10-14T12:00:00.000Z') });
                expect(
                    await reconciliationMarkModel.findById({ markId: racedMark.id, tx })
                ).toMatchObject({ escalatedAt: null });
                for (const markId of markIds) {
                    expect(
                        await tx
                            .select()
                            .from(emailOutbox)
                            .where(
                                and(
                                    eq(emailOutbox.template, TEMPLATE),
                                    sql`${emailOutbox.payload}->>'markId' = ${markId}`
                                )
                            )
                    ).toHaveLength(0);
                }
            } finally {
                updateSpy.mockRestore();
                listSpy.mockRestore();
            }
        });
    });

    it('rolls back escalation when recipient lookup fails before SQL and retries on the next pass', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const subject = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const placedAt = new Date('2001-01-01T00:00:00.000Z');
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            const listPage =
                reconciliationMarkModel.listOpenUnescalatedPage.bind(reconciliationMarkModel);
            const spy = vi
                .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
                .mockImplementation(async (page) => {
                    const rows = await listPage({ ...page, limit: 10_000 });
                    return rows.filter(({ id }) => id === mark.id);
                });
            const run = (list: () => Promise<{ userId: string; email: string }[]>) =>
                runMarkEscalation(
                    { correlationId: crypto.randomUUID(), pageSize: 100 },
                    {
                        clock: { now: () => new Date('2026-10-14T12:00:00.000Z') },
                        tx,
                        notice: { recipients: { list } }
                    }
                );
            try {
                const failed = await run(async () => {
                    throw new Error('recipient lookup failed before enqueue SQL');
                });
                expect(failed.failures).toHaveLength(1);
                expect(
                    await reconciliationMarkModel.findById({ markId: mark.id, tx })
                ).toMatchObject({ escalatedAt: null });
                const events = await tx
                    .select()
                    .from(domainEvent)
                    .where(
                        and(
                            eq(domainEvent.eventType, 'reconciliation.mark_escalated'),
                            sql`${domainEvent.changes}->0->>'new' = ${mark.id}`
                        )
                    );
                expect(events).toHaveLength(0);
                expect(
                    await tx
                        .select()
                        .from(emailOutbox)
                        .where(
                            and(
                                eq(emailOutbox.template, TEMPLATE),
                                sql`${emailOutbox.payload}->>'markId' = ${mark.id}`
                            )
                        )
                ).toHaveLength(0);

                const recipient = await seedCoverageUser(tx);
                const succeeded = await run(async () => [
                    { userId: recipient.userId, email: `${recipient.userId}@example.test` }
                ]);
                expect(succeeded.escalated).toBe(1);
                expect(
                    await reconciliationMarkModel.findById({ markId: mark.id, tx })
                ).toMatchObject({ escalatedAt: new Date('2026-10-14T12:00:00.000Z') });
            } finally {
                spy.mockRestore();
            }
        });
    });
});

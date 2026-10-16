import {
    billingDeadlineVersions,
    buildEmailDedupKey,
    buildEventOccurrence,
    type DrizzleClient,
    desc,
    domainEventModel,
    emailOutbox,
    emailOutboxModel,
    inArray,
    reconciliationMarkModel,
    reconciliationSummaryWindowModel,
    sql,
    subscriptionPauses
} from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { runReconciliationSummaryTick } from '../../../src/services/billing/reconciliation/summary/run-summary-tick.service.js';
import { createPersistedReconciliationDailySummary } from '../../../src/services/billing/reconciliation/sweep/comparisons/persisted-daily-summary.js';
import { runMarkEscalation } from '../../../src/services/billing/reconciliation/sweep/mark-escalation.js';
import { runPauseGiftDetection } from '../../../src/services/billing/reconciliation/sweep/pause-gift-check.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import { seedCoverageUser } from './support/coverage-fixtures.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';

afterAll(closeServiceTestPool);

async function mailsFor(tx: DrizzleClient, userIds: readonly string[]) {
    return tx
        .select()
        .from(emailOutbox)
        .where(inArray(emailOutbox.recipientUserId, [...userIds]));
}

async function seedClosedWindowBefore(
    tx: DrizzleClient,
    boundary: Date,
    leadMilliseconds = 2_000
): Promise<void> {
    const [deadline] = await tx
        .select()
        .from(billingDeadlineVersions)
        .orderBy(desc(billingDeadlineVersions.version))
        .limit(1);
    if (!deadline) throw new Error('Current deadline version missing');
    const closesAt = new Date(boundary.getTime() - leadMilliseconds);
    const previous = await reconciliationSummaryWindowModel.open({
        coversFrom: new Date(closesAt.getTime() - 60 * 60_000),
        openedAt: new Date(closesAt.getTime() - 60 * 60_000),
        closesAt,
        windowMinutes: 60,
        deadlinesVersion: deadline.version,
        tx
    });
    if (!previous) throw new Error('Expected to open preceding summary window');
    await reconciliationSummaryWindowModel.markSent({
        id: previous.id,
        sentAt: closesAt,
        eventCount: 0,
        tx
    });
}

describe('TEST:B11:16 / TEST:B11:17 reconciliation summary tick', () => {
    it('TEST:B11:16(a): records 100 critical events and sends one summary per recipient at N', async () => {
        await withServiceTestTransaction(async (tx) => {
            const seeded = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T00:00:00Z')
            });
            const recipient1 = await seedCoverageUser(tx);
            const recipient2 = await seedCoverageUser(tx);
            const subjectId = seeded.subscriptionId;
            const correlationId = crypto.randomUUID();
            for (let index = 0; index < 100; index++) {
                await openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subjectId },
                    reason: 'COBRO_DUPLICADO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                });
            }
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: subjectId,
                tx
            });
            const markOpened = events.filter(
                (event) => event.eventType === 'reconciliation.mark_opened'
            );
            expect(markOpened).toHaveLength(100);
            expect(
                await reconciliationMarkModel.listOpen({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subjectId },
                    tx
                })
            ).toHaveLength(1);
            const recipients = [recipient1.userId, recipient2.userId].map((id, index) => ({
                userId: id,
                email: `summary-${index}-${id}@example.test`
            }));
            const port = { list: async () => recipients };
            const transactionTime = await tx.execute(sql`select transaction_timestamp() as now`);
            const base = new Date(String(transactionTime.rows[0]?.now));
            await seedClosedWindowBefore(tx, base, 1);
            const correlation = crypto.randomUUID();
            expect(
                await runReconciliationSummaryTick(
                    { now: base, correlationId: correlation },
                    { tx, recipients: port }
                )
            ).toBe('WINDOW_OPENED');
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(base.getTime() + 30 * 60_000), correlationId: correlation },
                    { tx, recipients: port }
                )
            ).toBe('WAITING');
            expect(
                await mailsFor(
                    tx,
                    recipients.map((recipient) => recipient.userId)
                )
            ).toHaveLength(0);
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(base.getTime() + 60 * 60_000), correlationId: correlation },
                    { tx, recipients: port }
                )
            ).toBe('SENT');
            const mails = await mailsFor(
                tx,
                recipients.map((recipient) => recipient.userId)
            );
            expect(mails).toHaveLength(2);
            expect(mails.map((mail) => mail.template)).toEqual([
                'billing.reconciliation-summary',
                'billing.reconciliation-summary'
            ]);
            expect(mails.map((mail) => mail.recipientUserId).sort()).toEqual(
                recipients.map((recipient) => recipient.userId).sort()
            );
            expect(mails[0]?.payload).toMatchObject({
                totals: { events: 100 },
                marks: [
                    {
                        reason: 'COBRO_DUPLICADO',
                        subjectType: 'subscription',
                        subjectId,
                        count: 100
                    }
                ]
            });
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(base.getTime() + 61 * 60_000), correlationId: correlation },
                    { tx, recipients: port }
                )
            ).toBe('IDLE');
            expect(
                await mailsFor(
                    tx,
                    recipients.map((recipient) => recipient.userId)
                )
            ).toHaveLength(2);
        });
    });

    it('TEST:B11:16(c): stores the deadline version and minutes captured when each window opens', async () => {
        await withServiceTestTransaction(async (tx) => {
            const now = new Date(Date.now() + 2_000);
            const correlationId = crypto.randomUUID();
            const recipient = await seedCoverageUser(tx);
            const recipients = {
                list: async () => [
                    { userId: recipient.userId, email: `deadline-${recipient.userId}@example.test` }
                ]
            };
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId,
                occurredAt: new Date(now.getTime() - 1_000),
                changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                tx
            });
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current deadline version missing');
            expect(
                await runReconciliationSummaryTick({ now, correlationId }, { tx, recipients })
            ).toBe('WINDOW_OPENED');
            const first = await reconciliationSummaryWindowModel.findOpen({ tx });
            expect(first).toMatchObject({ windowMinutes: 60, deadlinesVersion: current.version });
            const nextValues = { ...current.values, '19': { minutes: 15 } };
            await tx.insert(billingDeadlineVersions).values({
                version: current.version + 1,
                values: nextValues,
                changedKey: 19,
                previousValue: current.values['19'],
                newValue: nextValues['19']
            });
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toMatchObject({
                id: first?.id,
                windowMinutes: 60,
                deadlinesVersion: current.version
            });
            const afterClose = new Date(now.getTime() + 60 * 60_000 + 1);
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId,
                occurredAt: afterClose,
                changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                tx
            });
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(now.getTime() + 60 * 60_000), correlationId },
                    { tx, recipients }
                )
            ).toBe('SENT');
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(afterClose.getTime() + 1), correlationId },
                    { tx, recipients }
                )
            ).toBe('WINDOW_OPENED');
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toMatchObject({
                windowMinutes: 15,
                deadlinesVersion: current.version + 1,
                coversFrom: first?.closesAt
            });
        });
    });

    it('TEST:B11:16(b): excludes a post-close event from the prior window and starts the next at that boundary', async () => {
        await withServiceTestTransaction(async (tx) => {
            const base = new Date(Date.now() + 2_000);
            const closesAt = new Date(base.getTime() + 60 * 60_000);
            await seedClosedWindowBefore(tx, base);
            const correlationId = crypto.randomUUID();
            const recipient = await seedCoverageUser(tx);
            const port = {
                list: async () => [
                    { userId: recipient.userId, email: `range-${recipient.userId}@example.test` }
                ]
            };
            const addEvent = (entityId: string, occurredAt: Date) =>
                domainEventModel.insert({
                    eventType: 'reconciliation.mark_opened',
                    entityType: 'subscription',
                    entityId,
                    actorType: 'job',
                    correlationId,
                    occurredAt,
                    changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                    tx
                });
            await addEvent('before-boundary', new Date(base.getTime() - 1_000));
            expect(
                await runReconciliationSummaryTick(
                    { now: base, correlationId },
                    { tx, recipients: port }
                )
            ).toBe('WINDOW_OPENED');
            await addEvent('at-boundary', closesAt);
            await addEvent('after-boundary', new Date(closesAt.getTime() + 1));
            expect(
                await runReconciliationSummaryTick(
                    { now: closesAt, correlationId },
                    { tx, recipients: port }
                )
            ).toBe('SENT');
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(closesAt.getTime() + 2), correlationId },
                    { tx, recipients: port }
                )
            ).toBe('WINDOW_OPENED');
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toMatchObject({
                coversFrom: closesAt
            });
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(closesAt.getTime() + 60 * 60_000 + 2), correlationId },
                    { tx, recipients: port }
                )
            ).toBe('SENT');
            const mails = await mailsFor(tx, [recipient.userId]);
            expect(mails).toHaveLength(2);
            expect(
                mails
                    .map((mail) => (mail.payload as { totals: { events: number } }).totals.events)
                    .sort()
            ).toEqual([1, 2]);
        });
    });

    it('TEST:B11:16(d): retains a window without recipients and sends after one appears', async () => {
        await withServiceTestTransaction(async (tx) => {
            const base = new Date(Date.now() + 2_000);
            const correlationId = crypto.randomUUID();
            const recipient = await seedCoverageUser(tx);
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId,
                occurredAt: new Date(base.getTime() - 1_000),
                changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                tx
            });
            const none = { list: async () => [] };
            const one = {
                list: async () => [
                    { userId: recipient.userId, email: `retry-${recipient.userId}@example.test` }
                ]
            };
            expect(
                await runReconciliationSummaryTick(
                    { now: base, correlationId },
                    { tx, recipients: none }
                )
            ).toBe('WINDOW_OPENED');
            const open = await reconciliationSummaryWindowModel.findOpen({ tx });
            if (!open) throw new Error('Expected an open summary window');
            expect(
                await runReconciliationSummaryTick(
                    { now: open.closesAt, correlationId },
                    { tx, recipients: none }
                )
            ).toBe('NO_RECIPIENTS');
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toMatchObject({
                id: open.id,
                sentAt: null
            });
            expect(await mailsFor(tx, [recipient.userId])).toHaveLength(0);
            expect(
                await runReconciliationSummaryTick(
                    { now: open.closesAt, correlationId },
                    { tx, recipients: one }
                )
            ).toBe('SENT');
            expect(await mailsFor(tx, [recipient.userId])).toHaveLength(1);
        });
    });

    it('TEST:B11:17(g): composes escalations and undercharges from their real event writers', async () => {
        await withServiceTestTransaction(async (tx) => {
            const subject = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const correlationId = crypto.randomUUID();
            const now = new Date('2026-12-03T12:00:00Z');
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt: new Date('2026-11-01T12:00:00Z'),
                tx
            });
            const listPage =
                reconciliationMarkModel.listOpenUnescalatedPage.bind(reconciliationMarkModel);
            const spy = vi
                .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
                .mockImplementation(async (pageInput) =>
                    (await listPage({ ...pageInput, limit: 10_000 })).filter(
                        (row) => row.id === mark.id
                    )
                );
            try {
                expect(
                    (
                        await runMarkEscalation(
                            { correlationId, pageSize: 100 },
                            { clock: { now: () => now }, tx }
                        )
                    ).escalated
                ).toBe(1);
            } finally {
                spy.mockRestore();
            }
            const summary = createPersistedReconciliationDailySummary({
                correlationId,
                clock: { now: () => now },
                tx
            });
            await summary.addUndercharge({
                subscriptionId: subject.subscriptionId,
                paymentId: crypto.randomUUID(),
                chargeId: 'provider-charge-test',
                expectedMinor: 1500,
                chargedMinor: 1000,
                differenceMinor: 500,
                currency: 'ARS'
            });
            const recipient = await seedCoverageUser(tx);
            const recipients = {
                list: async () => [
                    { userId: recipient.userId, email: `writers-${recipient.userId}@example.test` }
                ]
            };
            const start = new Date(now.getTime() + 1);
            expect(
                await runReconciliationSummaryTick(
                    { now: start, correlationId },
                    { tx, recipients }
                )
            ).toBe('WINDOW_OPENED');
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(start.getTime() + 60 * 60_000), correlationId },
                    { tx, recipients }
                )
            ).toBe('SENT');
            const payload = (await mailsFor(tx, [recipient.userId]))[0]?.payload as {
                escalations: { markId: string }[];
                underCharges: {
                    subscriptionId: string;
                    expectedMinor: number;
                    chargedMinor: number;
                }[];
            };
            expect(payload.escalations).toEqual([
                {
                    reason: 'DIVERGENCIA_DE_MONTO',
                    subjectType: 'subscription',
                    subjectId: subject.subscriptionId,
                    markId: mark.id
                }
            ]);
            expect(payload.underCharges).toEqual([
                {
                    subscriptionId: subject.subscriptionId,
                    paymentId: expect.any(String),
                    currency: 'ARS',
                    expectedMinor: 1500,
                    chargedMinor: 1000,
                    differenceMinor: 500
                }
            ]);
        });
    });

    it('TEST:B11:17(f): composes real pause gift events and omits an anniversary return', async () => {
        await withServiceTestTransaction(async (tx) => {
            const first = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const anniversary = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const [giftPause] = await tx
                .insert(subscriptionPauses)
                .values({
                    subscriptionId: first.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: new Date('2026-10-31T12:00:00Z'),
                    actualEndAt: new Date('2026-12-02T12:00:00Z')
                })
                .returning();
            const [anniversaryPause] = await tx
                .insert(subscriptionPauses)
                .values({
                    subscriptionId: anniversary.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: new Date('2026-10-31T12:00:00Z'),
                    actualEndAt: new Date('2026-12-01T12:00:00Z')
                })
                .returning();
            if (!giftPause || !anniversaryPause) throw new Error('Pause fixtures failed');
            const now = new Date('2026-12-03T12:00:00Z');
            const correlationId = crypto.randomUUID();
            const detected = await runPauseGiftDetection(
                { correlationId, pageSize: 100 },
                { clock: { now: () => now }, tx }
            );
            expect(detected.detected).toBe(1);
            const recipient = await seedCoverageUser(tx);
            const recipients = {
                list: async () => [
                    { userId: recipient.userId, email: `gift-${recipient.userId}@example.test` }
                ]
            };
            expect(
                await runReconciliationSummaryTick({ now, correlationId }, { tx, recipients })
            ).toBe('WINDOW_OPENED');
            const sentAt = new Date(now.getTime() + 60 * 60_000);
            expect(
                await runReconciliationSummaryTick(
                    { now: sentAt, correlationId },
                    { tx, recipients }
                )
            ).toBe('SENT');
            const mail = (await mailsFor(tx, [recipient.userId]))[0];
            expect(mail?.payload).toMatchObject({
                pauseGifts: [
                    {
                        subscriptionId: first.subscriptionId,
                        pauseId: giftPause.id,
                        pauseStartedAt: '2026-10-31T12:00:00.000Z',
                        pauseEndedAt: '2026-12-02T12:00:00.000Z',
                        skippedChargeAt: '2026-11-01T12:00:00.000Z',
                        nextChargeAfterReturnAt: '2027-01-01T12:00:00.000Z',
                        giftDays: 29
                    }
                ]
            });
            expect((mail?.payload as { pauseGifts: unknown[] }).pauseGifts).toHaveLength(1);
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'subscription_pause',
                        entityId: anniversaryPause.id,
                        tx
                    })
                ).some((event) => event.eventType === 'reconciliation.pause_gift_detected')
            ).toBe(false);
        });
    });

    it('TEST:B11:16(h): caps 250 distinct mark subjects at 200 with 50 omitted', async () => {
        await withServiceTestTransaction(async (tx) => {
            const base = new Date('2099-01-01T00:00:00.000Z');
            await seedClosedWindowBefore(tx, base);
            const correlationId = crypto.randomUUID();
            for (let index = 0; index < 250; index++) {
                await domainEventModel.insert({
                    eventType: 'reconciliation.mark_opened',
                    entityType: 'subscription',
                    entityId: `subject-${String(index).padStart(3, '0')}`,
                    actorType: 'job',
                    correlationId,
                    occurredAt: new Date(base.getTime() - 1_000),
                    changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                    tx
                });
            }
            const recipient = await seedCoverageUser(tx);
            const recipients = {
                list: async () => [
                    { userId: recipient.userId, email: `cap-${recipient.userId}@example.test` }
                ]
            };
            expect(
                await runReconciliationSummaryTick({ now: base, correlationId }, { tx, recipients })
            ).toBe('WINDOW_OPENED');
            expect(
                await runReconciliationSummaryTick(
                    { now: new Date(base.getTime() + 60 * 60_000), correlationId },
                    { tx, recipients }
                )
            ).toBe('SENT');
            const payload = (await mailsFor(tx, [recipient.userId]))[0]?.payload as {
                marks: unknown[];
                omitted: { marks: number };
                totals: { events: number };
            };
            expect(payload.marks).toHaveLength(200);
            expect(payload.omitted.marks).toBe(50);
            expect(payload.totals.events).toBe(250);
        });
    });

    it('TEST:B11:16(i): fails closed without deadline 19 and leaves no window', async () => {
        await withServiceTestTransaction(async (tx) => {
            const now = new Date(Date.now() + 2_000);
            const correlationId = crypto.randomUUID();
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId,
                occurredAt: new Date(now.getTime() - 1_000),
                changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                tx
            });
            await expect(
                runReconciliationSummaryTick(
                    { now, correlationId },
                    { tx, deadlines: { getCurrent: async () => ({ version: 1, values: {} }) } }
                )
            ).rejects.toMatchObject({ reason: 'BILLING_DEADLINE_19_MISSING' });
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toBeNull();
        });
    });

    it('TEST:B11:16(e): uses the window dedup key and closes after another tick already enqueued', async () => {
        await withServiceTestTransaction(async (tx) => {
            const recipient = await seedCoverageUser(tx);
            const now = new Date(Date.now() + 2_000);
            const open = await reconciliationSummaryWindowModel.open({
                coversFrom: new Date(now.getTime() - 1_000),
                openedAt: new Date(now.getTime() - 60 * 60_000),
                closesAt: now,
                windowMinutes: 60,
                deadlinesVersion: 1,
                tx
            });
            if (!open) throw new Error('Expected to open summary window');
            const correlationId = crypto.randomUUID();
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId,
                occurredAt: new Date(now.getTime() - 500),
                changes: [{ field: 'reconciliation_mark.reason', new: 'COBRO_DUPLICADO' }],
                tx
            });
            const email = `dedup-${recipient.userId}@example.test`;
            const template = 'billing.reconciliation-summary';
            await emailOutboxModel.enqueue(
                {
                    recipientUserId: recipient.userId,
                    recipientEmail: email,
                    template,
                    payload: {},
                    dedupKey: buildEmailDedupKey({
                        recipient: recipient.userId,
                        template,
                        occurrence: buildEventOccurrence({ eventId: open.id })
                    }),
                    correlationId
                },
                tx
            );
            const port = { list: async () => [{ userId: recipient.userId, email }] };
            expect(
                await runReconciliationSummaryTick({ now, correlationId }, { tx, recipients: port })
            ).toBe('SENT');
            expect(await mailsFor(tx, [recipient.userId])).toHaveLength(1);
            expect(await reconciliationSummaryWindowModel.findOpen({ tx })).toBeNull();
        });
    });
});

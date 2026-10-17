import {
    billingDeadlineVersions,
    type DrizzleClient,
    desc,
    domainEventModel,
    emailOutbox,
    inArray,
    reconciliationMarkModel,
    reconciliationSummaryWindowModel
} from '@repo/db';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { runReconciliationSummaryTick } from '../../../src/services/billing/reconciliation/summary/run-summary-tick.service.js';
import type { ReconciliationSummaryPayload } from '../../../src/services/billing/reconciliation/summary/summary-types.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import { seedCoverageUser } from './support/coverage-fixtures.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';
import { publishDeadline, seedClosedWindowBefore } from './support/summary-window-fixtures.js';

afterAll(closeServiceTestPool);
const tick = (
    tx: DrizzleClient,
    now: Date,
    correlationId: string,
    recipients: { list(): Promise<{ userId: string; email: string }[]> },
    deadlines?: { getCurrent(): Promise<{ version: number; values: unknown }> }
) =>
    runReconciliationSummaryTick(
        { now, correlationId },
        { tx, recipients, ...(deadlines ? { deadlines } : {}) }
    );

describe('TEST:B11:21 summary window deadline source', () => {
    it('(a)(b)(c)(d): captures current deadline 19 at open and aggregates S14 events', async () => {
        await withServiceTestTransaction(async (tx) => {
            const timeResult = await tx.execute(sql`select now() as now`);
            const txNow = new Date((timeResult.rows[0] as { now: Date }).now);
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current deadline version missing');
            await seedClosedWindowBefore(tx, txNow, 1_000);
            const [u1, u2] = await Promise.all([seedCoverageUser(tx), seedCoverageUser(tx)]);
            const seeded = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T00:00:00Z')
            });
            const recipients = {
                list: async () => [
                    { userId: u1.userId, email: `${u1.userId}@example.test` },
                    { userId: u2.userId, email: `${u2.userId}@example.test` }
                ]
            };
            const correlationId = crypto.randomUUID();
            await publishDeadline(tx, current.version + 1, 7, current.values);
            for (let i = 0; i < 100; i++)
                await openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscriptionId },
                    reason: 'DIVERGENCIA_DE_MONTO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                });
            const recorded = await domainEventModel.findByCorrelationId({ correlationId, tx });
            expect(
                recorded.filter((e) => e.eventType === 'reconciliation.mark_opened')
            ).toHaveLength(100);
            expect(
                await reconciliationMarkModel.listOpen({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscriptionId },
                    tx
                })
            ).toHaveLength(1);
            const openedAt = new Date(txNow.getTime() + 1_000);
            expect(await tick(tx, openedAt, correlationId, recipients)).toBe('WINDOW_OPENED');
            let open = await reconciliationSummaryWindowModel.findOpen({ tx });
            expect(open).toMatchObject({ windowMinutes: 7, deadlinesVersion: current.version + 1 });
            expect(
                await tick(tx, new Date(open!.closesAt.getTime() - 1), correlationId, recipients)
            ).toBe('WAITING');
            expect(
                await tx
                    .select()
                    .from(emailOutbox)
                    .where(inArray(emailOutbox.recipientUserId, [u1.userId, u2.userId]))
            ).toHaveLength(0);
            expect(await tick(tx, open!.closesAt, correlationId, recipients)).toBe('SENT');
            const mails = await tx
                .select()
                .from(emailOutbox)
                .where(inArray(emailOutbox.recipientUserId, [u1.userId, u2.userId]));
            expect(mails).toHaveLength(2);
            for (const mail of mails) {
                const marks = mail.payload.marks;
                expect(Array.isArray(marks)).toBe(true);
                if (!Array.isArray(marks)) throw new Error('Summary payload marks are missing');
                expect(
                    marks.find(
                        (
                            mark
                        ): mark is Pick<
                            ReconciliationSummaryPayload['marks'][number],
                            'subjectId' | 'count'
                        > =>
                            typeof mark === 'object' &&
                            mark !== null &&
                            'subjectId' in mark &&
                            typeof mark.subjectId === 'string' &&
                            'count' in mark &&
                            typeof mark.count === 'number'
                    )
                ).toMatchObject({ count: 100 });
            }
            expect(
                await tick(tx, new Date(open!.closesAt.getTime() + 1), correlationId, recipients)
            ).toBe('IDLE');
            const firstClose = open!.closesAt;
            await publishDeadline(tx, current.version + 2, 11, {
                ...current.values,
                '19': { minutes: 7 }
            });
            // The transaction timestamp already falls inside the preceding range; seed this later event at the next boundary.
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                occurredAt: new Date(firstClose.getTime() + 1_000),
                tx
            });
            expect(
                await tick(tx, new Date(firstClose.getTime() + 2_000), correlationId, recipients)
            ).toBe('WINDOW_OPENED');
            open = await reconciliationSummaryWindowModel.findOpen({ tx });
            expect(open).toMatchObject({
                windowMinutes: 11,
                deadlinesVersion: current.version + 2,
                coversFrom: firstClose
            });
        });
    });
    it('(c)(d): deadline version is captured and port value controls duration', async () => {
        await withServiceTestTransaction(async (tx) => {
            const timeResult = await tx.execute(sql`select now() as now`);
            const txNow = new Date((timeResult.rows[0] as { now: Date }).now);
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current deadline version missing');
            await seedClosedWindowBefore(tx, txNow, 1_000);
            const user = await seedCoverageUser(tx);
            const recipients = {
                list: async () => [{ userId: user.userId, email: `${user.userId}@example.test` }]
            };
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                occurredAt: txNow,
                tx
            });
            const cid = crypto.randomUUID();
            const openedAt = new Date(txNow.getTime() + 1_000);
            await publishDeadline(tx, current.version + 1, 7, current.values);
            expect(await tick(tx, openedAt, cid, recipients)).toBe('WINDOW_OPENED');
            const open = await reconciliationSummaryWindowModel.findOpen({ tx });
            await publishDeadline(tx, current.version + 2, 11, {
                ...current.values,
                '19': { minutes: 7 }
            });
            expect(
                await tick(tx, new Date(open!.openedAt.getTime() + 7 * 60_000), cid, recipients)
            ).toBe('SENT');
        });
        await withServiceTestTransaction(async (tx) => {
            const timeResult = await tx.execute(sql`select now() as now`);
            const txNow = new Date((timeResult.rows[0] as { now: Date }).now);
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current deadline version missing');
            await seedClosedWindowBefore(tx, txNow, 1_000);
            const user = await seedCoverageUser(tx);
            const recipients = {
                list: async () => [{ userId: user.userId, email: `${user.userId}@example.test` }]
            };
            await domainEventModel.insert({
                eventType: 'reconciliation.mark_opened',
                entityType: 'subscription',
                entityId: crypto.randomUUID(),
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                occurredAt: txNow,
                tx
            });
            const cid = crypto.randomUUID();
            const openedAt = new Date(txNow.getTime() + 1_000);
            expect(
                await tick(tx, openedAt, cid, recipients, {
                    getCurrent: async () => ({
                        version: current.version,
                        values: { '19': { minutes: 13 } }
                    })
                })
            ).toBe('WINDOW_OPENED');
            const open = await reconciliationSummaryWindowModel.findOpen({ tx });
            expect(open!.closesAt.getTime() - open!.openedAt.getTime()).toBe(13 * 60_000);
            expect(await tick(tx, open!.closesAt, cid, recipients)).toBe('SENT');
        });
    });
});

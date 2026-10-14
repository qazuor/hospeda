import { eq, subscriptions } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { sendRenewalNotices } from '../../../src/services/billing/subscription/send-renewal-notices.service';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers';
import {
    currentVersion,
    ensureBillingDeadlineVersion1,
    readOutboxRows,
    renewalNow,
    seedRenewalSubscription
} from './support/renewal-notice-fixtures';

afterAll(closeServiceTestPool);

function renewalCharge(day: string): Date {
    return new Date(`${day}T15:00:00.000Z`);
}

/**
 * TEST runs pass their rollback transaction as db and use 2001 instants. The orchestrator reads
 * the global population, and its 400-day window excludes committed 2026 rows from other suites.
 */
describe('HOS-1622 TEST:B13a:13 AC:B13a:13 the renewal notice at 5 and 1 days, with the stored deadline version', () => {
    it('(a) seals the cycle before its first milestone without enqueuing early', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const charge = renewalCharge('2001-07-01');
            const seeded = await seedRenewalSubscription(tx, { nextChargeAt: charge });
            const run = await sendRenewalNotices(
                { limit: 50, db: tx },
                {
                    clock: { now: () => renewalNow('2001-06-21') },
                    readCurrentDeadlines: async () => currentVersion()
                }
            );
            expect(
                run.rows.find((row) => row.subscriptionId === seeded.subscriptionId)?.outcome
            ).toBe('STAMPED_NOT_DUE');
            const [clock] = await tx
                .select({
                    version: subscriptions.renewalNoticeDeadlineVersion,
                    chargeAt: subscriptions.renewalNoticeChargeAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(clock).toEqual({ version: 1, chargeAt: charge });
            expect(await readOutboxRows(tx, seeded.subscriptionId)).toHaveLength(0);
        });
    });

    it('(b-d) enqueues once at 5 and 1 days, then stops on and after the charge date', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const charge = renewalCharge('2001-07-01');
            const seeded = await seedRenewalSubscription(tx, { nextChargeAt: charge });
            let today = renewalNow('2001-06-26');
            const run = () =>
                sendRenewalNotices(
                    { limit: 50, db: tx },
                    {
                        clock: { now: () => today },
                        readCurrentDeadlines: async () => currentVersion()
                    }
                );
            expect((await run()).enqueued).toBe(1);
            expect((await run()).alreadyEnqueued).toBe(1);
            let notices = await readOutboxRows(tx, seeded.subscriptionId);
            expect(notices).toHaveLength(1);
            const fiveDayNotice = notices.find((row) =>
                row.dedupKey.includes(`sub:${seeded.subscriptionId}:renov:-5d:2001-07-01`)
            );
            expect(fiveDayNotice).toMatchObject({
                recipientUserId: seeded.userId,
                recipientEmail: seeded.email,
                sendAfter: null
            });
            expect(fiveDayNotice?.payload).toEqual({
                subscriptionId: seeded.subscriptionId,
                vertical: 'accommodation',
                planName: 'Coverage plan',
                renewalDate: '2001-07-01',
                daysBefore: 5,
                deadlinesVersion: 1
            });
            today = renewalNow('2001-06-30');
            expect((await run()).enqueued).toBe(1);
            notices = await readOutboxRows(tx, seeded.subscriptionId);
            expect(notices).toHaveLength(2);
            expect(notices.map((row) => row.dedupKey).sort()).toEqual([
                expect.stringContaining(`sub:${seeded.subscriptionId}:renov:-1d:2001-07-01`),
                expect.stringContaining(`sub:${seeded.subscriptionId}:renov:-5d:2001-07-01`)
            ]);
            today = renewalNow('2001-07-01');
            expect((await run()).enqueued).toBe(0);
            today = renewalNow('2001-07-02');
            expect((await run()).enqueued).toBe(0);
            expect(await readOutboxRows(tx, seeded.subscriptionId)).toHaveLength(2);
        });
    });

    it('(e) keeps the sealed version after a newer current version is published', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const charge = renewalCharge('2001-07-01');
            const seeded = await seedRenewalSubscription(tx, {
                nextChargeAt: charge,
                stamp: { version: 1, chargeAt: charge }
            });
            const changed = {
                '10': { cardHours: 72, manualDays: 7 },
                '11': { noticeDays: 60, contactDays: [30, 7] },
                '12': { noticeDays: 60, contactDays: [30, 7] },
                '13': { daysBefore: [7, 2] },
                '14': { daysBefore: 7 },
                '15': { hoursRemaining: 24 },
                '16': { days: 7 },
                '17': { days: 7 },
                '18': { days: 180 },
                '19': { minutes: 60 }
            };
            let today = renewalNow('2001-06-24');
            const run = () =>
                sendRenewalNotices(
                    { limit: 50, db: tx },
                    {
                        clock: { now: () => today },
                        readCurrentDeadlines: async () => currentVersion(changed, 999)
                    }
                );
            await run();
            today = renewalNow('2001-06-29');
            await run();
            const rows = await readOutboxRows(tx, seeded.subscriptionId);
            expect(
                rows.some(
                    (row) =>
                        row.dedupKey.includes('renov:-7d:') || row.dedupKey.includes('renov:-2d:')
                )
            ).toBe(false);
            expect(rows.some((row) => row.dedupKey.includes('renov:-5d:'))).toBe(true);
            expect(rows.find((row) => row.dedupKey.includes('renov:-5d:'))?.payload).toMatchObject({
                daysBefore: 5,
                deadlinesVersion: 1
            });
            const [clock] = await tx
                .select({ version: subscriptions.renewalNoticeDeadlineVersion })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(clock?.version).toBe(1);
        });
    });

    it('(f) re-seals a moved charge date and deduplicates by the new target date', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const oldCharge = renewalCharge('2001-07-01');
            const seeded = await seedRenewalSubscription(tx, {
                nextChargeAt: oldCharge,
                stamp: { version: 1, chargeAt: oldCharge }
            });
            let today = renewalNow('2001-06-26');
            const run = () =>
                sendRenewalNotices(
                    { limit: 50, db: tx },
                    {
                        clock: { now: () => today },
                        readCurrentDeadlines: async () => currentVersion()
                    }
                );
            await run();
            const newCharge = renewalCharge('2001-07-04');
            await tx
                .update(subscriptions)
                .set({ nextChargeAt: newCharge })
                .where(eq(subscriptions.id, seeded.subscriptionId));
            await run();
            const [clock] = await tx
                .select({ chargeAt: subscriptions.renewalNoticeChargeAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(clock?.chargeAt).toEqual(newCharge);
            today = renewalNow('2001-06-29');
            await run();
            const rows = await readOutboxRows(tx, seeded.subscriptionId);
            expect(rows).toHaveLength(2);
            expect(rows.some((row) => row.dedupKey.includes('renov:-5d:2001-07-01'))).toBe(true);
            expect(rows.some((row) => row.dedupKey.includes('renov:-5d:2001-07-04'))).toBe(true);
        });
    });

    it('(g) recovers the 5-day milestone at 3 days and sends 1 day only once', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const charge = renewalCharge('2001-07-01');
            const seeded = await seedRenewalSubscription(tx, {
                nextChargeAt: charge,
                stamp: { version: 1, chargeAt: charge }
            });
            let today = renewalNow('2001-06-28');
            const run = () =>
                sendRenewalNotices(
                    { limit: 50, db: tx },
                    {
                        clock: { now: () => today },
                        readCurrentDeadlines: async () => currentVersion()
                    }
                );
            expect((await run()).enqueued).toBe(1);
            let rows = await readOutboxRows(tx, seeded.subscriptionId);
            expect(rows.some((row) => row.dedupKey.includes('renov:-5d:'))).toBe(true);
            today = renewalNow('2001-06-30');
            expect((await run()).enqueued).toBe(1);
            rows = await readOutboxRows(tx, seeded.subscriptionId);
            expect(rows).toHaveLength(2);
            expect(rows.some((row) => row.dedupKey.includes('renov:-1d:'))).toBe(true);
            expect(rows.filter((row) => row.dedupKey.includes('renov:-5d:'))).toHaveLength(1);
        });
    });

    it('(h) leaves every ineligible row unstamped and without an outbox row', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const charge = renewalCharge('2001-07-01');
            const cases = [
                { status: 'CANCEL_SCHEDULED' },
                { status: 'GRACE_PERIOD' },
                { status: 'SUSPENDED' },
                { status: 'PAUSED' },
                { status: 'PENDING_AUTHORIZATION' },
                { status: 'ACTIVE', paymentMethod: 'MANUAL' as const },
                { status: 'ACTIVE', class: 'COMPLEMENTO' as const },
                { status: 'ACTIVE', nextChargeAt: null }
            ];
            const seeded = [];
            for (const item of cases) {
                seeded.push(
                    await seedRenewalSubscription(tx, {
                        nextChargeAt: 'nextChargeAt' in item ? (item.nextChargeAt ?? null) : charge,
                        status: item.status,
                        class: item.class,
                        paymentMethod: item.paymentMethod
                    })
                );
            }
            await sendRenewalNotices(
                { limit: 50, db: tx },
                {
                    clock: { now: () => renewalNow('2001-06-26') },
                    readCurrentDeadlines: async () => currentVersion()
                }
            );
            for (const { subscriptionId } of seeded) {
                const [clock] = await tx
                    .select({ version: subscriptions.renewalNoticeDeadlineVersion })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscriptionId));
                expect(clock?.version).toBeNull();
                expect(await readOutboxRows(tx, subscriptionId)).toHaveLength(0);
            }
        });
    });

    it('(i) counts a malformed current key as a failed row and continues with a sealed row', async () => {
        await withServiceTestTransaction(async (tx) => {
            await ensureBillingDeadlineVersion1(tx);
            const charge = renewalCharge('2001-07-01');
            const invalid = await seedRenewalSubscription(tx, { nextChargeAt: charge });
            const valid = await seedRenewalSubscription(tx, {
                nextChargeAt: charge,
                stamp: { version: 1, chargeAt: charge }
            });
            const missingKey = {
                '10': { cardHours: 72, manualDays: 7 },
                '11': { noticeDays: 60, contactDays: [30, 7] },
                '12': { noticeDays: 60, contactDays: [30, 7] },
                '14': { daysBefore: 7 },
                '15': { hoursRemaining: 24 },
                '16': { days: 7 },
                '17': { days: 7 },
                '18': { days: 180 },
                '19': { minutes: 60 }
            };
            const run = await sendRenewalNotices(
                { limit: 50, db: tx },
                {
                    clock: { now: () => renewalNow('2001-06-26') },
                    readCurrentDeadlines: async () => currentVersion(missingKey)
                }
            );
            expect(run.failed).toBe(1);
            expect(run.enqueued).toBe(1);
            expect(
                run.rows.find((row) => row.subscriptionId === invalid.subscriptionId)?.outcome
            ).toBe('FAILED');
            expect(
                run.rows.find((row) => row.subscriptionId === valid.subscriptionId)?.outcome
            ).toBe('ENQUEUED');
            const [clock] = await tx
                .select({ version: subscriptions.renewalNoticeDeadlineVersion })
                .from(subscriptions)
                .where(eq(subscriptions.id, invalid.subscriptionId));
            expect(clock?.version).toBeNull();
            expect(await readOutboxRows(tx, invalid.subscriptionId)).toHaveLength(0);
            expect(await readOutboxRows(tx, valid.subscriptionId)).toHaveLength(1);
        });
    });
});

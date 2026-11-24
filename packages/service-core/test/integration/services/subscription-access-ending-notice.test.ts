import { and, asc, type DrizzleClient, emailOutbox, eq, sql, subscriptions } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import {
    ACCESS_ENDING_NOTICE_TEMPLATE,
    sendAccessEndingNotices
} from '../../../src/services/billing/subscription/access-ending-notice';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers';
import {
    currentVersion,
    renewalNow,
    seedRenewalSubscription
} from './support/renewal-notice-fixtures';

afterAll(closeServiceTestPool);

/** The service end of the fixtures: 15:00 UTC is noon in the market, on the same local day. */
function serviceEnd(day: string): Date {
    return new Date(`${day}T15:00:00.000Z`);
}

async function seedWithEnd(
    tx: DrizzleClient,
    input: { readonly status: string; readonly serviceEndsAt: Date; readonly nextChargeAt?: Date }
) {
    const seeded = await seedRenewalSubscription(tx, {
        status: input.status,
        nextChargeAt: input.nextChargeAt ?? null
    });
    await tx
        .update(subscriptions)
        .set({ serviceEndsAt: input.serviceEndsAt })
        .where(eq(subscriptions.id, seeded.subscriptionId));
    return seeded;
}

async function noticesOf(tx: DrizzleClient, subscriptionId: string) {
    return tx
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, ACCESS_ENDING_NOTICE_TEMPLATE),
                sql`${emailOutbox.payload}->>'subscriptionId' = ${subscriptionId}`
            )
        )
        .orderBy(asc(emailOutbox.dedupKey));
}

/** Seeds a PRINCIPAL successor of the given row, for the same holder and plan (S1/S17). */
async function seedSuccessor(
    tx: DrizzleClient,
    input: { readonly predecessorId: string; readonly status: string }
) {
    const [predecessor] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.predecessorId));
    if (!predecessor) throw new Error('predecessor not found');
    await tx.insert(subscriptions).values({
        userId: predecessor.userId,
        vertical: predecessor.vertical,
        planVersionId: predecessor.planVersionId,
        billingOptionId: predecessor.billingOptionId,
        paymentMethod: predecessor.paymentMethod,
        status: input.status,
        class: 'PRINCIPAL',
        succeedsId: input.predecessorId,
        createdAt: renewalNow('2001-06-20'),
        updatedAt: renewalNow('2001-06-20')
    });
}

function run(tx: DrizzleClient, day: string) {
    return sendAccessEndingNotices(
        { limit: 50, db: tx },
        {
            clock: { now: () => renewalNow(day) },
            readDeadlineValues: async () => currentVersion().values
        }
    );
}

/** 2001 instants keep the run's window clear of rows committed by other suites. */
describe('HOS-2580 §C the access-ending reminder of a scheduled cancellation', () => {
    it('enqueues once at the larger PLAZO:13 offset (5 days) and never again', async () => {
        await withServiceTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedWithEnd(tx, {
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: serviceEnd('2001-07-01')
            });

            // Act
            const early = await run(tx, '2001-06-25');
            const due = await run(tx, '2001-06-26');
            const again = await run(tx, '2001-06-30');

            // Assert
            expect(early.rows.some((row) => row.subscriptionId === seeded.subscriptionId)).toBe(
                false
            );
            expect(due.rows.find((row) => row.subscriptionId === seeded.subscriptionId)).toEqual({
                subscriptionId: seeded.subscriptionId,
                outcome: 'ENQUEUED'
            });
            expect(
                again.rows.find((row) => row.subscriptionId === seeded.subscriptionId)?.outcome
            ).toBe('ALREADY_ENQUEUED');
            const notices = await noticesOf(tx, seeded.subscriptionId);
            expect(notices).toHaveLength(1);
            expect(notices[0]).toMatchObject({
                recipientUserId: seeded.userId,
                recipientEmail: seeded.email
            });
            expect(notices[0]?.payload).toMatchObject({
                subscriptionId: seeded.subscriptionId,
                vertical: 'accommodation',
                serviceEndsAt: serviceEnd('2001-07-01').toISOString(),
                daysRemaining: 5
            });
            expect(typeof (notices[0]?.payload as { planName?: unknown }).planName).toBe('string');
        });
    });

    it('a run that starts inside the window sends it with the days actually left', async () => {
        await withServiceTestTransaction(async (tx) => {
            const seeded = await seedWithEnd(tx, {
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: serviceEnd('2001-07-01')
            });
            await run(tx, '2001-06-29');
            const [notice] = await noticesOf(tx, seeded.subscriptionId);
            expect(notice?.payload).toMatchObject({ daysRemaining: 2 });
        });
    });

    it('skips an active renewing row, an ended row and the end day itself', async () => {
        await withServiceTestTransaction(async (tx) => {
            // Arrange
            const active = await seedWithEnd(tx, {
                status: 'ACTIVE',
                serviceEndsAt: serviceEnd('2001-07-01'),
                nextChargeAt: serviceEnd('2001-07-01')
            });
            const ended = await seedWithEnd(tx, {
                status: 'CANCELLED',
                serviceEndsAt: serviceEnd('2001-07-01')
            });
            const endsToday = await seedWithEnd(tx, {
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: serviceEnd('2001-06-28')
            });

            // Act
            const result = await run(tx, '2001-06-28');

            // Assert
            const handled = result.rows.map((row) => row.subscriptionId);
            expect(handled).not.toContain(active.subscriptionId);
            expect(handled).not.toContain(ended.subscriptionId);
            expect(
                result.rows.find((row) => row.subscriptionId === endsToday.subscriptionId)?.outcome
            ).toBe('NOT_DUE');
            for (const { subscriptionId } of [active, ended, endsToday])
                expect(await noticesOf(tx, subscriptionId)).toHaveLength(0);
        });
    });

    it.each([
        ['pending authorization', 'PENDING_AUTHORIZATION'],
        ['active, predecessor not cancelled yet (S17 deferred)', 'ACTIVE']
    ])('skips a predecessor whose successor is %s', async (_label, status) => {
        await withServiceTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedWithEnd(tx, {
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: serviceEnd('2001-07-01')
            });
            await seedSuccessor(tx, { predecessorId: seeded.subscriptionId, status });

            // Act
            const result = await run(tx, '2001-06-26');

            // Assert: the holder signed up again, so their access is not ending.
            expect(result.rows.some((row) => row.subscriptionId === seeded.subscriptionId)).toBe(
                false
            );
            expect(await noticesOf(tx, seeded.subscriptionId)).toHaveLength(0);
        });
    });

    it('still notifies a predecessor whose successor ended without going live', async () => {
        await withServiceTestTransaction(async (tx) => {
            // Arrange: an abandoned successor is terminal, so the old access does end.
            const seeded = await seedWithEnd(tx, {
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: serviceEnd('2001-07-01')
            });
            await seedSuccessor(tx, { predecessorId: seeded.subscriptionId, status: 'ABANDONED' });

            // Act
            await run(tx, '2001-06-26');

            // Assert
            expect(await noticesOf(tx, seeded.subscriptionId)).toHaveLength(1);
        });
    });
});

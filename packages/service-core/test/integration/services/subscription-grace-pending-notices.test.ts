import { emailOutbox, eq, inArray, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { applyGraceReminder } from '../../../src/services/billing/subscription/grace-reminder-notice.js';
import { enqueueGraceStartedNotice } from '../../../src/services/billing/subscription/grace-started-notice.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    pausedNow,
    retirePausedCancellationRows,
    seedPausedCancellation
} from './support/cancel-paused-fixtures.js';
import {
    configureGraceReminderSubscription,
    insertGraceReminderDeadline
} from './support/grace-reminder-fixtures.js';

const clock = { now: () => pausedNow };
const successors: string[] = [];
const deadlineVersion = 81704099;
const instant = (day: string) => new Date(`${day}T15:00:00.000Z`);

afterEach(async () => {
    if (successors.length)
        await getServiceTestDb()
            .delete(subscriptions)
            .where(inArray(subscriptions.id, successors.splice(0)));
    await retirePausedCancellationRows();
});
afterAll(closeServiceTestPool);

async function fixture(pending: boolean) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const seeded = await seedPausedCancellation({ fake });
    await configureGraceReminderSubscription({
        subscriptionId: seeded.subscriptionId,
        startedAt: instant('2099-03-01'),
        endsAt: instant('2099-03-20')
    });
    if (pending) {
        const [parent] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        if (!parent) throw new Error('Seeded parent missing');
        const [successor] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: seeded.userId,
                vertical: parent.vertical,
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                paymentMethod: parent.paymentMethod,
                planVersionId: parent.planVersionId,
                billingOptionId: parent.billingOptionId,
                succeedsId: parent.id
            })
            .returning({ id: subscriptions.id });
        if (!successor) throw new Error('Successor insert failed');
        successors.push(successor.id);
    }
    return seeded;
}

async function mail(subscriptionId: string, template: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.template, template));
    return rows.find(
        (row) => (row.payload as { subscriptionId?: string }).subscriptionId === subscriptionId
    );
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:25 grace notice pending succession payload',
    () => {
        it.each([
            false,
            true
        ])('grace started sets optional pending=%s only for a live successor', async (pending) => {
            const seeded = await fixture(pending);
            const [subscription] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            if (!subscription) throw new Error('Seeded subscription missing');
            await getServiceTestDb().transaction((tx) =>
                enqueueGraceStartedNotice({
                    tx,
                    subscription,
                    chargeId: crypto.randomUUID(),
                    graceEndsAt: instant('2099-03-20')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-started');
            expect(notice?.payload).toEqual({
                subscriptionId: seeded.subscriptionId,
                vertical: 'accommodation',
                graceEndsAt: instant('2099-03-20').toISOString(),
                ...(pending ? { planChangePending: true } : {})
            });
        });

        it.each([
            false,
            true
        ])('grace reminder sets optional pending=%s only for a live successor', async (pending) => {
            const seeded = await fixture(pending);
            await insertGraceReminderDeadline({
                version: deadlineVersion,
                createdAt: instant('2099-02-01'),
                daysBefore: [3]
            });
            const result = await getServiceTestDb().transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: seeded.subscriptionId,
                    now: instant('2099-03-17')
                })
            );
            expect(result.outcome).toBe('ENQUEUED');
            const notice = await mail(seeded.subscriptionId, 'billing.grace-reminder');
            expect(notice?.payload).toMatchObject({
                subscriptionId: seeded.subscriptionId,
                daysBefore: 3,
                ...(pending ? { planChangePending: true } : {})
            });
            expect(Object.hasOwn(notice?.payload ?? {}, 'planChangePending')).toBe(pending);
        });
    }
);

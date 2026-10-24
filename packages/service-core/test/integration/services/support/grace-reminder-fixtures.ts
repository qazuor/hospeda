import { billingDeadlineVersions, emailOutbox, eq, subscriptions, users } from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import { getServiceTestDb } from '../helpers.js';

const values: BillingDeadlineValues = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
};

export async function insertGraceReminderDeadline(input: {
    readonly version: number;
    readonly createdAt: Date;
    readonly daysBefore?: readonly number[];
}): Promise<void> {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({
            version: input.version,
            createdAt: input.createdAt,
            values: input.daysBefore
                ? { ...values, '20': { daysBefore: [...input.daysBefore] } }
                : values,
            changedKey: null
        })
        .onConflictDoNothing();
}

export async function configureGraceReminderSubscription(input: {
    readonly subscriptionId: string;
    readonly startedAt: Date;
    readonly endsAt: Date;
    readonly status?: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED';
}): Promise<void> {
    await getServiceTestDb()
        .update(subscriptions)
        .set({
            status: input.status ?? 'GRACE_PERIOD',
            graceStartedAt: input.startedAt,
            graceEndsAt: input.endsAt
        })
        .where(eq(subscriptions.id, input.subscriptionId));
}

export async function readGraceReminderOutbox(subscriptionId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.template, 'billing.grace-reminder'));
    return rows.filter(
        (row) =>
            row.payload &&
            typeof row.payload === 'object' &&
            'subscriptionId' in row.payload &&
            row.payload.subscriptionId === subscriptionId
    );
}

export async function clearGraceReminderEmail(subscriptionId: string): Promise<void> {
    const [subscription] = await getServiceTestDb()
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!subscription?.userId) throw new Error('Grace reminder test user missing');
    await getServiceTestDb()
        .update(users)
        .set({ email: '' })
        .where(eq(users.id, subscription.userId));
}

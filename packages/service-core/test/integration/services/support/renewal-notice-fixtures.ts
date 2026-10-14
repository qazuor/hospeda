import {
    and,
    asc,
    billingDeadlineVersions,
    type DrizzleClient,
    emailOutbox,
    eq,
    sql,
    subscriptions,
    users
} from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import type { CurrentRenewalDeadlines } from '../../../../src/services/billing/subscription/renewal-notice';
import { seedCoveragePlanVersion, seedCoverageUser } from './coverage-fixtures';

const defaultValues: BillingDeadlineValues = {
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

/** An instant at noon UTC on a 2001 date, isolated from the shared integration population. */
export function renewalNow(day: string): Date {
    return new Date(`${day}T12:00:00.000Z`);
}

/** Inserts one subscription with its related user and plan in the caller's rollback transaction. */
export async function seedRenewalSubscription(
    tx: DrizzleClient,
    input: {
        readonly status?: string;
        readonly class?: 'PRINCIPAL' | 'COMPLEMENTO';
        readonly paymentMethod?: 'CARD' | 'MANUAL';
        readonly nextChargeAt: Date | null;
        readonly stamp?: { readonly version: number; readonly chargeAt: Date };
    }
): Promise<{ readonly subscriptionId: string; readonly userId: string; readonly email: string }> {
    const { userId } = await seedCoverageUser(tx);
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(tx, 'accommodation');
    const [subscription] = await tx
        .insert(subscriptions)
        .values({
            userId,
            vertical: 'accommodation',
            planVersionId,
            billingOptionId,
            paymentMethod: input.paymentMethod ?? 'CARD',
            status: input.status ?? 'ACTIVE',
            class: input.class ?? 'PRINCIPAL',
            nextChargeAt: input.nextChargeAt,
            renewalNoticeDeadlineVersion: input.stamp?.version,
            renewalNoticeChargeAt: input.stamp?.chargeAt,
            createdAt: renewalNow('2001-05-01'),
            updatedAt: renewalNow('2001-05-01')
        })
        .returning({ id: subscriptions.id });
    if (!subscription || !user) throw new Error('renewal notice fixture insert failed');
    return { subscriptionId: subscription.id, userId, email: user.email };
}

/** Ensures the immutable shared version 1 exists without changing an existing snapshot. */
export async function ensureBillingDeadlineVersion1(db: DrizzleClient): Promise<void> {
    await db
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: defaultValues })
        .onConflictDoNothing();
}

/** Reads only this subscription's renewal notice rows, in stable dedup-key order. */
export async function readOutboxRows(tx: DrizzleClient, subscriptionId: string) {
    return tx
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, 'billing.renewal-upcoming'),
                sql`${emailOutbox.payload}->>'subscriptionId' = ${subscriptionId}`
            )
        )
        .orderBy(asc(emailOutbox.dedupKey));
}

/** Builds the injected current-deadline port, optionally carrying deliberately malformed values. */
export function currentVersion(
    values: unknown = defaultValues,
    version = 1
): CurrentRenewalDeadlines {
    return { version, values };
}

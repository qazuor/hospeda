import type { DrizzleClient, SelectSubscription } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';

const logger = createLogger('paid-after-cancellation-notice');

/** Template identifier for the notice sent after payment on an already cancelled preapproval. */
export const PAID_AFTER_CANCELLATION_TEMPLATE = 'billing.paid-after-cancellation';

const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>((value) => typeof value === 'object' && value !== null),
    subscription: z
        .object({
            id: z.string().uuid(),
            userId: z.string().uuid().nullable(),
            vertical: z.string().nullable()
        })
        .passthrough(),
    serviceEndsAt: z.date(),
    recurringAddonsCut: z.boolean()
});

/**
 * Enqueues the once-per-subscription notice when a credited payment arrives after cancellation.
 * The recipient is read through the caller's transaction so the notice commits with the row
 * transition. Missing users or email addresses are logged and skipped.
 *
 * @param input - Transaction, subscription, persisted service end, and recurring-addon outcome
 * @returns Resolves after enqueueing the notice or skipping an unavailable recipient
 */
export async function enqueuePaidAfterCancellationNotice(input: {
    readonly tx: DrizzleClient;
    readonly subscription: SelectSubscription;
    readonly serviceEndsAt: Date;
    readonly recurringAddonsCut: boolean;
}): Promise<void> {
    const { tx, subscription, serviceEndsAt, recurringAddonsCut } = inputSchema.parse(input);
    const { buildEmailDedupKey, buildEventOccurrence, emailOutboxModel, eq, users } = await import(
        '@repo/db'
    );
    const userId = subscription.userId;
    const [userRow] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId ?? ''))
        .limit(1);
    if (!userId || !userRow?.email) {
        logger.error(
            { subscriptionId: subscription.id },
            'No user email for paid-after-cancellation notice'
        );
        return;
    }
    const template = PAID_AFTER_CANCELLATION_TEMPLATE;
    await emailOutboxModel.enqueue(
        {
            recipientUserId: userId,
            recipientEmail: userRow.email,
            template,
            payload: {
                subscriptionId: subscription.id,
                vertical: subscription.vertical,
                serviceEndsAt: serviceEndsAt.toISOString(),
                recurringAddonsCut
            },
            dedupKey: buildEmailDedupKey({
                recipient: userId,
                template,
                occurrence: buildEventOccurrence({ eventId: subscription.id })
            })
        },
        tx
    );
}

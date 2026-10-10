import type { DrizzleClient, SelectSubscription } from '@repo/db';
import { buildEmailDedupKey, buildEventOccurrence, emailOutboxModel, eq, users } from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('signup-incomplete-notice');

/** Template identifier for the "signup that remained incomplete" notice. */
export const SIGNUP_INCOMPLETE_TEMPLATE = 'billing.signup-incomplete';

/** Input for enqueuing the signup-incomplete notice. */
export interface EnqueueSignupIncompleteInput {
    /** Drizzle transaction so the row commits with the domain write. */
    readonly tx: DrizzleClient;
    /** The abandoned subscription row. */
    readonly subscription: SelectSubscription;
    /** Sum of deferred courtesy months that were closed, or `null`. */
    readonly closedCourtesyMonths: number | null;
}

/**
 * Enqueues the "el alta que quedó sin completarse" notice.
 *
 * Reads the recipient from `users`, computes a dedup key scoped to the
 * subscription, and enqueues via the outbox model.  When no user row exists
 * it leaves a warning and does NOT enqueue.
 */
export async function enqueueSignupIncompleteNotice(
    input: EnqueueSignupIncompleteInput
): Promise<void> {
    const { tx, subscription, closedCourtesyMonths } = input;

    const [userRow] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, subscription.userId ?? ''))
        .limit(1);

    if (!userRow?.email) {
        logger.warn(
            { subscriptionId: subscription.id },
            'No user found for abandoned subscription'
        );
        return;
    }

    const template = SIGNUP_INCOMPLETE_TEMPLATE;
    const recipient = subscription.userId ?? '';
    const dedupKey = buildEmailDedupKey({
        recipient,
        template,
        occurrence: buildEventOccurrence({ eventId: subscription.id })
    });

    const windowEndsAt = subscription.authorizationWindowEndsAt
        ? subscription.authorizationWindowEndsAt.toISOString()
        : null;

    await emailOutboxModel.enqueue(
        {
            recipientUserId: subscription.userId,
            recipientEmail: userRow.email,
            template,
            payload: {
                subscriptionId: subscription.id,
                vertical: subscription.vertical,
                paymentMethod: subscription.paymentMethod,
                windowEndsAt,
                closedCourtesyMonths
            },
            dedupKey
        },
        tx
    );
}

import type { DrizzleClient, SelectSubscription } from '@repo/db';
import { buildEmailDedupKey, buildEventOccurrence, emailOutboxModel, eq, users } from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('signup-declined-notice');

/** Template identifier for the declined-signup notice. */
export const SIGNUP_DECLINED_TEMPLATE = 'billing.signup-declined';

export interface EnqueueSignupDeclinedInput {
    readonly tx: DrizzleClient;
    readonly subscription: SelectSubscription;
    readonly declineReason: string | null;
    readonly successionPredecessor: boolean;
}

/**
 * Enqueues S16's declined-signup facts once per subscription, including whether
 * it was a succession predecessor; the renderer maps the raw provider detail.
 */
export async function enqueueSignupDeclinedNotice(
    input: EnqueueSignupDeclinedInput
): Promise<void> {
    const { tx, subscription, declineReason, successionPredecessor } = input;
    const [userRow] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, subscription.userId ?? ''))
        .limit(1);

    if (!userRow?.email) {
        logger.warn({ subscriptionId: subscription.id }, 'No user found for declined subscription');
        return;
    }

    const template = SIGNUP_DECLINED_TEMPLATE;
    const recipient = subscription.userId ?? '';
    const dedupKey = buildEmailDedupKey({
        recipient,
        template,
        occurrence: buildEventOccurrence({ eventId: subscription.id })
    });
    await emailOutboxModel.enqueue(
        {
            recipientUserId: subscription.userId,
            recipientEmail: userRow.email,
            template,
            payload: {
                subscriptionId: subscription.id,
                vertical: subscription.vertical,
                declineReason,
                successionPredecessor
            },
            dedupKey
        },
        tx
    );
}

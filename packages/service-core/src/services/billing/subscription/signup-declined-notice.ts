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
}

/** Enqueues once per subscription; absent recipients are logged and not enqueued. */
export async function enqueueSignupDeclinedNotice(
    input: EnqueueSignupDeclinedInput
): Promise<void> {
    const { tx, subscription, declineReason } = input;
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
                declineReason
            },
            dedupKey
        },
        tx
    );
}

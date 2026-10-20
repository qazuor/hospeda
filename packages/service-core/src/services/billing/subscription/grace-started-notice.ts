import type { DrizzleClient, SelectSubscription } from '@repo/db';
import { buildEmailDedupKey, buildEventOccurrence, emailOutboxModel, eq, users } from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('grace-started-notice');

/** Template identifier for the notice that starts a subscription grace period. */
export const GRACE_STARTED_TEMPLATE = 'billing.grace-started';

/** Input needed to enqueue the once-per-rejected-charge grace notice. */
export interface EnqueueGraceStartedNoticeInput {
    readonly tx: DrizzleClient;
    readonly subscription: SelectSubscription;
    readonly chargeId: string;
    readonly graceEndsAt: Date;
}

/** Enqueues the grace-start notice once per rejected charge when its user has an email. */
export async function enqueueGraceStartedNotice(
    input: EnqueueGraceStartedNoticeInput
): Promise<void> {
    const { tx, subscription, chargeId, graceEndsAt } = input;
    const userId = subscription.userId;
    const [userRow] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId ?? ''))
        .limit(1);

    if (!userId || !userRow?.email) {
        logger.warn({ subscriptionId: subscription.id }, 'No user email for grace-start notice');
        return;
    }

    const template = GRACE_STARTED_TEMPLATE;
    const dedupKey = buildEmailDedupKey({
        recipient: userId,
        template,
        occurrence: buildEventOccurrence({ eventId: chargeId })
    });
    await emailOutboxModel.enqueue(
        {
            recipientUserId: userId,
            recipientEmail: userRow.email,
            template,
            payload: {
                subscriptionId: subscription.id,
                vertical: subscription.vertical,
                graceEndsAt: graceEndsAt.toISOString()
            },
            dedupKey
        },
        tx
    );
}

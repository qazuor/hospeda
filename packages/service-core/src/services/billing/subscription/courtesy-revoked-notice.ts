import {
    buildEmailDedupKey,
    buildEventOccurrence,
    type DrizzleClient,
    emailOutboxModel,
    eq,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { getLocalDateString } from '@repo/utils';

const logger = createLogger('courtesy-revoked-notice');
const template = 'billing.courtesy-revoked';

/** Enqueues the S10 courtesy revocation notice in the same transaction as the resume. */
export async function enqueueCourtesyRevokedNotice(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly userId: string;
    readonly vertical: string;
    readonly pauseId: string;
    readonly nextChargeAt: Date | null;
}): Promise<boolean> {
    if (!input.nextChargeAt) {
        logger.error(
            { subscriptionId: input.subscriptionId },
            'Next charge date missing for courtesy revocation'
        );
        return false;
    }
    const [recipient] = await input.tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
    if (!recipient?.email) {
        logger.error(
            { subscriptionId: input.subscriptionId },
            'Recipient missing for courtesy revocation'
        );
        return false;
    }
    await emailOutboxModel.enqueue(
        {
            recipientUserId: input.userId,
            recipientEmail: recipient.email,
            template,
            payload: {
                subscriptionId: input.subscriptionId,
                vertical: input.vertical,
                nextChargeOn: getLocalDateString({
                    instant: input.nextChargeAt,
                    timeZone: 'Etc/GMT+4'
                })
            },
            dedupKey: buildEmailDedupKey({
                recipient: input.userId,
                template,
                occurrence: buildEventOccurrence({ eventId: input.pauseId })
            })
        },
        input.tx
    );
    return true;
}

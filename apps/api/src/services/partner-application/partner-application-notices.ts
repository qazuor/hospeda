import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    partnerApplicationModel
} from '@repo/db';

/** Outbox template for the claim notice sent after approval. */
export const PARTNER_CLAIM_NOTICE_TEMPLATE = 'verticals.partner-claim-notice';

/** Outbox template for the rejection communication. */
export const PARTNER_APPLICATION_REJECTED_TEMPLATE = 'verticals.partner-application-rejected';

/** Enqueues a claim notice to the email address inside the approval transaction. */
export async function enqueuePartnerClaimNotice(input: {
    readonly tx: DrizzleClient;
    readonly email: string;
    readonly partnerId: string;
    readonly partnerName: string;
    readonly correlationId: string;
}): Promise<void> {
    const locale = await partnerApplicationModel.readAccountLocaleByEmail({
        tx: input.tx,
        email: input.email
    });
    const template = PARTNER_CLAIM_NOTICE_TEMPLATE;
    await emailOutboxModel.enqueue(
        {
            recipientUserId: null,
            recipientEmail: input.email,
            template,
            payload: { partnerId: input.partnerId, partnerName: input.partnerName, locale },
            dedupKey: buildEmailDedupKey({
                recipient: input.email.toLowerCase(),
                template,
                occurrence: buildEventOccurrence({ eventId: input.partnerId })
            }),
            correlationId: input.correlationId
        },
        input.tx
    );
}

/** Enqueues a rejection notice to the email address inside the rejection transaction. */
export async function enqueuePartnerApplicationRejectedNotice(input: {
    readonly tx: DrizzleClient;
    readonly email: string;
    readonly applicationId: string;
    readonly correlationId: string;
}): Promise<void> {
    const reapplyAfter = await partnerApplicationModel.readReapplyAfter({
        tx: input.tx,
        applicationId: input.applicationId
    });
    const locale = await partnerApplicationModel.readAccountLocaleByEmail({
        tx: input.tx,
        email: input.email
    });
    const template = PARTNER_APPLICATION_REJECTED_TEMPLATE;
    await emailOutboxModel.enqueue(
        {
            recipientUserId: null,
            recipientEmail: input.email,
            template,
            payload: {
                applicationId: input.applicationId,
                reapplyAfter: reapplyAfter.toISOString(),
                locale
            },
            dedupKey: buildEmailDedupKey({
                recipient: input.email.toLowerCase(),
                template,
                occurrence: buildEventOccurrence({ eventId: input.applicationId })
            }),
            correlationId: input.correlationId
        },
        input.tx
    );
}

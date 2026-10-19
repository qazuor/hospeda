import type { DrizzleClient, EnqueueEmailResult } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    listSuperAdminRecipients
} from '@repo/db';
import type { ListingVertical } from '@repo/verticals';
import { apiLogger } from '../../utils/logger';

/** Outbox template for an owner reporting a requested fix as complete. */
export const LISTING_FIX_REPORTED_TEMPLATE = 'verticals.listing-fix-reported';

/** Typed outcome of enqueuing an owner-reported fix notice. */
export type FixReportedNoticeResult =
    | { readonly status: 'ENQUEUED'; readonly enqueued: number; readonly recipients: number }
    | { readonly status: 'NO_RECIPIENTS' }
    | { readonly status: 'ENQUEUE_FAILED' };

/** Input required to enqueue the staff notice within the domain transaction. */
export interface EnqueueFixReportedNoticeInput {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly fixRequest: {
        readonly id: string;
        readonly reason: string;
        readonly suggestedDate: string | null;
        readonly openedAt: Date;
    };
    readonly reportedAt: Date;
}

/** Optional ports for recipient lookup and outbox insertion. */
export interface FixReportedNoticePorts {
    readonly recipients?: {
        list(input: {
            readonly tx: DrizzleClient;
        }): Promise<readonly { userId: string; email: string }[]>;
    };
    readonly enqueue?: (
        mail: Parameters<typeof emailOutboxModel.enqueue>[0],
        tx: DrizzleClient
    ) => Promise<EnqueueEmailResult>;
}

/** Enqueues one deduplicated fix-reported notice per SUPER_ADMIN in a savepoint. */
export async function enqueueFixReportedNotice(
    input: EnqueueFixReportedNoticeInput,
    ports: FixReportedNoticePorts = {}
): Promise<FixReportedNoticeResult> {
    try {
        return await input.tx.transaction(async (sp) => {
            const recipients = await (ports.recipients ?? { list: listSuperAdminRecipients }).list({
                tx: sp
            });
            if (recipients.length === 0) {
                apiLogger.warn(
                    {
                        fixRequestId: input.fixRequest.id,
                        listingId: input.listingId,
                        vertical: input.vertical
                    },
                    'No SUPER_ADMIN recipients for listing fix-reported notice'
                );
                return { status: 'NO_RECIPIENTS' };
            }
            let enqueued = 0;
            for (const recipient of recipients) {
                const template = LISTING_FIX_REPORTED_TEMPLATE;
                const dedupKey = buildEmailDedupKey({
                    recipient: recipient.userId,
                    template,
                    occurrence: buildEventOccurrence({ eventId: input.fixRequest.id })
                });
                const result = await (
                    ports.enqueue ?? ((mail, tx) => emailOutboxModel.enqueue(mail, tx))
                )(
                    {
                        recipientUserId: recipient.userId,
                        recipientEmail: recipient.email,
                        template,
                        payload: {
                            vertical: input.vertical,
                            listingId: input.listingId,
                            ownerId: input.ownerId,
                            fixRequestId: input.fixRequest.id,
                            reason: input.fixRequest.reason,
                            suggestedDate: input.fixRequest.suggestedDate,
                            requestedAt: input.fixRequest.openedAt.toISOString(),
                            reportedAt: input.reportedAt.toISOString()
                        },
                        dedupKey,
                        correlationId: null
                    },
                    sp
                );
                if (result.enqueued) enqueued += 1;
            }
            return { status: 'ENQUEUED', enqueued, recipients: recipients.length };
        });
    } catch (error) {
        apiLogger.error(
            {
                fixRequestId: input.fixRequest.id,
                listingId: input.listingId,
                vertical: input.vertical,
                error
            },
            'Could not enqueue listing fix-reported notice'
        );
        return { status: 'ENQUEUE_FAILED' };
    }
}

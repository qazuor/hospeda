import { newsletterCampaignDeliveries, newsletterCampaigns } from '@repo/db';
import { eq } from 'drizzle-orm';
import { withServiceTransaction } from '../../../utils/transaction.js';
import type { ResolvedNewsletterContent } from './campaign-content.js';

/** Atomically freeze resolved content and create the deliveries that consume it. */
export async function persistCampaignDispatch(input: {
    readonly campaignId: string;
    readonly eligibleIds: readonly string[];
    readonly softCappedCount: number;
    readonly attributionSlug: string;
    readonly resolvedBodyJson: ResolvedNewsletterContent | null;
    readonly resolvedAt: Date;
}): Promise<string[]> {
    return withServiceTransaction(async ({ tx }) => {
        if (!tx) throw new Error('Campaign dispatch requires a transaction');
        const inserted = await tx
            .insert(newsletterCampaignDeliveries)
            .values(
                input.eligibleIds.map((subscriberId) => ({
                    campaignId: input.campaignId,
                    subscriberId,
                    channel: 'email',
                    status: 'pending' as const
                }))
            )
            .onConflictDoNothing()
            .returning({ id: newsletterCampaignDeliveries.id });
        await tx
            .update(newsletterCampaigns)
            .set({
                status: 'sending',
                sentAt: new Date(),
                totalRecipients: inserted.length,
                totalSoftcapped: input.softCappedCount,
                attributionSlug: input.attributionSlug,
                ...(input.resolvedBodyJson
                    ? {
                          resolvedBodyJson: input.resolvedBodyJson,
                          resolvedAt: input.resolvedAt
                      }
                    : {}),
                updatedAt: new Date()
            })
            .where(eq(newsletterCampaigns.id, input.campaignId));
        return inserted.map(({ id }) => id);
    });
}

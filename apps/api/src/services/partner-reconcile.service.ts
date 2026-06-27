import { and, eq, getDb, isNull, partnerSubscriptions, partners } from '@repo/db';
import { LifecycleStatusEnum, PartnerSubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../utils/logger.js';

function mapBillingStatusToPartnerState(status: string): {
    subscriptionStatus: PartnerSubscriptionStatusEnum;
    lifecycleState: LifecycleStatusEnum;
} {
    switch (status) {
        case 'active':
        case 'trialing':
            return {
                subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
        case 'past_due':
            return {
                subscriptionStatus: PartnerSubscriptionStatusEnum.PAST_DUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
        case 'incomplete':
        case 'pending_provider':
        case 'abandoned':
            return {
                subscriptionStatus: PartnerSubscriptionStatusEnum.PENDING,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
        default:
            return {
                subscriptionStatus: PartnerSubscriptionStatusEnum.CANCELLED,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            };
    }
}

export async function reconcilePartnerForSubscription(input: {
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}): Promise<void> {
    const { subscriptionId, subscriptionStatus, source } = input;

    try {
        const db = getDb();
        const links = await db
            .select({ partnerId: partnerSubscriptions.partnerId })
            .from(partnerSubscriptions)
            .where(eq(partnerSubscriptions.subscriptionId, subscriptionId));

        if (links.length === 0) {
            return;
        }

        await db
            .update(partnerSubscriptions)
            .set({ status: subscriptionStatus, updatedAt: new Date() })
            .where(eq(partnerSubscriptions.subscriptionId, subscriptionId));

        const mapped = mapBillingStatusToPartnerState(subscriptionStatus);

        for (const link of links) {
            await db
                .update(partners)
                .set({
                    subscriptionStatus: mapped.subscriptionStatus,
                    lifecycleState: mapped.lifecycleState,
                    updatedAt: new Date()
                })
                .where(and(eq(partners.id, link.partnerId), isNull(partners.deletedAt)));
        }

        apiLogger.info(
            {
                subscriptionId,
                subscriptionStatus,
                partnerCount: links.length,
                source
            },
            'Partner subscription state reconciled from billing lifecycle'
        );
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId,
                subscriptionStatus,
                source,
                error: error instanceof Error ? error.message : String(error)
            },
            'Partner reconcile lookup failed — skipping (non-blocking)'
        );
    }
}

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

        // The alliance begins the moment billing confirms the first charge, so
        // that is when `startsAt` gets sealed (HOS-409). Provisioning leaves it
        // null on purpose — nothing had started yet — and the unpaid reaper
        // reads exactly that column to decide who never paid
        // (`PartnerModel.findUnpaidProvisioned`). A partner activated by a real
        // charge but left with a null date looks identical to a deadbeat: the
        // reaper mails an unpaid notice on day 30 and archives them on day 90
        // while MercadoPago is still charging them.
        //
        // Only on the statuses that mean "paying". `past_due` and `incomplete`
        // also keep the lifecycle ACTIVE, but stamping the date there would
        // exempt a partner who never paid at all from the reaper entirely.
        const startsAlliance = mapped.subscriptionStatus === PartnerSubscriptionStatusEnum.ACTIVE;

        for (const link of links) {
            // Read before writing so an admin who typed the real start date on
            // the edit form outranks "today", and so each renewal webhook — they
            // all re-report `active` — does not keep resetting it. Two webhooks
            // racing here both write roughly the same instant, which is harmless.
            let startsAtPatch: { startsAt?: Date } = {};
            if (startsAlliance) {
                const [existing] = await db
                    .select({ id: partners.id, startsAt: partners.startsAt })
                    .from(partners)
                    .where(and(eq(partners.id, link.partnerId), isNull(partners.deletedAt)));

                if (existing && !existing.startsAt) {
                    startsAtPatch = { startsAt: new Date() };
                }
            }

            await db
                .update(partners)
                .set({
                    subscriptionStatus: mapped.subscriptionStatus,
                    lifecycleState: mapped.lifecycleState,
                    updatedAt: new Date(),
                    ...startsAtPatch
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

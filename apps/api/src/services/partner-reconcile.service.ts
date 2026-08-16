import { and, eq, getDb, isNull, partnerSubscriptions, partners } from '@repo/db';
import {
    LifecycleStatusEnum,
    PartnerSubscriptionStatusEnum,
    ProductDomainEnum
} from '@repo/schemas';
import { apiLogger } from '../utils/logger.js';
import {
    isPublishingSubscriptionStatus,
    readSubscriptionDomainMetadata
} from './billing/subscription-domain-metadata.js';

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

/**
 * Recover the partner of a subscription no link row points at, using the
 * coordinates the checkout stamped on the subscription itself.
 *
 * `partner_subscriptions` is UNIQUE on `partner_id` and UPSERTED, while Path C
 * creates one `pending_provider` subscription per checkout CLICK — so an admin
 * re-sending the payment link (or the buyer opening it twice) re-points the row
 * and orphans the earlier subscription, whose MercadoPago share link stays
 * valid. Paying through that earlier link used to leave the partner PENDING
 * forever while being charged.
 *
 * The status guard and the incumbent guard mirror the commerce reconciler's —
 * see `recoverCommerceLinkFromSubscriptionMetadata` for the full reasoning:
 * only a paying status may claim the row, and it is never taken from another
 * subscription that is itself already paying.
 *
 * @param input.subscriptionId - Subscription whose link row is missing.
 * @param input.subscriptionStatus - Status being reconciled.
 * @param input.source - Caller label for log diagnostics.
 * @returns The recovered link (single element), or an empty array.
 */
async function recoverPartnerLinkFromSubscriptionMetadata(input: {
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}): Promise<readonly { partnerId: string }[]> {
    const { subscriptionId, subscriptionStatus, source } = input;

    if (!isPublishingSubscriptionStatus(subscriptionStatus)) {
        return [];
    }

    const coordinates = await readSubscriptionDomainMetadata({ subscriptionId });
    const partnerId = coordinates?.partnerId;
    if (!partnerId) {
        return [];
    }

    const db = getDb();
    const [incumbent] = await db
        .select({
            subscriptionId: partnerSubscriptions.subscriptionId,
            status: partnerSubscriptions.status
        })
        .from(partnerSubscriptions)
        .where(eq(partnerSubscriptions.partnerId, partnerId))
        .limit(1);

    if (incumbent && isPublishingSubscriptionStatus(incumbent.status)) {
        apiLogger.error(
            {
                subscriptionId,
                incumbentSubscriptionId: incumbent.subscriptionId,
                partnerId,
                subscriptionStatus,
                source
            },
            'Two paying subscriptions for the same partner — leaving the link row on the incumbent; one of the two charges must be refunded/cancelled by hand'
        );
        return [];
    }

    await db
        .insert(partnerSubscriptions)
        .values({
            subscriptionId,
            productDomain: ProductDomainEnum.PARTNER,
            partnerId,
            status: subscriptionStatus
        })
        .onConflictDoUpdate({
            target: partnerSubscriptions.partnerId,
            set: { subscriptionId, status: subscriptionStatus, updatedAt: new Date() }
        });

    apiLogger.warn(
        {
            subscriptionId,
            supersededSubscriptionId: incumbent?.subscriptionId ?? null,
            partnerId,
            subscriptionStatus,
            source
        },
        'Recovered a paid partner subscription no link row pointed at (superseded by a later checkout click) — link row re-pointed'
    );

    return [{ partnerId }];
}

/**
 * Mirror a billing subscription's status onto every partner linked to it
 * (status, lifecycle state, and the `startsAt` seal — HOS-409).
 *
 * Non-throwing by contract: runs from the MercadoPago webhook handler and the
 * billing crons, none of which may break because of a partner-side reconcile.
 *
 * @param input.subscriptionId - The billing subscription whose status changed.
 * @param input.subscriptionStatus - The new status to mirror.
 * @param input.source - Caller label for log diagnostics (e.g. `'mp-webhook'`).
 */
export async function reconcilePartnerForSubscription(input: {
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}): Promise<void> {
    const { subscriptionId, subscriptionStatus, source } = input;

    try {
        const db = getDb();
        const linkedRows = await db
            .select({ partnerId: partnerSubscriptions.partnerId })
            .from(partnerSubscriptions)
            .where(eq(partnerSubscriptions.subscriptionId, subscriptionId));

        // No link row means either a non-partner subscription (the common path)
        // or a partner subscription orphaned by a later checkout click.
        const links: readonly { partnerId: string }[] =
            linkedRows.length > 0
                ? linkedRows
                : await recoverPartnerLinkFromSubscriptionMetadata({
                      subscriptionId,
                      subscriptionStatus,
                      source
                  });

        if (links.length === 0) {
            return;
        }

        if (linkedRows.length > 0) {
            // Skipped on the recovery path, whose upsert already wrote it.
            await db
                .update(partnerSubscriptions)
                .set({ status: subscriptionStatus, updatedAt: new Date() })
                .where(eq(partnerSubscriptions.subscriptionId, subscriptionId));
        }

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

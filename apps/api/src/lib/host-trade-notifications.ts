/**
 * The emails the benefit chain runs on (HOS-376 T-041).
 *
 * WHY THIS LIVES IN `apps/api` AND NOT IN THE SERVICE. Every one of these five
 * sends is triggered from a route that already has the row and the actor, so a
 * port injected into `service-core` — the shape HOS-278 R-4 needed, because the
 * revoke notification fires from inside the service — would buy nothing here
 * and would drag the notification transport into the business layer.
 *
 * EVERY SEND IS FIRE-AND-FORGET AND SWALLOWS ITS ERRORS. `trySendNotification`
 * already reports failures rather than throwing, and each function here is
 * additionally wrapped so that a missing account row or a transport outage can
 * never turn a confirmed usage into a failed request. The write already
 * happened; the email is a courtesy on top of it. §6.6 puts the whole chain's
 * survival on the host finding out — but the way to honour that is retries and
 * the reminder cron, never a rollback of work that is already recorded.
 *
 * @module lib/host-trade-notifications
 */

import { getDb, hostTradeReviews, hostTrades, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { eq } from 'drizzle-orm';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { trySendNotification } from '../utils/notification-helper';

/** The account fields every one of these emails needs. */
type Recipient = {
    readonly id: string;
    readonly email: string;
    readonly name: string;
};

/** The usage fields these notifications read. */
export type UsageForNotification = {
    readonly id: string;
    readonly hostTradeId: string;
    readonly hostUserId: string;
    readonly declaredBy: string;
    readonly declaredById?: string | null;
    readonly servicedAt: string | Date;
    readonly expiresAt?: string | Date | null;
};

/** Where a host answers a pending usage. */
const inboxUrl = () => `${env.HOSPEDA_SITE_URL.replace(/\/$/, '')}/mi-cuenta/usos-de-beneficio`;

/** Where a provider works his own listing. */
const providerPanelUrl = () => `${env.HOSPEDA_SITE_URL.replace(/\/$/, '')}/mi-cuenta/proveedor`;

/** Where a host writes a review of one provider. */
const reviewUrl = (slug: string) =>
    `${env.HOSPEDA_SITE_URL.replace(/\/$/, '')}/mi-cuenta/directorio-proveedores/${encodeURIComponent(slug)}`;

/** Resolves an account's address, or nothing when it cannot be reached. */
async function loadRecipient(userId: string | null | undefined): Promise<Recipient | null> {
    if (!userId) return null;

    const db = getDb();
    const [row] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!row?.email) return null;
    return { id: row.id, email: row.email, name: row.displayName ?? 'Hola' };
}

/** Resolves the listing's name, slug and owner. */
async function loadListing(hostTradeId: string) {
    const db = getDb();
    const [row] = await db
        .select({
            name: hostTrades.name,
            slug: hostTrades.slug,
            ownerUserId: hostTrades.ownerUserId
        })
        .from(hostTrades)
        .where(eq(hostTrades.id, hostTradeId))
        .limit(1);

    return row ?? null;
}

/** Runs a send and swallows anything it throws. */
async function safely(label: string, run: () => Promise<void>): Promise<void> {
    try {
        await run();
    } catch (error) {
        apiLogger.warn({ error, label }, '[host-trade-notifications] send failed, ignoring');
    }
}

/**
 * Asks the counterpart to confirm a freshly declared usage.
 *
 * WHO GETS IT IS DECIDED BY `declaredBy`, not by the caller's role — the same
 * role-blindness the transition endpoints have. A provider declared it, so the
 * host must answer; a host declared it, so the provider's owner must.
 */
export async function notifyUsageDeclared(usage: UsageForNotification): Promise<void> {
    await safely('usage-declared', async () => {
        const listing = await loadListing(usage.hostTradeId);
        if (!listing) return;

        const declaredByProvider = usage.declaredBy === 'PROVIDER';
        const recipient = await loadRecipient(
            declaredByProvider ? usage.hostUserId : listing.ownerUserId
        );
        if (!recipient) return;

        const counterpartName = declaredByProvider
            ? listing.name
            : ((await loadRecipient(usage.hostUserId))?.name ?? 'Un anfitrión');

        await trySendNotification({
            type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REQUEST,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            userId: recipient.id,
            counterpartName,
            servicedAt: String(usage.servicedAt),
            expiresAt: String(usage.expiresAt ?? ''),
            actionUrl: declaredByProvider ? inboxUrl() : providerPanelUrl()
        });
    });
}

/**
 * Tells the declarant their usage was confirmed.
 *
 * The review invitation rides along ONLY for a host declarant: a provider
 * cannot review his own listing, and pointing him at the form would promise
 * something the eligibility gates refuse.
 */
export async function notifyUsageConfirmed(usage: UsageForNotification): Promise<void> {
    await safely('usage-confirmed', async () => {
        const listing = await loadListing(usage.hostTradeId);
        if (!listing) return;

        const declaredByProvider = usage.declaredBy === 'PROVIDER';
        const declarant = await loadRecipient(
            declaredByProvider ? listing.ownerUserId : usage.hostUserId
        );
        if (!declarant) return;

        const confirmedBy = declaredByProvider
            ? ((await loadRecipient(usage.hostUserId))?.name ?? 'El anfitrión')
            : listing.name;

        await trySendNotification({
            type: NotificationType.HOST_TRADE_USAGE_CONFIRMED,
            recipientEmail: declarant.email,
            recipientName: declarant.name,
            userId: declarant.id,
            counterpartName: confirmedBy,
            canReview: !declaredByProvider,
            reviewUrl: declaredByProvider ? undefined : reviewUrl(listing.slug)
        });
    });
}

/** Tells the declarant their usage was rejected, with the note if there was one. */
export async function notifyUsageRejected(
    usage: UsageForNotification,
    note?: string | null
): Promise<void> {
    await safely('usage-rejected', async () => {
        const listing = await loadListing(usage.hostTradeId);
        if (!listing) return;

        const declaredByProvider = usage.declaredBy === 'PROVIDER';
        const declarant = await loadRecipient(
            declaredByProvider ? listing.ownerUserId : usage.hostUserId
        );
        if (!declarant) return;

        const rejectedBy = declaredByProvider
            ? ((await loadRecipient(usage.hostUserId))?.name ?? 'El anfitrión')
            : listing.name;

        await trySendNotification({
            type: NotificationType.HOST_TRADE_USAGE_REJECTED,
            recipientEmail: declarant.email,
            recipientName: declarant.name,
            userId: declarant.id,
            counterpartName: rejectedBy,
            note: note ?? undefined
        });
    });
}

/** Tells a provider a host reviewed their listing. */
export async function notifyReviewCreated(review: {
    readonly hostTradeId: string;
    readonly overallRating: number;
    readonly respectedBenefit: boolean;
}): Promise<void> {
    await safely('review-created', async () => {
        const listing = await loadListing(review.hostTradeId);
        if (!listing) return;

        const owner = await loadRecipient(listing.ownerUserId);
        if (!owner) return;

        await trySendNotification({
            type: NotificationType.HOST_TRADE_REVIEW_RECEIVED,
            recipientEmail: owner.email,
            recipientName: owner.name,
            userId: owner.id,
            listingName: listing.name,
            overallRating: review.overallRating,
            respectedBenefit: review.respectedBenefit,
            actionUrl: providerPanelUrl()
        });
    });
}

/**
 * Tells a provider how their reply was moderated (AC-24).
 *
 * The reason travels HERE and nowhere else: the protected read schema
 * deliberately withholds it, so a rejection with no email leaves the provider
 * with a reply that silently never appeared.
 */
export async function notifyReplyModerated(input: {
    readonly reviewId: string;
    readonly outcome: 'approved' | 'rejected';
    readonly reason?: string | null;
}): Promise<void> {
    await safely('reply-moderated', async () => {
        // A reply hangs off the REVIEW, not off the listing — there is no
        // `hostTradeId` on the row — so the provider is reached through the
        // review it answers. Reading it straight off the reply would resolve
        // to nothing and drop this email in silence.
        const db = getDb();
        const [review] = await db
            .select({ hostTradeId: hostTradeReviews.hostTradeId })
            .from(hostTradeReviews)
            .where(eq(hostTradeReviews.id, input.reviewId))
            .limit(1);
        if (!review) return;

        const listing = await loadListing(review.hostTradeId);
        if (!listing) return;

        const owner = await loadRecipient(listing.ownerUserId);
        if (!owner) return;

        await trySendNotification({
            type: NotificationType.HOST_TRADE_REPLY_MODERATED,
            recipientEmail: owner.email,
            recipientName: owner.name,
            userId: owner.id,
            outcome: input.outcome,
            reason: input.reason ?? undefined,
            actionUrl: providerPanelUrl()
        });
    });
}

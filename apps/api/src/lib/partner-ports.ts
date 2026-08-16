/**
 * @file partner-ports.ts
 * @description Port implementation for partner notifications (HOS-278 R-4).
 *
 * Bridges `PartnerService`'s `PartnerRevokeNotifyPort` to the API's runtime
 * dependencies (the `users` table and the notification transport), keeping
 * `@repo/service-core` free of both. Sibling of `host-trade-ports.ts`.
 *
 * @module lib/partner-ports
 */

import { getDb, PartnerModel, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { PartnerMentionChannelEnum, PreferredContactEnum } from '@repo/schemas';
import type { PartnerMentionNotifyPort, PartnerRevokeNotifyPort } from '@repo/service-core';
import { formatCalendarDate } from '@repo/utils';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';

/**
 * Creates the {@link PartnerRevokeNotifyPort} implementation (HOS-278 R-4).
 *
 * Writes to the OWNER'S ACCOUNT address, not to anything in the partner's own
 * `contactInfo`. That column is maintained by the partner for the public to
 * reach them by, and a partner who is being taken down is exactly the case
 * where it may be stale or deliberately wrong. The account email is the only
 * address the platform knows is real.
 *
 * A revocation whose owner has no account row is logged and dropped rather
 * than thrown: the row is already written, and failing here would report a
 * completed revocation as an error.
 *
 * @returns A {@link PartnerRevokeNotifyPort} implementation.
 */
export function createPartnerRevokeNotifyPort(): PartnerRevokeNotifyPort {
    return {
        notifyRevoked: async ({ partnerId, ownerUserId, partnerName, reason }) => {
            const db = getDb();
            const [owner] = await db
                .select({ email: users.email, displayName: users.displayName })
                .from(users)
                .where(eq(users.id, ownerUserId))
                .limit(1);

            if (!owner?.email) {
                apiLogger.warn(
                    { partnerId, ownerUserId },
                    '[partner-revoke] owner account has no email — notice not sent'
                );
                return;
            }

            await sendNotification({
                type: NotificationType.PARTNER_REVOKED,
                recipientEmail: owner.email,
                recipientName: owner.displayName ?? partnerName,
                userId: ownerUserId,
                partnerName,
                reason
            });

            apiLogger.info({ partnerId }, '[partner-revoke] partner notified');
        }
    };
}

/**
 * Human labels for the mention channels, in the email's language.
 *
 * Hardcoded Spanish, matching `RESOURCE_NAMES` in `utils/limit-check.ts` and
 * every template in `@repo/notifications`: these emails are Spanish-only by
 * construction, and the package deliberately does not depend on `@repo/schemas`
 * or `@repo/i18n`. Resolving the label HERE is the boundary the notification
 * types already establish for enum-ish values (see `providerLabel` on
 * `AccommodationCalendarFeedBrokenPayload`).
 *
 * Typed as an exhaustive `Record` on purpose: adding a channel to the enum
 * without labelling it is then a compile error rather than an email that says
 * "TIKTOK" to a partner.
 */
const MENTION_CHANNEL_LABELS: Record<PartnerMentionChannelEnum, string> = {
    [PartnerMentionChannelEnum.INSTAGRAM]: 'Instagram',
    [PartnerMentionChannelEnum.FACEBOOK]: 'Facebook',
    [PartnerMentionChannelEnum.TWITTER]: 'Twitter',
    [PartnerMentionChannelEnum.YOUTUBE]: 'YouTube',
    [PartnerMentionChannelEnum.TIKTOK]: 'TikTok',
    [PartnerMentionChannelEnum.NEWSLETTER]: 'Newsletter',
    [PartnerMentionChannelEnum.WHATSAPP]: 'WhatsApp',
    [PartnerMentionChannelEnum.OTHER]: 'Otro canal'
};

/** Shape of the two email columns inside `partners.contact_info`. */
interface PartnerContactEmails {
    readonly preferredEmail?: string | null;
    readonly workEmail?: string | null;
    readonly personalEmail?: string | null;
}

/**
 * Picks the address to write to, or null when the partner has none.
 *
 * `preferredEmail` is a PREFERENCE (`HOME`/`WORK`/`MOBILE`), not an address, so
 * it selects between the two real columns rather than being one. The preference
 * is honoured first and then falls THROUGH rather than failing: a partner who
 * said "write to me at work" but only ever filled in a personal address should
 * still hear from us, and `MOBILE` names no email column at all.
 *
 * Returns null rather than throwing. `contactInfo` is nullable and every field
 * inside it is nullish, so a hand-curated partner legitimately has no address —
 * that is an ordinary state, not an error (R-2).
 */
function resolvePartnerEmail(contact: PartnerContactEmails | null | undefined): string | null {
    if (!contact) return null;

    const work = contact.workEmail?.trim() || null;
    const personal = contact.personalEmail?.trim() || null;

    if (contact.preferredEmail === PreferredContactEnum.WORK && work) return work;
    if (contact.preferredEmail === PreferredContactEnum.HOME && personal) return personal;

    return work ?? personal;
}

/**
 * Creates the {@link PartnerMentionNotifyPort} implementation (HOS-377 AC-9).
 *
 * Writes to the address in `partners.contactInfo`, NOT to the owner's account
 * email the way {@link createPartnerRevokeNotifyPort} does. The two cases pull
 * in opposite directions on purpose: a revocation goes to the account because
 * the partner's own contact details may be stale or hostile precisely when they
 * are being taken down, whereas this is routine good news about the arrangement
 * they are paying for, and `contactInfo` is the business address they chose to
 * be reached at.
 *
 * ## Every failure here is swallowed
 *
 * The service already committed the rows and calls this outside the
 * transaction. A partner with no reachable address, a partner row that vanished
 * between commit and send, a mail transport that is down — none of them are a
 * reason to report a promotion that genuinely happened as an error, or to make
 * the admin retype the form. They are logged and dropped.
 *
 * @returns A {@link PartnerMentionNotifyPort} implementation.
 */
export function createPartnerMentionNotifyPort(): PartnerMentionNotifyPort {
    return async ({ partnerId, batchId, mentions }) => {
        if (mentions.length === 0) return;

        const partnerModel = new PartnerModel();
        const partner = await partnerModel.findById(partnerId);

        if (!partner) {
            apiLogger.warn(
                { partnerId, batchId },
                '[partner-mentions] partner not found — notice not sent'
            );
            return;
        }

        const partnerName = (partner.name as string | undefined) ?? 'tu ficha de aliado';
        const recipientEmail = resolvePartnerEmail(
            partner.contactInfo as PartnerContactEmails | null | undefined
        );

        if (!recipientEmail) {
            // R-2: an ordinary state for a hand-curated partner, not a failure.
            apiLogger.warn(
                { partnerId, batchId },
                '[partner-mentions] partner has no contact email — notice not sent'
            );
            return;
        }

        // ONE send for the whole submission (AC-9). Four emails about one
        // campaign is spam, and it is what the partner would receive if this
        // loop lived here instead of inside the payload.
        await sendNotification({
            type: NotificationType.PARTNER_MENTIONS_LOGGED,
            recipientEmail,
            recipientName: partnerName,
            // Null when the partner has no owner account yet — a claim invite
            // may still be outstanding. The address in `contactInfo` is what
            // makes them reachable, and it does not depend on a `users` row.
            userId: (partner.ownerUserId as string | null | undefined) ?? null,
            partnerName,
            mentionedAtLabel: formatMentionedAt(mentions[0]?.mentionedAt),
            mentions: mentions.map((mention) => ({
                channelLabel:
                    MENTION_CHANNEL_LABELS[mention.channel as PartnerMentionChannelEnum] ??
                    MENTION_CHANNEL_LABELS[PartnerMentionChannelEnum.OTHER],
                url: mention.url ?? null
            }))
        });

        apiLogger.info(
            { partnerId, batchId, channels: mentions.length },
            '[partner-mentions] partner notified'
        );
    };
}

/**
 * Formats the promotion date for the email body and subject.
 *
 * Every row of a submission shares `mentionedAt` by construction — the create
 * schema takes one date for the whole batch — so reading it off the first row
 * is not a sampling shortcut.
 *
 * `mentionedAt` names a DAY, not an instant: the admin form offers a bare date
 * picker, so the value is pinned to midnight UTC. Converting that into Argentine
 * local time — which this function used to do explicitly — moves it to 21:00 the
 * previous day, and the email told the partner we broadcast them a day before we
 * did (smoke agosto 2026, same defect as H-73 but on the outbound side, where a
 * third party reads it). `formatCalendarDate` pins the timezone to UTC, so the
 * day survives whatever timezone the API container happens to run in.
 */
function formatMentionedAt(value: Date | undefined): string {
    return (
        formatCalendarDate({
            value,
            locale: 'es-AR',
            options: { day: 'numeric', month: 'long', year: 'numeric' }
        }) ?? ''
    );
}

/**
 * The email an owner gets when an admin resolves their location exception request
 * (HOS-2192): approved or rejected, in the owner's web language.
 *
 * It is fire-and-forget and swallows its errors, like the other sends of the repo:
 * the decision is already committed and on the audit trail, and a transport outage
 * must never turn it into a failed request. The notice names the listing and, on a
 * rejection, the admin's reason. It never carries the address or another listing.
 *
 * @module lib/location-exception-notifications
 */

import { getDb, users } from '@repo/db';
import { buildListingLocationExceptionSubject, NotificationType } from '@repo/notifications';
import { VerticalEnum } from '@repo/schemas';
import type { LocationExceptionDecision } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { resolveRecipientLocale } from '../services/notification-recipient-locale';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { trySendNotification } from '../utils/notification-helper';

/**
 * Absolute link to the location section of the listing's editor.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.listingId - The listing.
 * @param args.locale - The owner's web language.
 */
export function buildLocationEditorUrl(args: {
    readonly vertical: LocationExceptionDecision['vertical'];
    readonly listingId: string;
    readonly locale: string;
}): string {
    const site = env.HOSPEDA_SITE_URL.replace(/\/$/, '');
    const id = encodeURIComponent(args.listingId);
    return args.vertical === VerticalEnum.VENUE
        ? `${site}/${args.locale}/mi-cuenta/comercio/venue/${id}/editar/ubicacion/`
        : `${site}/${args.locale}/mi-cuenta/propiedades/${id}/editar/ubicacion/`;
}

/**
 * Tells the owner how their request was resolved. Never throws.
 *
 * @param decision - What the service returned after the commit.
 */
export async function notifyLocationExceptionDecision(
    decision: LocationExceptionDecision
): Promise<void> {
    try {
        const [owner] = await getDb()
            .select({ id: users.id, email: users.email, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, decision.ownerId))
            .limit(1);
        if (!owner?.email) return;
        const locale = await resolveRecipientLocale({ userId: owner.id });
        const approved = decision.status === 'APPROVED';
        await trySendNotification({
            type: approved
                ? NotificationType.LISTING_LOCATION_EXCEPTION_APPROVED
                : NotificationType.LISTING_LOCATION_EXCEPTION_REJECTED,
            recipientEmail: owner.email,
            recipientName: owner.displayName ?? '',
            userId: owner.id,
            locale,
            decisionSubject: buildListingLocationExceptionSubject({ locale, approved }).subject,
            listingName: decision.listingName,
            decisionReason: approved ? undefined : decision.decisionReason,
            editorUrl: buildLocationEditorUrl({
                vertical: decision.vertical,
                listingId: decision.listingId,
                locale
            })
        });
    } catch (error) {
        apiLogger.warn(
            { error, requestId: decision.requestId },
            '[location-exception-notifications] send failed, ignoring'
        );
    }
}

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

import { getDb, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { PartnerRevokeNotifyPort } from '@repo/service-core';
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

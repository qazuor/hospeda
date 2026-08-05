/**
 * @file host-trade-ports.ts
 * @description Port implementation for host-trade notifications (HOS-278 R-4).
 *
 * Bridges `HostTradeService`'s `HostTradeRevokeNotifyPort` to the API's runtime
 * dependencies (the `users` table and the notification transport), keeping
 * `@repo/service-core` free of both.
 *
 * @module lib/host-trade-ports
 */

import { getDb, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { HostTradeRevokeNotifyPort } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';

/**
 * Creates the {@link HostTradeRevokeNotifyPort} implementation (HOS-278 R-4).
 *
 * Writes to the OWNER'S ACCOUNT address, not to the listing's `contact` field.
 * `contact` is free text an admin typed for hosts to reach the provider by —
 * it may be a phone number, a WhatsApp link, or two of each, and treating it
 * as an inbox would send this to nobody or to the wrong place. The account
 * email is the only address the platform knows is real.
 *
 * A revocation whose owner has no account row is logged and dropped rather
 * than thrown: the row is already written, and failing here would report a
 * completed revocation as an error.
 *
 * @returns A {@link HostTradeRevokeNotifyPort} implementation.
 */
export function createHostTradeRevokeNotifyPort(): HostTradeRevokeNotifyPort {
    return {
        notifyRevoked: async ({ hostTradeId, ownerUserId, listingName, reason }) => {
            const db = getDb();
            const [owner] = await db
                .select({ email: users.email, displayName: users.displayName })
                .from(users)
                .where(eq(users.id, ownerUserId))
                .limit(1);

            if (!owner?.email) {
                apiLogger.warn(
                    { hostTradeId, ownerUserId },
                    '[host-trade-revoke] owner account has no email — notice not sent'
                );
                return;
            }

            await sendNotification({
                type: NotificationType.HOST_TRADE_REVOKED,
                recipientEmail: owner.email,
                recipientName: owner.displayName ?? listingName,
                userId: ownerUserId,
                listingName,
                reason
            });

            apiLogger.info({ hostTradeId }, '[host-trade-revoke] provider notified');
        }
    };
}

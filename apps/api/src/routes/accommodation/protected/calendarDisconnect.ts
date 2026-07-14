/**
 * DELETE /api/v1/protected/accommodations/:id/calendar-sync/:provider
 *
 * Owner self-service: disconnect an accommodation's external calendar
 * connection (HOS-157 Phase 2 — Layer 4). Phase 2 only supports the `google`
 * provider; the path param is kept so Phase 3 (Airbnb/Booking iCal) reuses the
 * same route shape.
 *
 * Soft disconnect: sets `isActive=false` (the cron's `findAllActiveByProvider`
 * stops picking the row up) but keeps the row for audit. Existing occupancy
 * rows previously synced from the calendar are intentionally LEFT in place —
 * disconnecting stops future syncs, it does not retroactively free dates the
 * host may still be honoring.
 *
 * Gate model: ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` inline. Deliberately
 * NO `CAN_SYNC_EXTERNAL_CALENDAR` entitlement check — a host who lost the
 * entitlement (downgrade) must still be able to disconnect a stale connection,
 * so gating disconnect behind the entitlement would trap them.
 *
 * @module routes/accommodation/protected/calendarDisconnect
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import { AccommodationIdSchema, OccupancySourceEnum } from '@repo/schemas';
import { assertOccupancyManageAccess } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Maps the public `:provider` path token to the internal occupancy source. */
const PROVIDER_BY_TOKEN: Record<string, OccupancySourceEnum> = {
    google: OccupancySourceEnum.GOOGLE_CALENDAR
};

const CalendarDisconnectResponseSchema = z.object({
    disconnected: z.boolean()
});

/**
 * DELETE /api/v1/protected/accommodations/:id/calendar-sync/:provider
 *
 * Soft-disconnects the accommodation's calendar connection for the given
 * provider (Phase 2: `google`). Requires ownership + `ACCOMMODATION_OCCUPANCY_MANAGE`;
 * no entitlement gate.
 */
export const protectedCalendarDisconnectRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/calendar-sync/{provider}',
    summary: 'Disconnect an external calendar connection (owner)',
    description:
        "Soft-disconnects (isActive=false, row kept for audit) the accommodation's calendar " +
        'connection for the given provider. Previously-synced occupancy rows are left in place. ' +
        'Requires ACCOMMODATION_OCCUPANCY_MANAGE + ownership; no entitlement gate.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema,
        provider: z.enum(['google'])
    },
    responseSchema: CalendarDisconnectResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const providerToken = params.provider as string;

        const provider = PROVIDER_BY_TOKEN[providerToken];
        if (provider === undefined) {
            // The zod enum already rejects anything but 'google'; this guards a
            // future widening of the param without a matching mapping entry.
            return { disconnected: false };
        }

        await assertOccupancyManageAccess({ actor, accommodationId });

        const row = await accommodationCalendarSyncModel.deactivate({ accommodationId, provider });

        return { disconnected: row !== null };
    }
});

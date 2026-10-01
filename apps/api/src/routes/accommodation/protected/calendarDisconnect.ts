/**
 * DELETE /api/v1/protected/accommodations/:id/calendar-sync/:provider
 *
 * Owner self-service: disconnect an accommodation's external calendar
 * connection (HOS-157 Phase 2 — `google`; widened by HOS-162 Phase 3 to
 * `airbnb`/`booking`/`other`).
 *
 * Soft disconnect: sets `isActive=false` (the cron's `findAllActiveByProvider`
 * stops picking the row up) but keeps the row for audit. Since HOS-1377 it
 * also asks the provider to revoke the credential (Google: the OAuth grant is
 * closed; iCal feeds have no revocation API, so the web panel asks the host to
 * rotate the export link). A revocation failure never fails the disconnect: it
 * is logged and stamped on the row — see `disconnectCalendarConnection` in
 * `@repo/service-core`. Existing occupancy
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

import {
    AccommodationIdSchema,
    type CalendarDisconnectResponse,
    CalendarDisconnectResponseSchema,
    type CalendarProviderToken,
    CalendarProviderTokenSchema,
    OccupancySourceEnum
} from '@repo/schemas';
import { assertOccupancyManageAccess, disconnectCalendarConnection } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Maps the public `:provider` path token to the internal occupancy source. */
const PROVIDER_BY_TOKEN: Record<CalendarProviderToken, OccupancySourceEnum> = {
    google: OccupancySourceEnum.GOOGLE_CALENDAR,
    airbnb: OccupancySourceEnum.AIRBNB,
    booking: OccupancySourceEnum.BOOKING,
    other: OccupancySourceEnum.OTHER
};

/**
 * DELETE /api/v1/protected/accommodations/:id/calendar-sync/:provider
 *
 * Soft-disconnects the accommodation's calendar connection for the given
 * provider (`google`, `airbnb`, `booking`, or `other`). Requires ownership +
 * `ACCOMMODATION_OCCUPANCY_MANAGE`; no entitlement gate.
 */
export const protectedCalendarDisconnectRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/calendar-sync/{provider}',
    summary: 'Disconnect an external calendar connection (owner)',
    description:
        "Soft-disconnects (isActive=false, row kept for audit) the accommodation's calendar " +
        'connection for the given provider (google/airbnb/booking/other) and revokes the ' +
        'credential at the provider where possible (Google). A failed revocation does not ' +
        'fail the disconnect. Previously-synced ' +
        'occupancy rows are left in place. Requires ACCOMMODATION_OCCUPANCY_MANAGE + ownership; ' +
        'no entitlement gate.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema,
        provider: CalendarProviderTokenSchema
    },
    responseSchema: CalendarDisconnectResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>
    ): Promise<CalendarDisconnectResponse> => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const providerToken = params.provider as CalendarProviderToken;

        const provider = PROVIDER_BY_TOKEN[providerToken];
        if (provider === undefined) {
            // The zod enum already rejects anything outside CalendarProviderTokenSchema;
            // this guards a future widening of the param without a matching mapping entry.
            return { disconnected: false };
        }

        await assertOccupancyManageAccess({ actor, accommodationId });

        const { disconnected } = await disconnectCalendarConnection({
            accommodationId,
            provider,
            logger: apiLogger
        });

        return { disconnected };
    }
});

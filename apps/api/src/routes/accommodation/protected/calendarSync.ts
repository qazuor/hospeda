/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/sync
 *
 * Owner self-service: trigger an on-demand external-calendar → occupancy sync
 * for an accommodation (HOS-157 Phase 2 — Google Calendar; widened by
 * HOS-162 Phase 3 to also dispatch the three iCal providers). The scheduled
 * crons (`calendar-sync-google` for Google, a future iCal cron for Phase E)
 * run the same underlying sync primitives; this route lets a host force a
 * sync immediately after connecting or editing a feed.
 *
 * ## Request contract (widened, backward-compatible)
 *
 * The body now accepts an OPTIONAL `provider` field
 * (`'google' | 'airbnb' | 'booking' | 'other'`). Omitting it — including
 * sending no body at all, the pre-Phase-3 contract — defaults to `'google'`,
 * so the existing web client keeps working unchanged until Phase F adds
 * provider selection to the UI.
 *
 * Gate model: ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` inline via
 * `assertOccupancyManageAccess`; `CAN_SYNC_EXTERNAL_CALENDAR` at the route via
 * `requireEntitlement`. Neither sync service throws for operational
 * failures — each returns a discriminated result and records ERROR state —
 * so a failed sync surfaces as a 200 with `status: 'error'`, not a 5xx.
 *
 * @module routes/accommodation/protected/calendarSync
 */

import { EntitlementKey } from '@repo/billing';
import {
    AccommodationIdSchema,
    type CalendarProviderToken,
    type CalendarSyncResult,
    CalendarSyncResultSchema,
    OccupancySourceEnum,
    SyncCalendarBodySchema
} from '@repo/schemas';
import { assertOccupancyManageAccess } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { syncAccommodationCalendar } from '../../../services/google-calendar/google-calendar-sync.service';
import { syncAccommodationIcalCalendar } from '../../../services/ical-calendar/ical-calendar-sync.service';
import type { IcalProvider } from '../../../services/ical-calendar/ical-credential.repository';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Default provider when the request body omits `provider` — preserves the pre-Phase-3 contract. */
const DEFAULT_PROVIDER: CalendarProviderToken = 'google';

/** Maps every public provider token to the internal iCal occupancy source (google excluded — handled separately). */
const ICAL_PROVIDER_BY_TOKEN: Record<'airbnb' | 'booking' | 'other', IcalProvider> = {
    airbnb: OccupancySourceEnum.AIRBNB,
    booking: OccupancySourceEnum.BOOKING,
    other: OccupancySourceEnum.OTHER
};

/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/sync
 *
 * Runs one sync for the accommodation's connection of the given `provider`
 * (default `google`) and returns the result. Requires ownership +
 * `ACCOMMODATION_OCCUPANCY_MANAGE` and a live `CAN_SYNC_EXTERNAL_CALENDAR`
 * entitlement.
 */
export const protectedCalendarSyncRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/calendar-sync/sync',
    summary: 'Trigger an external calendar occupancy sync (owner)',
    description:
        'Runs one on-demand sync (Google Calendar OAuth or an Airbnb/Booking/generic iCal feed, ' +
        'selected via the optional `provider` body field, default `google`) for the ' +
        "accommodation's connection. Requires ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a " +
        'live CAN_SYNC_EXTERNAL_CALENDAR entitlement. Operational failures return status=error, ' +
        'not 5xx.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: SyncCalendarBodySchema,
    responseSchema: CalendarSyncResultSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ): Promise<CalendarSyncResult> => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const providerToken =
            (body as { provider?: CalendarProviderToken }).provider ?? DEFAULT_PROVIDER;

        await assertOccupancyManageAccess({ actor, accommodationId });

        if (providerToken === 'google') {
            return await syncAccommodationCalendar({ accommodationId });
        }

        const provider = ICAL_PROVIDER_BY_TOKEN[providerToken];
        return await syncAccommodationIcalCalendar({ accommodationId, provider });
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR)]
    }
});

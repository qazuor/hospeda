/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/sync
 *
 * Owner self-service: trigger an on-demand Google Calendar → occupancy sync for
 * an accommodation (HOS-157 Phase 2 — Layer 4). The scheduled cron
 * (`calendar-sync-google`, every 6h) runs the same `syncAccommodationCalendar`
 * primitive; this route lets a host force a sync immediately after connecting
 * or editing their calendar.
 *
 * Gate model: ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` inline via
 * `assertOccupancyManageAccess`; `CAN_SYNC_EXTERNAL_CALENDAR` at the route via
 * `requireEntitlement`. The sync itself never throws for operational failures —
 * it returns a discriminated result and records ERROR state — so a failed sync
 * surfaces as a 200 with `status: 'error'`, not a 5xx.
 *
 * @module routes/accommodation/protected/calendarSync
 */

import { EntitlementKey } from '@repo/billing';
import { AccommodationIdSchema } from '@repo/schemas';
import { assertOccupancyManageAccess } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { syncAccommodationCalendar } from '../../../services/google-calendar/google-calendar-sync.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * Response schema for the sync result — a discriminated union mirroring the
 * service's `CalendarSyncResult`.
 */
const CalendarSyncResultSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('ok'),
        eventsProcessed: z.number(),
        datesUpserted: z.number(),
        datesRemoved: z.number(),
        fullSync: z.boolean()
    }),
    z.object({
        status: z.literal('skipped'),
        reason: z.string()
    }),
    z.object({
        status: z.literal('error'),
        kind: z.enum(['terminal', 'transient', 'api', 'unknown']),
        message: z.string()
    })
]);

/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/sync
 *
 * Runs one Google Calendar sync for the accommodation and returns the result.
 * Requires ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` and a live
 * `CAN_SYNC_EXTERNAL_CALENDAR` entitlement.
 */
export const protectedCalendarSyncRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/calendar-sync/sync',
    summary: 'Trigger a Google Calendar occupancy sync (owner)',
    description:
        'Runs one on-demand Google Calendar → occupancy sync for the accommodation. ' +
        'Requires ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a live ' +
        'CAN_SYNC_EXTERNAL_CALENDAR entitlement. Operational failures return status=error, not 5xx.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: CalendarSyncResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        await assertOccupancyManageAccess({ actor, accommodationId });

        return await syncAccommodationCalendar({ accommodationId });
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR)]
    }
});

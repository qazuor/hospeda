/**
 * GET /api/v1/protected/accommodations/:id/calendar-sync/status
 *
 * Owner self-service: read the Google Calendar connection's sync health for an
 * accommodation (HOS-157 Phase 2 — Layer 4).
 *
 * Gate model: ownership only (`assertOccupancyReadAccess`) — deliberately NO
 * `CAN_SYNC_EXTERNAL_CALENDAR` entitlement check, mirroring the manual
 * occupancy READ endpoint. A host who lost the entitlement (e.g. downgraded
 * plan) must still be able to SEE their existing connection's state (and thus
 * know to disconnect it); only starting a connect or forcing a sync is gated.
 *
 * The response is the safe {@link AccommodationCalendarSyncStatusSchema}
 * projection — every token/secret and internal audit column is stripped at the
 * schema level.
 *
 * @module routes/accommodation/protected/calendarSyncStatus
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import {
    AccommodationCalendarSyncStatusSchema,
    AccommodationIdSchema,
    OccupancySourceEnum
} from '@repo/schemas';
import { assertOccupancyReadAccess } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const CalendarSyncStatusResponseSchema = z.object({
    /** Whether an active Google Calendar connection exists for the accommodation. */
    connected: z.boolean(),
    /** The safe status projection, or null when there is no connection row. */
    status: AccommodationCalendarSyncStatusSchema.nullable()
});

/**
 * GET /api/v1/protected/accommodations/:id/calendar-sync/status
 *
 * Returns the accommodation's Google Calendar connection status (safe
 * projection, no secrets). Requires ownership only — no entitlement gate.
 */
export const protectedCalendarSyncStatusRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/calendar-sync/status',
    summary: 'Get Google Calendar sync status (owner)',
    description:
        "Returns the safe sync-status projection for the accommodation's Google Calendar " +
        'connection (provider, calendar id, last sync time/status/error, active flag). ' +
        'Requires ownership; no entitlement gate so a downgraded host can still see and clean up.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: CalendarSyncStatusResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        await assertOccupancyReadAccess({ actor, accommodationId });

        const row = await accommodationCalendarSyncModel.findByAccommodationAndProvider({
            accommodationId,
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        if (row === null) {
            return { connected: false, status: null };
        }

        return {
            connected: row.isActive,
            status: {
                provider: row.provider,
                externalCalendarId: row.externalCalendarId ?? null,
                lastSyncAt: row.lastSyncAt ?? null,
                lastSyncStatus: row.lastSyncStatus,
                lastErrorMessage: row.lastErrorMessage ?? null,
                isActive: row.isActive
            }
        };
    }
});

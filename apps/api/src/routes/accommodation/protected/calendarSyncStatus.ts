/**
 * GET /api/v1/protected/accommodations/:id/calendar-sync/status
 *
 * Owner self-service: read every external calendar connection's sync health
 * for an accommodation (HOS-157 Phase 2 — Google Calendar; widened by
 * HOS-162 Phase 3 to cover the three iCal providers too).
 *
 * Gate model: ownership only (`assertOccupancyReadAccess`) — deliberately NO
 * `CAN_SYNC_EXTERNAL_CALENDAR` entitlement check, mirroring the manual
 * occupancy READ endpoint. A host who lost the entitlement (e.g. downgraded
 * plan) must still be able to SEE their existing connections' state (and thus
 * know to disconnect them); only starting a connect or forcing a sync is
 * gated.
 *
 * ## Response shape (HOS-162 Phase 3 — BREAKING for the pre-existing web
 * consumer, expected)
 *
 * Phase 2 returned a single `{ connected, status }` object (implicitly
 * Google-only). This route now returns `{ connections: [...] }`, an ARRAY
 * with one row per provider the accommodation has EVER connected — active
 * OR soft-disconnected (same "downgraded host can still see it" rationale as
 * above), each shaped `{ provider, connected, lastSyncAt, lastSyncStatus,
 * lastErrorMessage }` (see `CalendarProviderConnectionSchema` in
 * `@repo/schemas`). A provider the host never connected is simply absent
 * from the array — the caller does not get a `connected: false` placeholder
 * row for every possible provider.
 *
 * `apps/web`'s `CalendarSyncPanel.client.tsx` was updated in this same
 * branch (Phase F) to consume the new `{ connections: [...] }` array shape —
 * it no longer destructures the old `{ connected, status }` object.
 *
 * @module routes/accommodation/protected/calendarSyncStatus
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import {
    AccommodationIdSchema,
    type CalendarSyncStatusListResponse,
    CalendarSyncStatusListResponseSchema,
    OccupancySourceEnum
} from '@repo/schemas';
import { assertOccupancyReadAccess } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Every provider a connection row can exist for, queried in parallel. */
const ALL_PROVIDERS: readonly OccupancySourceEnum[] = [
    OccupancySourceEnum.GOOGLE_CALENDAR,
    OccupancySourceEnum.AIRBNB,
    OccupancySourceEnum.BOOKING,
    OccupancySourceEnum.OTHER
];

/**
 * GET /api/v1/protected/accommodations/:id/calendar-sync/status
 *
 * Returns one connection-status row per provider the accommodation has ever
 * connected (safe projection, no secrets). Requires ownership only — no
 * entitlement gate.
 */
export const protectedCalendarSyncStatusRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/calendar-sync/status',
    summary: 'Get external calendar sync status for every connected provider (owner)',
    description:
        'Returns one safe sync-status row per provider the accommodation has EVER connected ' +
        '(Google Calendar OAuth or an Airbnb/Booking/generic iCal feed), active or ' +
        'soft-disconnected. Requires ownership; no entitlement gate so a downgraded host can ' +
        'still see and clean up.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: CalendarSyncStatusListResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>
    ): Promise<CalendarSyncStatusListResponse> => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        await assertOccupancyReadAccess({ actor, accommodationId });

        const rows = await Promise.all(
            ALL_PROVIDERS.map((provider) =>
                accommodationCalendarSyncModel.findByAccommodationAndProvider({
                    accommodationId,
                    provider
                })
            )
        );

        const connections = rows
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .map((row) => ({
                provider: row.provider,
                connected: row.isActive,
                lastSyncAt: row.lastSyncAt ?? null,
                lastSyncStatus: row.lastSyncStatus,
                lastErrorMessage: row.lastErrorMessage ?? null
            }));

        return { connections };
    }
});

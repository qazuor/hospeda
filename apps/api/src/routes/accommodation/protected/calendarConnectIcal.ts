/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/connect-ical
 *
 * Owner self-service: connect an Airbnb/Booking.com/generic iCal feed to an
 * accommodation's occupancy calendar (HOS-162 Phase 3 — Layer D). Unlike
 * Google Calendar there is no OAuth handshake — the host pastes their
 * platform's `.ics` export URL and this single endpoint validates + persists
 * it, playing the combined role `calendarConnectGoogle.ts` + the OAuth
 * callback play together for Google.
 *
 * Gate model (mirrors `calendarConnectGoogle.ts`): ownership +
 * `ACCOMMODATION_OCCUPANCY_MANAGE` are enforced inline via
 * `assertOccupancyManageAccess`; the `CAN_SYNC_EXTERNAL_CALENDAR` billing
 * entitlement is enforced HERE at the route via `requireEntitlement`, never
 * re-checked in a service resolver.
 *
 * ## Probe-before-save
 *
 * The feed URL is fetched and parsed live (`fetchAndParseIcsFeed`, Phase B)
 * BEFORE anything is persisted. A host who pastes a broken/wrong URL gets an
 * immediate, actionable 400 instead of a silently-dead connection that only
 * surfaces as an error on the next cron run. On success, the probe's parsed
 * rows are discarded (not written here) — `saveIcalConnection` persists only
 * the credential. See `docs/billing/endpoint-gate-matrix.md` for the gate row.
 *
 * ## Immediate first sync on connect (HOS-162 judgment-day Fix #5)
 *
 * Unlike Google's OAuth callback (which defers the first reconcile to the
 * cron/manual-sync path), this route triggers a real
 * {@link syncAccommodationIcalCalendar} run immediately after
 * `saveIcalConnection` succeeds, so the host sees their occupancy populated
 * right away instead of waiting up to 6h for the next cron pass. This is
 * awaited so the response can reflect the fresh `lastSyncAt`/
 * `lastSyncStatus` — but a failure of the sync itself (network hiccup, feed
 * became unreadable between the probe and now) must NEVER fail the connect
 * response: the connection is already validly saved, and the sync service's
 * own ERROR state + host notification (`ical-calendar-sync.service.ts`)
 * handle a failed first sync exactly like any later cron failure. Any
 * unexpected throw from the sync call itself (not its own typed error
 * result — that never throws) is caught and logged, never propagated.
 *
 * @module routes/accommodation/protected/calendarConnectIcal
 */

import { EntitlementKey } from '@repo/billing';
import { accommodationCalendarSyncModel } from '@repo/db';
import {
    AccommodationIdSchema,
    type CalendarConnectionResponse,
    CalendarConnectionResponseSchema,
    ConnectIcalBodySchema,
    OccupancySourceEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { assertOccupancyManageAccess, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getTodayInMarketTimezone } from '../../../services/calendar-sync/date-range';
import { syncAccommodationIcalCalendar } from '../../../services/ical-calendar/ical-calendar-sync.service';
import type { IcalProvider } from '../../../services/ical-calendar/ical-credential.repository';
import { saveIcalConnection } from '../../../services/ical-calendar/ical-credential.repository';
import { fetchAndParseIcsFeed } from '../../../services/ical-calendar/ical-parser';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Maps the public `provider` body token to the internal iCal occupancy source. */
const ICAL_PROVIDER_BY_TOKEN: Record<'airbnb' | 'booking' | 'other', IcalProvider> = {
    airbnb: OccupancySourceEnum.AIRBNB,
    booking: OccupancySourceEnum.BOOKING,
    other: OccupancySourceEnum.OTHER
};

/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/connect-ical
 *
 * Validates the feed is readable, then persists the connection. Requires
 * ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` and a live
 * `CAN_SYNC_EXTERNAL_CALENDAR` entitlement.
 */
export const protectedCalendarConnectIcalRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/calendar-sync/connect-ical',
    summary: 'Connect an Airbnb/Booking/generic iCal feed (owner)',
    description:
        'Validates the supplied .ics feed URL by fetching and parsing it live, persists the ' +
        'connection, and triggers an immediate first sync so occupancy appears right away. A ' +
        'failed first sync is swallowed (the connection stays saved and the 6-hourly cron retries). ' +
        'Requires ACCOMMODATION_OCCUPANCY_MANAGE, ownership, and a live CAN_SYNC_EXTERNAL_CALENDAR entitlement.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: ConnectIcalBodySchema,
    responseSchema: CalendarConnectionResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ): Promise<CalendarConnectionResponse> => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const { provider: providerToken, feedUrl } = body as {
            provider: 'airbnb' | 'booking' | 'other';
            feedUrl: string;
        };

        // Ownership + MANAGE (throws ServiceError NOT_FOUND / FORBIDDEN).
        await assertOccupancyManageAccess({ actor, accommodationId });

        const provider = ICAL_PROVIDER_BY_TOKEN[providerToken];

        // Probe BEFORE persisting: an unreadable feed never gets saved.
        const fromDate = getTodayInMarketTimezone();
        const probeResult = await fetchAndParseIcsFeed({ feedUrl, fromDate });
        if (!probeResult.ok) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'We could not read that calendar feed. Double-check the URL and try again.',
                { kind: probeResult.kind }
            );
        }

        await saveIcalConnection({
            accommodationId,
            provider,
            feedUrl,
            createdById: actor.id
        });

        // Immediate first sync (Fix #5): failure here never fails the
        // connect response — the connection is already saved, and the sync
        // service's own ERROR state + host notification handle it.
        try {
            await syncAccommodationIcalCalendar({ accommodationId, provider });
        } catch (error) {
            apiLogger.warn(
                {
                    accommodationId,
                    provider,
                    error: error instanceof Error ? error.message : String(error)
                },
                'calendarConnectIcal: immediate first sync threw unexpectedly (connection still saved)'
            );
        }

        // Re-read after the sync so the response reflects the fresh
        // lastSyncAt / lastSyncStatus, not the just-upserted PENDING row.
        const row = await accommodationCalendarSyncModel.findByAccommodationAndProvider({
            accommodationId,
            provider
        });

        if (row === null) {
            // Defensive — saveIcalConnection just upserted this row.
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
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR)]
    }
});

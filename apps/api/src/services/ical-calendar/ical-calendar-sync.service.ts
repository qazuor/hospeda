/**
 * iCal feed occupancy sync service (HOS-162 Phase 3 — Layer C).
 *
 * Orchestrates one sync run for a single accommodation's iCal feed
 * connection, PARAMETERIZED by `provider` (`AIRBNB` / `BOOKING` / `OTHER`) so
 * one service handles all three iCal-backed sources instead of duplicating
 * this module three times. Mirrors `google-calendar-sync.service.ts`'s
 * declarative full-window reconcile shape (see that module's doc for the
 * full "why declarative" rationale — it applies identically here): fetch the
 * feed, compute the desired blocked-date set, atomically REPLACE all future
 * `source = <provider>` occupancy rows with it, never touching `MANUAL` or
 * another provider's rows.
 *
 * Unlike Google, there is no token refresh step and no pagination — a single
 * `fetchAndParseIcsFeed` call (Phase B, already committed) does the fetch +
 * parse + half-open-range date derivation in one step and returns the final
 * row set directly. This service's job is thin: read the credential, call
 * the parser, reconcile, and persist sync state.
 *
 * ## Failure handling
 *
 * This service never throws for operational failures — it records the
 * outcome on the connection's sync-state columns (`lastSyncStatus` OK/ERROR,
 * `lastErrorMessage`, `lastSyncAt`) and returns a discriminated
 * {@link IcalCalendarSyncResult}, exactly like the Google sync service.
 *
 * ## Host notification on a broken/expired feed (spec §14.4)
 *
 * The HOS-162 spec calls for notifying the HOST when their feed becomes
 * unreadable (fetch error, unparseable, or an empty/non-calendar response) —
 * while the feed stays broken, dates that are actually booked on the
 * external platform may keep showing as available on Hospeda, risking a
 * double booking. {@link notifyHostOfBrokenFeed} sends
 * `NotificationType.ACCOMMODATION_CALENDAR_FEED_BROKEN` (a dedicated
 * host-facing, TRANSACTIONAL template — see
 * `packages/notifications/src/templates/calendar-sync/accommodation-calendar-feed-broken.tsx`)
 * to the host who connected the feed (`credential.createdById`), with a CTA
 * linking back to that accommodation's calendar-sync panel in the host
 * editor so they can reconnect it.
 *
 * The recipient's email/display name and the accommodation's display name
 * are not carried on the credential, so this resolves them via `userModel`
 * and `accommodationModel` first. This is still fire-and-forget and NEVER
 * blocks or masks the sync's own ERROR result — the resolution + send runs
 * inside an un-awaited async IIFE, and any failure anywhere in that chain
 * (lookup or send) is caught and logged via `apiLogger.warn`, exactly like
 * the AI provider model-sync's fail-open `syncAiProviderModels` swallow
 * pattern. Raw fetch/parse error detail (`kind`/`message`) is deliberately
 * NOT included in the host-facing email — it stays in the connection's
 * `lastErrorMessage` column and operational logs, not the host's inbox.
 *
 * @module services/ical-calendar/ical-calendar-sync.service
 */

import {
    accommodationCalendarSyncModel,
    accommodationModel,
    accommodationOccupancyModel,
    userModel
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { CalendarSyncStatusEnum, OccupancySourceEnum } from '@repo/schemas';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { sendNotification } from '../../utils/notification-helper.js';
import { getTodayInMarketTimezone } from '../calendar-sync/date-range.js';
import { getIcalCredential, type IcalProvider } from './ical-credential.repository.js';
import { fetchAndParseIcsFeed, type IcalParseFailure } from './ical-parser.js';

/**
 * Human-readable label for each {@link IcalProvider}, used in the host-facing
 * broken-feed notification's subject and body.
 */
const ICAL_PROVIDER_LABELS: Record<IcalProvider, string> = {
    [OccupancySourceEnum.AIRBNB]: 'Airbnb',
    [OccupancySourceEnum.BOOKING]: 'Booking.com',
    [OccupancySourceEnum.OTHER]: 'tu calendario externo'
};

/**
 * Outcome of a single {@link syncAccommodationIcalCalendar} run.
 */
export type IcalCalendarSyncResult =
    | {
          readonly status: 'ok';
          /** Number of future rows removed by the reconcile (replaced set). */
          readonly removed: number;
          /** Number of occupancy rows inserted this run. */
          readonly inserted: number;
      }
    | {
          readonly status: 'skipped';
          /** Why the run was skipped (no connection / inactive). */
          readonly reason: 'no-connection' | 'inactive';
      }
    | {
          readonly status: 'error';
          /** Classifies the failure for the caller — mirrors {@link IcalParseFailure.kind}, plus `unknown` for a DB/reconcile failure. */
          readonly kind: IcalParseFailure['kind'] | 'unknown';
          /** Human-readable failure detail (also stored on the connection). */
          readonly message: string;
      };

/**
 * Builds the deep link back to an accommodation's calendar-sync panel in the
 * host editor (`apps/web`), used as the CTA in the broken-feed notification.
 *
 * The panel itself (`CalendarSyncPanel.client.tsx`) is mounted inside the
 * accommodation editor page at `/{locale}/mi-cuenta/propiedades/{id}/editar`
 * — there is no dedicated anchor/tab for the sync panel specifically, so the
 * link lands on the editor page as a whole (the host scrolls to the calendar
 * section, same as reaching it organically).
 *
 * @param accommodationId - The accommodation whose editor page to link to.
 * @returns The full reconnect URL.
 */
function buildReconnectUrl(accommodationId: string): string {
    const siteUrl = env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar';
    return `${siteUrl}/es/mi-cuenta/propiedades/${accommodationId}/editar`;
}

/**
 * Notifies the host who connected a broken/expired iCal feed, as
 * fire-and-forget background work. See the module doc's "Host notification"
 * section.
 *
 * Resolves the host's email/display name (`userModel`) and the
 * accommodation's display name (`accommodationModel`) before sending, since
 * neither is carried on the decrypted {@link IcalCredential}. This function
 * is synchronous and never throws: the resolution + send runs inside an
 * un-awaited async IIFE, and any failure anywhere in that chain (a lookup
 * failure, a host with no email on file, or the send itself failing) is
 * caught and logged via `apiLogger.warn`. A notification failure can never
 * replace or mask the sync's own `error` result, which is already computed
 * and persisted before this is called.
 *
 * @param params.accommodationId - The accommodation whose feed failed.
 * @param params.provider - The iCal provider (`AIRBNB` / `BOOKING` / `OTHER`).
 * @param params.hostUserId - The host who connected this feed (the recipient).
 * @param params.kind - The parse/fetch failure classification (logging only — never sent to the host).
 * @param params.message - Human-readable failure detail (logging only — never sent to the host).
 */
function notifyHostOfBrokenFeed(params: {
    readonly accommodationId: string;
    readonly provider: IcalProvider;
    readonly hostUserId: string;
    readonly kind: IcalParseFailure['kind'];
    readonly message: string;
}): void {
    const { accommodationId, provider, hostUserId, kind, message } = params;

    void (async () => {
        const [host, accommodation] = await Promise.all([
            userModel.findById(hostUserId),
            accommodationModel.findById(accommodationId)
        ]);

        if (!host?.email) {
            apiLogger.warn(
                { accommodationId, provider, hostUserId },
                'ical-calendar-sync: cannot notify host of broken feed — no host email on file'
            );
            return;
        }

        const accommodationName = accommodation?.name ?? accommodation?.slug ?? 'tu alojamiento';

        await sendNotification({
            type: NotificationType.ACCOMMODATION_CALENDAR_FEED_BROKEN,
            recipientEmail: host.email,
            recipientName: host.displayName ?? host.firstName ?? host.email,
            userId: hostUserId,
            accommodationName,
            providerLabel: ICAL_PROVIDER_LABELS[provider],
            reconnectUrl: buildReconnectUrl(accommodationId)
        });
    })().catch((notificationError: unknown) => {
        apiLogger.warn(
            {
                accommodationId,
                provider,
                kind,
                message,
                error:
                    notificationError instanceof Error
                        ? notificationError.message
                        : String(notificationError)
            },
            'ical-calendar-sync: failed to send broken-feed host notification (non-fatal)'
        );
    });
}

/**
 * Records a failed sync on the connection's sync-state columns and returns
 * the matching error result. Never throws.
 *
 * @param accommodationId - The accommodation whose sync failed.
 * @param provider - The iCal provider.
 * @param kind - Failure classification for the caller.
 * @param message - Human-readable failure detail.
 * @returns The `error` {@link IcalCalendarSyncResult}.
 */
const recordFailure = async (
    accommodationId: string,
    provider: IcalProvider,
    kind: IcalParseFailure['kind'] | 'unknown',
    message: string
): Promise<IcalCalendarSyncResult> => {
    try {
        await accommodationCalendarSyncModel.updateSyncState({
            accommodationId,
            provider,
            lastSyncAt: new Date(),
            lastSyncStatus: CalendarSyncStatusEnum.ERROR,
            lastErrorMessage: message
        });
    } catch (persistError) {
        apiLogger.error(
            {
                accommodationId,
                provider,
                error: persistError instanceof Error ? persistError.message : String(persistError)
            },
            'ical-calendar-sync: failed to persist ERROR sync state'
        );
    }
    return { status: 'error', kind, message };
};

/**
 * Runs one iCal feed → occupancy sync for a single accommodation + provider,
 * as a declarative full-window reconcile (see module doc).
 *
 * @param params.accommodationId - The accommodation whose connection to sync.
 * @param params.provider - The iCal provider to sync (`AIRBNB` / `BOOKING` / `OTHER`).
 * @returns A discriminated {@link IcalCalendarSyncResult}. Never throws for
 * operational failures — the outcome is also persisted on the connection.
 *
 * @example
 * ```ts
 * const result = await syncAccommodationIcalCalendar({ accommodationId, provider: OccupancySourceEnum.AIRBNB });
 * if (result.status === 'error') { // host may need to fix/reconnect the feed
 * }
 * ```
 */
export const syncAccommodationIcalCalendar = async (params: {
    readonly accommodationId: string;
    readonly provider: IcalProvider;
}): Promise<IcalCalendarSyncResult> => {
    const { accommodationId, provider } = params;

    const credential = await getIcalCredential({ accommodationId, provider });
    if (credential === null) {
        return { status: 'skipped', reason: 'no-connection' };
    }
    if (!credential.isActive) {
        return { status: 'skipped', reason: 'inactive' };
    }

    // Same "today in the AR market zone" anchor Google Calendar sync uses —
    // see `getTodayInMarketTimezone`'s doc for why UTC would be wrong here.
    const fromDate = getTodayInMarketTimezone();

    const parseResult = await fetchAndParseIcsFeed({ feedUrl: credential.feedUrl, fromDate });

    if (!parseResult.ok) {
        const failure = await recordFailure(
            accommodationId,
            provider,
            parseResult.kind,
            parseResult.message
        );
        notifyHostOfBrokenFeed({
            accommodationId,
            provider,
            hostUserId: credential.createdById,
            kind: parseResult.kind,
            message: parseResult.message
        });
        return failure;
    }

    let removed: number;
    let inserted: number;
    try {
        ({ removed, inserted } = await accommodationOccupancyModel.replaceFutureSyncOccupancy({
            accommodationId,
            source: provider,
            fromDate,
            rows: parseResult.rows,
            createdById: credential.createdById
        }));
    } catch (error) {
        return recordFailure(
            accommodationId,
            provider,
            'unknown',
            error instanceof Error ? error.message : String(error)
        );
    }

    await accommodationCalendarSyncModel.updateSyncState({
        accommodationId,
        provider,
        lastSyncAt: new Date(),
        lastSyncStatus: CalendarSyncStatusEnum.OK,
        lastErrorMessage: null
    });

    return { status: 'ok', removed, inserted };
};

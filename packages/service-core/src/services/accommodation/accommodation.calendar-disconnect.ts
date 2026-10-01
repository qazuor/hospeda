/**
 * @file accommodation.calendar-disconnect.ts
 * @description Host-initiated disconnect of one external calendar connection,
 * with the provider-side grant closed as part of it (HOS-1377).
 *
 * ## Why disconnect revokes
 *
 * Before HOS-1377 a disconnect only flipped `is_active = false`. That stops US
 * from using the credential, but the grant stays alive at the provider: for
 * Google the refresh token kept working and the app stayed listed under the
 * host's "Third-party apps with account access", indefinitely. HOS-663 closed
 * that on accommodation delete; this closes it on the far more common path,
 * the host who disconnects and never deletes the listing.
 *
 * Revoking does not change the reconnect UX: the Google connect route already
 * sends `prompt=consent` on every connect, so reconnecting always shows the
 * consent screen, revoked or not.
 *
 * ## Deactivate first, revoke second, and the disconnect never fails on the revoke
 *
 * The local deactivation is the part the host asked for and the part we fully
 * control, so it happens first and alone decides the response. The revocation
 * is an outbound HTTP call to a third party; a network error or an
 * already-revoked token must not turn a done disconnect into a 500. It goes
 * through the same port and the same defensive wrapper the HOS-663 cascade
 * uses ({@link askPortToRevoke}), so a malformed or throwing adapter becomes a
 * recorded failure, not an exception.
 *
 * ## A failure is recorded, never swallowed
 *
 * A revocation that fails silently leaves everyone believing the access was
 * closed. So a failed revocation of a provider that HAS a revocation endpoint
 * is logged at ERROR (which the API persists into `app_log_entries`) and
 * stamped on the now-inactive row with {@link REVOCATION_FAILURE_PREFIX} — the
 * same greppable marker HOS-663 uses, so "which grants are still live?" stays
 * one query. The row is inactive, so the stamp is not rendered to the host, and
 * a reconnect's `upsertConnection` clears it.
 *
 * ## iCal feeds are not failures
 *
 * Airbnb / Booking / "other" are iCal feeds whose credential is a secret export
 * URL with no invalidation API; the adapter answers `revoked: false` for them
 * by design. On disconnect that is the expected outcome, not an incident: the
 * web panel tells the host to regenerate the export link in the provider's
 * dashboard. Stamping every iCal disconnect as `ERROR` would bury the real
 * failures, so those providers are logged at INFO and not stamped. The set is
 * an explicit allow-list: any provider NOT in it (Google, or a future OAuth
 * provider) that fails to revoke is stamped — this fails closed.
 *
 * ## Known limitation (shared with HOS-663)
 *
 * Credentials are stored per accommodation, but if a host connects the SAME
 * Google account to two accommodations, both connections belong to one Google
 * grant, and revoking it may also cut the other accommodation's sync (it would
 * then surface the existing "reconnect" prompt). No Google account identity is
 * stored today, so this cannot be detected; accepted for now.
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import { OccupancySourceEnum } from '@repo/schemas';
import type { ServiceLogger } from '../../utils/service-logger';
import {
    getCalendarConnectionRevocationPort,
    REVOCATION_FAILURE_PREFIX
} from './accommodation.calendar-cascade';
import { askPortToRevoke } from './accommodation.calendar-revocation-call';

/**
 * Providers whose credential is an iCal export URL with no revocation API.
 * A `revoked: false` from these is expected on disconnect, not a failure.
 */
const ICAL_FEED_PROVIDERS: ReadonlySet<OccupancySourceEnum> = new Set([
    OccupancySourceEnum.AIRBNB,
    OccupancySourceEnum.BOOKING,
    OccupancySourceEnum.OTHER
]);

/**
 * What happened at the provider:
 * - `revoked` — the provider confirmed the grant is closed.
 * - `not-revocable` — an iCal feed; only the host can rotate the link.
 * - `failed` — the grant may still be live; logged and stamped on the row.
 * - `skipped` — there was no connection to disconnect.
 */
export type CalendarDisconnectRevocationOutcome =
    | 'revoked'
    | 'not-revocable'
    | 'failed'
    | 'skipped';

/** Input for {@link disconnectCalendarConnection}. */
export interface DisconnectCalendarConnectionInput {
    /** The accommodation whose connection to disconnect. */
    readonly accommodationId: string;
    /** The provider of the connection. */
    readonly provider: OccupancySourceEnum;
    /** Logger for the revocation outcome. */
    readonly logger: ServiceLogger;
}

/** Result of {@link disconnectCalendarConnection}. */
export interface DisconnectCalendarConnectionResult {
    /** Whether a connection row existed and is now inactive. */
    readonly disconnected: boolean;
    /** What happened at the provider — see {@link CalendarDisconnectRevocationOutcome}. */
    readonly revocation: CalendarDisconnectRevocationOutcome;
}

/**
 * Deactivates one calendar connection and asks the provider to revoke its
 * credential.
 *
 * The deactivation alone decides `disconnected`; a revocation failure never
 * throws and never flips it — it is logged and recorded on the row instead.
 * A failure of the deactivation write itself DOES propagate (as before
 * HOS-1377), because then nothing was disconnected.
 *
 * @param input - Accommodation id, provider and logger — see {@link DisconnectCalendarConnectionInput}.
 * @returns Whether it disconnected and what happened at the provider.
 *
 * @example
 * ```ts
 * const { disconnected } = await disconnectCalendarConnection({
 *     accommodationId,
 *     provider: OccupancySourceEnum.GOOGLE_CALENDAR,
 *     logger: apiLogger
 * });
 * ```
 */
export async function disconnectCalendarConnection(
    input: DisconnectCalendarConnectionInput
): Promise<DisconnectCalendarConnectionResult> {
    const { accommodationId, provider, logger } = input;

    const row = await accommodationCalendarSyncModel.deactivate({ accommodationId, provider });
    if (row === null) {
        return { disconnected: false, revocation: 'skipped' };
    }

    const outcome = await askPortToRevoke({
        port: getCalendarConnectionRevocationPort(),
        accommodationId,
        provider
    });

    if (outcome.revoked) {
        logger.info(
            { accommodationId, provider },
            '[calendar-disconnect] Revoked calendar credential on host disconnect'
        );
        return { disconnected: true, revocation: 'revoked' };
    }

    if (ICAL_FEED_PROVIDERS.has(provider)) {
        logger.info(
            { accommodationId, provider, reason: outcome.reason },
            '[calendar-disconnect] iCal feed disconnected; the export URL cannot be revoked by us, the host is asked to rotate it'
        );
        return { disconnected: true, revocation: 'not-revocable' };
    }

    logger.error(
        { accommodationId, provider, reason: outcome.reason },
        `[calendar-disconnect] ${REVOCATION_FAILURE_PREFIX}: the connection is disconnected but its credential may still be valid at the provider`
    );

    try {
        const stamped = await accommodationCalendarSyncModel.markRevocationFailed({
            accommodationId,
            provider,
            errorMessage: `${REVOCATION_FAILURE_PREFIX}: ${outcome.reason}`
        });
        if (stamped === null) {
            logger.error(
                { accommodationId, provider },
                `[calendar-disconnect] ${REVOCATION_FAILURE_PREFIX}: the connection row disappeared before the failure could be stamped on it`
            );
        }
    } catch (error) {
        logger.error(
            { error, accommodationId, provider },
            '[calendar-disconnect] Could not record the revocation failure on the connection row'
        );
    }

    return { disconnected: true, revocation: 'failed' };
}

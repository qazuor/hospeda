/**
 * Provider-side revocation of a calendar connection (HOS-663).
 *
 * `@repo/service-core` runs the delete-time cascade but cannot close a grant on
 * its own: doing so needs the OAuth vault and the provider HTTP clients, both
 * of which live here. So it declares a port and this module implements it; the
 * API registers the implementation once at startup.
 *
 * ## The two providers answer differently, and that difference is the point
 *
 * - **Google Calendar** is a real OAuth grant with a real revocation endpoint.
 *   The stored refresh token is handed to `https://oauth2.googleapis.com/revoke`
 *   and the grant is gone — including from the host's "Third-party apps with
 *   account access" list. This is a genuine revocation.
 *
 * - **Airbnb / Booking / "other"** are iCal feeds. The stored credential is the
 *   secret `.ics` URL itself: a bearer capability minted by the provider, with
 *   NO API to invalidate it. Only the host can rotate that link, from the
 *   provider's own dashboard. There is nothing this code can call, so it says
 *   so — `{ revoked: false, reason }` — rather than returning success for an
 *   act it did not perform. The cascade then records that on the connection row
 *   under a greppable prefix, which is what keeps "which credentials are still
 *   live?" answerable in SQL instead of being a comfortable assumption.
 *
 *   That is a deliberate, documented limit, not an oversight: closing an iCal
 *   feed for real requires asking the host to regenerate their export link, and
 *   whether (and how) to ask them is a product decision, not this adapter's.
 *
 * ## Unknown providers fail CLOSED
 *
 * `MANUAL` is an explicit case answering `{ revoked: true }` — hand-blocked
 * dates have no connection row and no credential. Everything the switch does
 * NOT recognise answers `{ revoked: false }` instead.
 *
 * The asymmetry is the design. `default` used to be the `revoked: true` branch,
 * which made this a gate by exclusion: it enumerated what to handle and waved
 * the rest through. Add `VRBO` or `EXPEDIA` to `OccupancySourceEnum` — real
 * OAuth providers with real grants — and it would have reported a closed grant
 * without calling anybody, the cascade would have counted it in `revoked`,
 * nothing would have been stamped, and the log line would have read "Revoked
 * calendar credential". An unrecognised provider is an unclosed grant until
 * somebody teaches this switch otherwise.
 *
 * @module services/calendar-sync/calendar-connection-revocation.adapter
 */

import { OccupancySourceEnum } from '@repo/schemas';
import type {
    CalendarConnectionRevocationPort,
    CalendarConnectionRevocationResult
} from '@repo/service-core';
import { getGoogleCredential } from '../google-calendar/google-calendar-credential.repository.js';
import { GoogleOAuthClientError, revokeToken } from '../google-calendar/google-oauth-client.js';

/**
 * Google's answer when the token is already unknown to it. Not a failure: a
 * grant that does not exist cannot be used, which is the outcome asked for.
 */
const ALREADY_INVALID_ERROR = 'invalid_token';

/**
 * Revokes the Google OAuth grant behind one accommodation's calendar
 * connection.
 *
 * Revokes the REFRESH token when there is one. Revoking a refresh token
 * invalidates every access token derived from it; revoking an access token
 * alone would leave the refresh token free to mint new ones, which is exactly
 * the access this issue is about closing.
 *
 * @param accommodationId - The accommodation whose Google connection to revoke.
 * @returns Whether the grant is now closed, and why not when it is not.
 */
async function revokeGoogleConnection(
    accommodationId: string
): Promise<CalendarConnectionRevocationResult> {
    let credential: Awaited<ReturnType<typeof getGoogleCredential>>;
    try {
        credential = await getGoogleCredential({ accommodationId });
    } catch (error) {
        return {
            revoked: false,
            reason: `could not read the stored credential: ${error instanceof Error ? error.message : String(error)}`
        };
    }

    if (credential === null) {
        // Nothing stored, so nothing of ours can reach the host's calendar.
        return { revoked: true };
    }

    const token = credential.refreshToken ?? credential.accessToken;

    try {
        await revokeToken({ token });
        return { revoked: true };
    } catch (error) {
        if (
            error instanceof GoogleOAuthClientError &&
            error.body?.error === ALREADY_INVALID_ERROR
        ) {
            return { revoked: true };
        }
        const detail =
            error instanceof GoogleOAuthClientError
                ? `google responded ${error.status}`
                : error instanceof Error
                  ? error.message
                  : String(error);
        return { revoked: false, reason: `google revocation failed (${detail})` };
    }
}

/**
 * The adapter registered into `@repo/service-core` at API startup.
 *
 * Never throws: every path returns a {@link CalendarConnectionRevocationResult}
 * so the cascade can record the outcome rather than lose it to an exception.
 *
 * @example
 * ```ts
 * setCalendarConnectionRevocationPort(calendarConnectionRevocationAdapter);
 * ```
 */
export const calendarConnectionRevocationAdapter: CalendarConnectionRevocationPort = {
    async revoke({ accommodationId, provider }) {
        switch (provider) {
            case OccupancySourceEnum.GOOGLE_CALENDAR:
                return revokeGoogleConnection(accommodationId);

            case OccupancySourceEnum.AIRBNB:
            case OccupancySourceEnum.BOOKING:
            case OccupancySourceEnum.OTHER:
                return {
                    revoked: false,
                    reason: `${provider} is an iCal feed: the credential is a secret export URL the provider exposes no API to invalidate, so only the host can rotate it`
                };

            case OccupancySourceEnum.MANUAL:
                // The host blocked those dates by hand. No connection row, no
                // credential, nothing anybody ever granted us.
                return { revoked: true };

            default:
                // FAILS CLOSED — and the asymmetry with `MANUAL` above is the
                // point, not an inconsistency.
                //
                // This used to be the `revoked: true` branch, which made the
                // switch a gate by exclusion: it enumerated what to handle and
                // waved through everything else. The day somebody adds `VRBO`
                // or `EXPEDIA` to `OccupancySourceEnum` — real OAuth providers
                // with real grants — that shape would report a successful
                // revocation without calling anyone, the cascade would count it
                // in `revoked`, nothing would be stamped, and the log line would
                // read "Revoked calendar credential". That is exactly the
                // comfortable lie this feature exists to refuse, arriving
                // through the door left open for it.
                //
                // An unrecognised provider is an UNCLOSED grant until somebody
                // teaches this switch otherwise.
                return {
                    revoked: false,
                    reason: `unknown provider '${provider}': no revocation path is implemented for it`
                };
        }
    }
};

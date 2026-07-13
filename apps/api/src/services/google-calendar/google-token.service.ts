/**
 * Google Calendar OAuth token service (HOS-157 Phase 2 — Layer 2).
 *
 * Exposes {@link getValidGoogleToken}, the single entry point callers (the
 * sync service, the manual-sync route) use to obtain a usable Google Calendar
 * access token for an accommodation. It reads the stored, decrypted credential
 * via {@link getGoogleCredential} and decides, based on how close the token is
 * to expiry, whether the cached `accessToken` can be returned as-is or whether
 * it must be refreshed first.
 *
 * ## Refresh path
 *
 * When the cached token is within the near-expiry margin (see
 * {@link needsRefresh}), {@link handleNearExpiryToken} exchanges the stored
 * refresh token for a new access token via {@link refreshAccessToken},
 * persists it via {@link saveRefreshedGoogleTokens}, and returns the new access
 * token. Because Google's refresh grant does NOT return a new refresh token
 * (see `google-oauth-client.ts`), the stored refresh token is preserved across
 * refreshes; only when Google unexpectedly issues a rotated one is it
 * persisted. Failures are classified via {@link classifyGoogleRefreshFailure}
 * into a typed `GoogleTokenRefreshError` (`terminal` vs `transient`) before
 * being rethrown; no partial/corrupt persistence happens on failure.
 *
 * Unlike the MercadoLibre token service, a terminal failure here is scoped to a
 * single host's connection, so NO admin alert is fired — the caller records the
 * error on that connection's sync state (marking it `ERROR`) so the host UI can
 * prompt a reconnect.
 *
 * ## Concurrency — per-accommodation single-flight, single-process scope only
 *
 * Two overlapping callers for the SAME accommodation must not both start a
 * refresh (redundant HTTP calls, and a redundant write race). This module
 * guards against that with a per-accommodation single-flight map
 * ({@link inFlightRefresh}): the first caller to reach the near-expiry branch
 * for a given accommodation starts the refresh and stores its promise keyed by
 * `accommodationId`; any caller that arrives for the same accommodation while
 * that promise is pending awaits and returns the SAME promise. Refreshes for
 * DIFFERENT accommodations proceed independently (the cron syncs many
 * accommodations in a tick). Once an in-flight refresh settles, its map entry
 * is cleared.
 *
 * **Staggered callers**: a caller that arrives after a prior refresh cycle for
 * the same accommodation already completed re-reads the credential fresh inside
 * its own critical section before deciding to refresh, rather than trusting a
 * potentially-stale value from its own earlier read.
 *
 * **Scope limitation**: this map is a module-level JS variable — it only
 * protects concurrent calls within a single Node.js process/instance. It gives
 * NO protection against two separate API instances (e.g. two replicas, or a
 * replica racing the cron worker) refreshing the same accommodation at once.
 * That broader (distributed-lock) scope is out of scope, matching the
 * MercadoLibre precedent. Google refresh tokens are not single-use, so a
 * cross-instance double refresh is merely wasteful, not corrupting.
 *
 * @module services/google-calendar/google-token.service
 */

import {
    getGoogleCredential,
    saveRefreshedGoogleTokens
} from './google-calendar-credential.repository.js';
import { refreshAccessToken } from './google-oauth-client.js';
import { classifyGoogleRefreshFailure, GoogleTokenRefreshError } from './google-token.errors.js';

/**
 * Safety margin, in milliseconds, applied before a token's reported
 * `expiresAt`. A token within this margin of expiring is treated as
 * "needs refresh" even though it has not technically expired yet, to avoid a
 * request failing mid-flight due to the token expiring between the check and
 * its use.
 */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Determines whether a Google access token with the given expiry should be
 * refreshed rather than reused as-is.
 *
 * A token is considered to need a refresh once it is within
 * {@link REFRESH_MARGIN_MS} of `expiresAt` (including the boundary itself),
 * already past it, or when the expiry is unknown (`null`).
 *
 * @param expiresAt - The token's reported expiry timestamp, or `null` if unknown.
 * @returns `true` when the token is within the refresh margin, already expired,
 * or has no known expiry; `false` when it is still comfortably valid.
 *
 * @example
 * ```ts
 * needsRefresh(new Date(Date.now() + 60 * 60 * 1000)); // false — 1h left
 * needsRefresh(new Date(Date.now() + 2 * 60 * 1000));  // true — 2min left
 * needsRefresh(null);                                  // true — unknown expiry
 * ```
 */
export function needsRefresh(expiresAt: Date | null): boolean {
    if (expiresAt === null) {
        return true;
    }
    const remainingMs = expiresAt.getTime() - Date.now();
    return remainingMs <= REFRESH_MARGIN_MS;
}

/**
 * Module-level per-accommodation single-flight guard for
 * {@link handleNearExpiryToken}. Keyed by `accommodationId`; each value is the
 * in-flight refresh promise for that accommodation. An entry is removed once
 * its promise settles.
 *
 * **Process-local only** — see the module doc's concurrency section for the
 * accepted scope limitation.
 */
const inFlightRefresh = new Map<string, Promise<string>>();

/**
 * Redeems the given refresh token for a new access token via
 * {@link refreshAccessToken} and persists it via
 * {@link saveRefreshedGoogleTokens}.
 *
 * Google's refresh grant normally omits a new refresh token, so
 * `result.refreshToken` is usually `undefined` and the stored one is preserved;
 * on the rare occasion Google rotates it, the new one is persisted.
 *
 * @param accommodationId - The accommodation whose token is being refreshed.
 * @param refreshToken - The currently-stored refresh token to redeem.
 * @returns The newly-issued access token.
 * @throws {GoogleTokenRefreshError} Classified via {@link classifyGoogleRefreshFailure}
 * when the Google token endpoint rejects the refresh. No persistence happens on
 * failure.
 */
async function performRefresh(accommodationId: string, refreshToken: string): Promise<string> {
    try {
        const result = await refreshAccessToken({ refreshToken });

        await saveRefreshedGoogleTokens({
            accommodationId,
            accessToken: result.accessToken,
            ...(result.refreshToken === undefined ? {} : { refreshToken: result.refreshToken }),
            ...(result.scope === undefined ? {} : { tokenScope: result.scope }),
            tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000)
        });

        return result.accessToken;
    } catch (error) {
        throw classifyGoogleRefreshFailure(error);
    }
}

/**
 * Handles the near-expiry / already-expired case for an accommodation's Google
 * credential: refreshes the access token and returns the new one, guarded by
 * the per-accommodation {@link inFlightRefresh} single-flight map so
 * overlapping callers for the same accommodation share one refresh.
 *
 * Re-reads the credential fresh inside its own critical section (staggered
 * caller safety) before deciding whether a real refresh is still needed.
 *
 * @param accommodationId - The accommodation to refresh.
 * @returns The valid access token — either a freshly-confirmed cached one (if
 * another caller already refreshed since the original read), a newly refreshed
 * one, or the shared result of an already-in-flight refresh.
 * @throws {GoogleTokenRefreshError} With `kind: 'terminal'` if the connection
 * was removed between the original read and this re-check, or has no stored
 * refresh token, or — see {@link performRefresh} — when the refresh itself fails.
 */
function handleNearExpiryToken(accommodationId: string): Promise<string> {
    const existing = inFlightRefresh.get(accommodationId);
    if (existing !== undefined) {
        return existing;
    }

    const refreshPromise = (async () => {
        try {
            const freshCredential = await getGoogleCredential({ accommodationId });

            if (freshCredential === null) {
                throw new GoogleTokenRefreshError(
                    'No Google Calendar connection found for this accommodation — connect the calendar first',
                    'terminal'
                );
            }

            if (!needsRefresh(freshCredential.expiresAt)) {
                return freshCredential.accessToken;
            }

            if (freshCredential.refreshToken === null) {
                throw new GoogleTokenRefreshError(
                    'Google Calendar connection has no refresh token — the host must reconnect the calendar',
                    'terminal'
                );
            }

            return await performRefresh(accommodationId, freshCredential.refreshToken);
        } finally {
            inFlightRefresh.delete(accommodationId);
        }
    })();

    inFlightRefresh.set(accommodationId, refreshPromise);
    return refreshPromise;
}

/**
 * Returns a valid Google Calendar OAuth access token for an accommodation,
 * refreshing it first if it is missing, near-expiry, or already expired.
 *
 * When no connection is configured, this throws a `terminal`
 * {@link GoogleTokenRefreshError} directing the host to connect the calendar.
 * When a connection exists and its token is still comfortably valid, the cached
 * `accessToken` is returned directly with no HTTP call. When near-expiry or
 * expired, {@link handleNearExpiryToken} redeems the stored refresh token,
 * persists the new access token, and returns it — see the module doc for the
 * per-accommodation single-flight guard.
 *
 * @param params.accommodationId - The accommodation to obtain a token for.
 * @returns A valid Google Calendar access token — cached if still valid,
 * freshly refreshed otherwise.
 * @throws {GoogleTokenRefreshError} With `kind: 'terminal'` when no connection
 * exists, the connection has no refresh token, or the refresh is classified as
 * terminal (e.g. `invalid_grant`) — all of which require the host to reconnect.
 * @throws {GoogleTokenRefreshError} With `kind: 'transient'` when the refresh
 * fails for a retryable reason (network error, Google 5xx, timeout).
 *
 * @example
 * ```ts
 * const accessToken = await getValidGoogleToken({ accommodationId });
 * // Use accessToken to call the Google Calendar API.
 * ```
 */
export async function getValidGoogleToken(params: { accommodationId: string }): Promise<string> {
    const { accommodationId } = params;

    const credential = await getGoogleCredential({ accommodationId });

    if (credential === null) {
        throw new GoogleTokenRefreshError(
            'No Google Calendar connection found for this accommodation — connect the calendar first',
            'terminal'
        );
    }

    if (!needsRefresh(credential.expiresAt)) {
        return credential.accessToken;
    }

    return handleNearExpiryToken(accommodationId);
}

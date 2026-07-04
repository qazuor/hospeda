/**
 * MercadoLibre OAuth token service — read/cache + refresh path (HOS-45 T-009,
 * admin alert HOS-45 T-010).
 *
 * Exposes {@link getValidMercadoLibreToken}, the single entry point callers
 * should use to obtain a usable MercadoLibre access token. It reads the
 * stored credential via {@link getActiveMLCredential} and decides, based on
 * how close the token is to expiry, whether the cached `accessToken` can be
 * returned as-is or whether it must be refreshed first.
 *
 * ## Refresh path
 *
 * When the cached token is within the near-expiry margin (see
 * {@link needsRefresh}), {@link handleNearExpiryToken} exchanges the stored
 * refresh token for a new access/refresh token pair via
 * {@link refreshAccessToken}, persists the ROTATED pair via
 * {@link upsertMLCredential} (MercadoLibre refresh tokens are single-use —
 * the old one is invalidated the moment it is redeemed), and returns the new
 * access token. Failures are classified via {@link classifyMLRefreshFailure}
 * into a typed `MLTokenRefreshError` (`terminal` vs `transient`) before being
 * rethrown; no partial/corrupt persistence happens on failure.
 *
 * ## Admin alert on terminal failure
 *
 * When a refresh fails with `kind: 'terminal'` (MercadoLibre rejected the
 * refresh token itself — re-authorization required), {@link performRefresh}
 * fires a fire-and-forget admin notification via
 * {@link notifyAdminOfTerminalRefreshFailure} BEFORE rethrowing the classified
 * error. The notification is never awaited by the caller and any failure in
 * the notification pipeline itself (missing admin recipient, transport error)
 * is caught and logged — it can never replace or suppress the original
 * `MLTokenRefreshError` surfaced to the caller. Neither the access token nor
 * the refresh token is ever included in the alert payload or logs.
 *
 * ## Concurrency — single-flight, single-process scope only
 *
 * Because ML refresh tokens are single-use, two overlapping callers must
 * never both redeem the same stored refresh token — the second redemption
 * would fail (or worse, silently invalidate the first caller's newly-issued
 * pair, depending on ML's rotation semantics). This module guards against
 * that with an in-process single-flight promise ({@link inFlightRefresh}):
 * the first caller to reach the near-expiry branch starts the refresh and
 * stores its promise; any caller that arrives while that promise is still
 * pending awaits and returns the SAME promise instead of starting a second
 * HTTP exchange. Once the in-flight refresh settles (success or failure),
 * the slot is cleared so the NEXT near-expiry call (sequential, not
 * concurrent with the first) starts a fresh refresh.
 *
 * **Staggered callers**: a caller that arrives after a prior refresh cycle
 * already completed (so the single-flight slot is `null` again) re-reads the
 * credential fresh before deciding to redeem a refresh token, rather than
 * trusting a potentially-stale value from its own earlier read. This closes
 * a narrow race where a caller's `getActiveMLCredential` read is issued
 * before, but resolves after, another caller's refresh has already rotated
 * the stored refresh token — which would otherwise redeem an already-used
 * token and produce a false `terminal` error and admin alert.
 *
 * **Scope limitation**: this lock is a module-level JS variable — it only
 * protects concurrent calls within a single Node.js process/instance. It
 * provides NO protection against two separate API instances (e.g. two
 * replicas, or a replica racing a cron worker) refreshing at the same time.
 * Per the HOS-45 spec, that broader scope (a distributed lock, e.g.
 * Redis-backed) is explicitly out of scope for this task.
 *
 * @module services/mercadolibre-oauth/ml-token.service
 */

import { NotificationType } from '@repo/notifications';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { sendNotification } from '../../utils/notification-helper.js';
import { getActiveMLCredential, upsertMLCredential } from './ml-credential.repository.js';
import { refreshAccessToken } from './ml-oauth-client.js';
import { classifyMLRefreshFailure, MLTokenRefreshError } from './ml-token.errors.js';

/**
 * Path to the admin OAuth endpoint operators must call to re-authorize the
 * MercadoLibre integration after a terminal refresh failure.
 */
const ML_REAUTHORIZE_ENDPOINT = '/api/v1/admin/mercadolibre-oauth/authorize';

/**
 * Resolves the single admin email address that terminal-failure alerts are
 * sent to.
 *
 * Order of precedence (mirrors `routes/contact/submit.ts`'s
 * `resolveSupportInbox`):
 *   1. `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` (first entry of the comma-separated list)
 *   2. `HOSPEDA_FEEDBACK_FALLBACK_EMAIL`
 *   3. Hardcoded `info@hospeda.com.ar` as a last-resort default, so an
 *      operational alert about a broken import tier is never silently
 *      dropped for lack of configuration.
 *
 * @returns The resolved admin recipient email address
 */
function resolveAdminAlertRecipient(): string {
    const adminList = env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS;
    if (adminList && adminList.length > 0) {
        const first = adminList.split(',')[0]?.trim();
        if (first && first.length > 0) {
            return first;
        }
    }

    if (env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL) {
        return env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL;
    }

    return 'info@hospeda.com.ar';
}

/**
 * Sends the admin alert for a terminal MercadoLibre token refresh failure.
 *
 * Uses the generic `NotificationType.ADMIN_SYSTEM_EVENT` type via
 * {@link sendNotification} (the most general "send a notification to admin
 * users" primitive `@repo/notifications` exposes) — there is no dedicated
 * notification type for this alert, unlike e.g. `AI_COST_THRESHOLD_ALERT`.
 * The access/refresh tokens are never included in the payload.
 *
 * @param error - The classified terminal `MLTokenRefreshError`
 */
async function sendTerminalRefreshFailureAlert(error: MLTokenRefreshError): Promise<void> {
    const recipientEmail = resolveAdminAlertRecipient();

    await sendNotification({
        type: NotificationType.ADMIN_SYSTEM_EVENT,
        recipientEmail,
        recipientName: 'Admin',
        userId: null,
        severity: 'critical',
        eventDetails: {
            eventType: 'mercadolibre_oauth_refresh_terminal_failure',
            message: `The MercadoLibre import tier is down and requires re-authorization: ${error.message}`,
            reauthorizeUrl: ML_REAUTHORIZE_ENDPOINT,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Fires the admin alert for a terminal MercadoLibre token refresh failure as
 * fire-and-forget background work.
 *
 * This function is synchronous and never throws — it enqueues
 * {@link sendTerminalRefreshFailureAlert} without awaiting it, and any
 * rejection from that promise is caught and logged here. This guarantees the
 * secondary notification failure can never replace or mask the original
 * `MLTokenRefreshError` that {@link performRefresh} is about to rethrow to
 * its caller.
 *
 * @param error - The classified terminal `MLTokenRefreshError`
 */
function notifyAdminOfTerminalRefreshFailure(error: MLTokenRefreshError): void {
    void sendTerminalRefreshFailureAlert(error).catch((notificationError: unknown) => {
        apiLogger.error(
            {
                error:
                    notificationError instanceof Error
                        ? notificationError.message
                        : String(notificationError)
            },
            'ml-token: failed to send admin alert for terminal refresh failure (non-fatal)'
        );
    });
}

/**
 * Safety margin, in milliseconds, applied before a token's reported
 * `expiresAt`. A token within this margin of expiring is treated as
 * "needs refresh" even though it has not technically expired yet, to avoid
 * a request failing mid-flight due to the token expiring between the check
 * and its use.
 */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Determines whether a MercadoLibre access token with the given expiry
 * should be refreshed rather than reused as-is.
 *
 * A token is considered to need a refresh once it is within
 * {@link REFRESH_MARGIN_MS} of `expiresAt` — including the boundary itself
 * — or already past it.
 *
 * @param expiresAt - The token's reported expiry timestamp
 * @returns `true` when the token is within the refresh margin (or already
 * expired), `false` when it is still comfortably valid
 *
 * @example
 * ```ts
 * needsRefresh(new Date(Date.now() + 60 * 60 * 1000)); // false — 1h left
 * needsRefresh(new Date(Date.now() + 2 * 60 * 1000));  // true — 2min left
 * needsRefresh(new Date(Date.now() - 1000));           // true — already expired
 * ```
 */
export function needsRefresh(expiresAt: Date): boolean {
    const remainingMs = expiresAt.getTime() - Date.now();
    return remainingMs <= REFRESH_MARGIN_MS;
}

/**
 * Module-level single-flight guard for {@link handleNearExpiryToken}.
 *
 * `null` when no refresh is currently in progress. When a refresh starts,
 * this holds the `Promise` for that refresh so overlapping callers can await
 * the SAME promise instead of starting a second (unsafe — ML refresh tokens
 * are single-use) redemption. Cleared back to `null` once the in-flight
 * promise settles, so the next near-expiry call (not concurrent with the
 * one that just finished) starts a fresh refresh.
 *
 * **Process-local only** — see the module doc's concurrency section for the
 * accepted scope limitation.
 */
let inFlightRefresh: Promise<string> | null = null;

/**
 * Redeems the given refresh token for a new access/refresh token pair via
 * {@link refreshAccessToken} and persists the rotated pair via
 * {@link upsertMLCredential}.
 *
 * This is the actual refresh work performed under the single-flight guard in
 * {@link handleNearExpiryToken} — factored out so that function stays purely
 * about the concurrency guard.
 *
 * @param refreshToken - The currently-stored refresh token to redeem
 * @returns The newly-issued access token
 * @throws {MLTokenRefreshError} Classified via {@link classifyMLRefreshFailure}
 * when the ML token endpoint rejects the refresh. `upsertMLCredential` is
 * never called in this case — no partial/corrupt persistence on failure.
 * When the classified error has `kind: 'terminal'`, an admin notification is
 * fired (fire-and-forget, see {@link notifyAdminOfTerminalRefreshFailure})
 * before the error is rethrown; a failure in that notification is swallowed
 * and never changes or masks the rethrown `MLTokenRefreshError`.
 */
async function performRefresh(refreshToken: string): Promise<string> {
    try {
        const result = await refreshAccessToken({ refreshToken });

        await upsertMLCredential({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: new Date(Date.now() + result.expiresIn * 1000)
        });

        return result.accessToken;
    } catch (error) {
        const classifiedError = classifyMLRefreshFailure(error);

        if (classifiedError.kind === 'terminal') {
            notifyAdminOfTerminalRefreshFailure(classifiedError);
        }

        throw classifiedError;
    }
}

/**
 * Handles the near-expiry / already-expired case for a MercadoLibre
 * credential: refreshes the access token and returns the new one, guarded
 * by the module-level {@link inFlightRefresh} single-flight lock so
 * overlapping callers share one refresh instead of racing two redemptions
 * of the same (single-use) refresh token.
 *
 * **Staggered-caller safety**: the single-flight slot only collapses callers
 * that are genuinely concurrent (both arrive while a refresh is in flight).
 * A caller that arrives AFTER a prior refresh cycle already completed and
 * cleared the slot — but whose own {@link getActiveMLCredential} read (in
 * {@link getValidMercadoLibreToken}) was issued before that refresh
 * persisted — would otherwise try to redeem an already-consumed refresh
 * token, producing a spurious `terminal` error and a false admin alert even
 * though a valid token already exists. To close that gap, this function
 * re-reads the credential fresh here, inside its own critical section,
 * immediately before deciding whether a real refresh is still needed.
 *
 * @returns The valid access token — either the freshly-confirmed cached one
 * (if another caller already refreshed it since the original read), a newly
 * refreshed one, or (if a refresh was already in flight) the shared result
 * of that in-flight refresh
 * @throws {MLTokenRefreshError} With `kind: 'terminal'` if the credential was
 * deleted between the original read and this re-check, or — see
 * {@link performRefresh} — when the refresh itself fails
 */
function handleNearExpiryToken(): Promise<string> {
    if (inFlightRefresh !== null) {
        return inFlightRefresh;
    }

    const refreshPromise = (async () => {
        try {
            const freshCredential = await getActiveMLCredential();

            if (freshCredential === null) {
                throw new MLTokenRefreshError(
                    'No MercadoLibre OAuth credential configured — run the authorization flow first',
                    'terminal'
                );
            }

            if (!needsRefresh(freshCredential.expiresAt)) {
                return freshCredential.accessToken;
            }

            return await performRefresh(freshCredential.refreshToken);
        } finally {
            inFlightRefresh = null;
        }
    })();

    inFlightRefresh = refreshPromise;
    return refreshPromise;
}

/**
 * Returns a valid MercadoLibre OAuth access token, refreshing it first if
 * it is missing, near-expiry, or already expired.
 *
 * When no credential is configured, this throws a `terminal`
 * {@link MLTokenRefreshError} directing the operator to run the
 * authorization flow. When a credential exists and is still comfortably
 * valid, its cached `accessToken` is returned directly with no HTTP call.
 * When the credential is near-expiry or expired, {@link handleNearExpiryToken}
 * redeems the stored refresh token for a new access/refresh pair, persists
 * the rotation, and returns the new access token — see the module doc for
 * the single-flight concurrency guard that protects against racing two
 * redemptions of the same single-use refresh token.
 *
 * @returns A valid MercadoLibre access token — cached if still valid,
 * freshly refreshed otherwise
 * @throws {MLTokenRefreshError} With `kind: 'terminal'` when no
 * MercadoLibre OAuth credential has been configured yet, or when the
 * refresh itself is classified as terminal (e.g. `invalid_grant`)
 * @throws {MLTokenRefreshError} With `kind: 'transient'` when the refresh
 * fails for a retryable reason (network error, ML 5xx, timeout)
 *
 * @example
 * ```ts
 * const accessToken = await getValidMercadoLibreToken();
 * // Use accessToken to call the MercadoLibre API.
 * ```
 */
export async function getValidMercadoLibreToken(): Promise<string> {
    const credential = await getActiveMLCredential();

    if (credential === null) {
        throw new MLTokenRefreshError(
            'No MercadoLibre OAuth credential configured — run the authorization flow first',
            'terminal'
        );
    }

    if (!needsRefresh(credential.expiresAt)) {
        return credential.accessToken;
    }

    return handleNearExpiryToken();
}

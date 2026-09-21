/**
 * @file internal-bypass-report.ts
 * @description Impure alerting wrapper around the shared HOS-155 self-check,
 * ported to the admin by HOS-1153.
 *
 * ## Why the admin needs this at all
 *
 * `fetchAuthSession` sends `X-Internal-Request` only when
 * `HOSPEDA_INTERNAL_API_URL` is configured. Both that var and
 * `HOSPEDA_INTERNAL_REQUEST_SECRET` are `.optional()` in `AdminEnvSchema`, so
 * setting one without the other starts the app perfectly happily and simply
 * never sends the header. That is the exact shape of the HOS-155 incident
 * (2026-07-13), where the web ran for hours with the bypass silently off until
 * production mass-429'd. The admin's version of that failure is quieter still:
 * every operator silently shares one `proxy:<container-ip>` bucket and the
 * panel starts throwing 429s under two or three concurrent users, with nothing
 * anywhere saying why.
 *
 * The predicate itself lives in `@repo/config` (one copy, shared with the web).
 * This module is only the impure half: turning a `misconfigured` verdict into a
 * loud, guaranteed-visible alert. It is a separate function from the caller so
 * the alerting path can be unit-tested directly, instead of only being
 * reachable through `server.ts` module scope — which never takes the
 * `misconfigured` branch under test, since `isProd` is always false there.
 */

import { checkInternalBypassConfig, type InternalBypassCheckResult } from '@repo/config';
import * as Sentry from '@sentry/react';

/**
 * Runs the shared HOS-155 internal-bypass self-check and, when the result is
 * `misconfigured`, emits a guaranteed-visible alert (a plain `console.error`
 * plus a Sentry error-level capture).
 *
 * Never throws from its alerting path: the alert emission is wrapped in
 * `try/catch` so a failure there (Sentry unavailable, for instance) can never
 * turn into a boot crash-loop for the admin SSR server. The pure
 * `checkInternalBypassConfig` it delegates to is total and does not throw.
 *
 * @param params - The two bypass env values to validate, plus whether the
 *   current environment is production. Passed straight through to
 *   `checkInternalBypassConfig`.
 * @returns The underlying check result (`ok`, `skipped`, or `misconfigured`).
 */
export function reportInternalBypassSelfCheck({
    internalApiUrl,
    internalRequestSecret,
    isProd
}: {
    readonly internalApiUrl: string | undefined;
    readonly internalRequestSecret: string | undefined;
    readonly isProd: boolean;
}): InternalBypassCheckResult {
    const result = checkInternalBypassConfig({ internalApiUrl, internalRequestSecret, isProd });

    if (result.status === 'misconfigured') {
        try {
            // Deliberately plain console.error, not adminLogger: the logger
            // no-ops in production unless VITE_ENABLE_LOGGING is set, and this
            // alert must never be silenced — being silent is the whole bug.
            console.error(`[admin] internal-bypass self-check FAILED: ${result.reason}`);
            Sentry.captureMessage(
                `[HOS-1153] admin internal-bypass misconfigured: ${result.reason}`,
                {
                    level: 'error',
                    tags: { module: 'admin', subsystem: 'startup-selfcheck' }
                }
            );
        } catch (error) {
            // The alert path itself must never break server entry module load.
            console.error('[admin] internal-bypass alert emission threw unexpectedly:', error);
        }
    }

    return result;
}

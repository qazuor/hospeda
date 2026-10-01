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
 * visible alert. It is a separate function from the caller so the alerting path
 * can be unit-tested directly, instead of only being reachable through
 * `server.ts` module scope — which never takes the `misconfigured` branch under
 * test, since `isProd` is always false there.
 *
 * ## Why there is no Sentry capture here, unlike the web's version
 *
 * `apps/web`'s twin also calls `Sentry.captureMessage`, and it works there
 * because it imports `@sentry/astro`, which ships a server SDK. The admin only
 * has `@sentry/react` — a BROWSER SDK — and `shouldInitializeSentry()`
 * (`./sentry/sentry.config.ts`) refuses to initialise it whenever `window` is
 * undefined, for the reason stated in its own comment: the React SDK's
 * integrations reach for DOM APIs and are not safe to boot inside Nitro's
 * node-server bundle.
 *
 * This function runs ONLY on the server (module scope of `server.ts`), so a
 * `captureMessage` call here would have no client bound and would return having
 * sent nothing. Measured, not inferred: built with a DSN pointing at a local
 * HTTP sink and booted in the misconfigured shape, the `console.error` appeared
 * and the sink received zero requests, while a manual curl to the same sink was
 * logged. A unit test could not have caught it — mocking `@sentry/react` proves
 * this module CALLS `captureMessage`, never that the real SDK has anywhere to
 * deliver it.
 *
 * So the alert is the `console.error` alone, and that is deliberate rather than
 * an omission: it is also what `sentry.config.ts` already prescribes —
 * "server-side error tracking should go through the API's own Sentry
 * middleware, not the React SDK". Routing this to Sentry properly means either
 * adding `@sentry/node` to the admin or forwarding to the API; that is a
 * dependency/architecture decision, left to the owner rather than faked here.
 */

import { checkInternalBypassConfig, type InternalBypassCheckResult } from '@repo/config';

/**
 * Runs the shared HOS-155 internal-bypass self-check and, when the result is
 * `misconfigured`, emits an unsilenceable `console.error`.
 *
 * See this module's header for why there is no Sentry capture alongside it.
 *
 * Never throws from its alerting path: the emission is wrapped in `try/catch`
 * so a failure there can never turn into a boot crash-loop for the admin SSR
 * server. The pure `checkInternalBypassConfig` it delegates to is total and
 * does not throw.
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
            // The HOS-1153 tag is what makes it greppable in container logs,
            // which is now the only place it lands.
            console.error(`[HOS-1153][admin] internal-bypass self-check FAILED: ${result.reason}`);
        } catch (error) {
            // The alert path itself must never break server entry module load.
            console.error('[admin] internal-bypass alert emission threw unexpectedly:', error);
        }
    }

    return result;
}

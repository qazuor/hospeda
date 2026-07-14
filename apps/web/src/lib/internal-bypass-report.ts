/**
 * @file internal-bypass-report.ts
 * @description Impure alerting wrapper around the pure HOS-155 self-check
 * (`./internal-bypass-selfcheck`).
 *
 * `checkInternalBypassConfig` is deliberately kept pure (no env reads, no
 * logging, no Sentry) so it stays trivially unit-testable. Something still
 * has to turn a `misconfigured` result into a loud, guaranteed-visible alert
 * (console + Sentry) — that impure side effect lives here, in its own
 * function, so it can be unit-tested in isolation instead of only being
 * exercisable indirectly through `src/middleware.ts` module-scope code
 * (which never runs the `misconfigured` branch in the test environment,
 * since `isProduction()` is always false there).
 */

import * as Sentry from '@sentry/astro';
import {
    checkInternalBypassConfig,
    type InternalBypassCheckResult
} from './internal-bypass-selfcheck';

/**
 * Runs the pure HOS-155 internal-bypass self-check and, when the result is
 * `misconfigured`, emits a guaranteed-visible alert (a plain `console.error`
 * plus a Sentry error-level capture).
 *
 * This function never throws from its alerting path: it wraps the alert
 * emission in a `try/catch` so that a failure there (e.g. Sentry being
 * unavailable) can never turn into a boot crash-loop for the SSR server. The
 * pure `checkInternalBypassConfig` it delegates to is total and does not
 * throw, so in practice the whole call is throw-free; the caller in
 * `src/middleware.ts` still wraps it in an outer `try/catch` as
 * belt-and-suspenders. Any error caught here is itself logged via
 * `console.error` so it is not silently swallowed, then the check result is
 * returned regardless.
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
            // Guaranteed-visible alert: intentionally plain console.error (not
            // webLogger), since webLogger.error no-ops in production unless
            // PUBLIC_ENABLE_LOGGING is set — this alert must never be silenced.
            console.error(`[web] SSR internal-bypass self-check FAILED: ${result.reason}`);
            // Object form with `tags` (not the bare-string level overload) to
            // match every other captureMessage call site in the repo — the tags
            // make this alert groupable/filterable in the Sentry dashboard,
            // which is the whole point of a fast-triage incident alert (HOS-155).
            Sentry.captureMessage(`[HOS-155] SSR internal-bypass misconfigured: ${result.reason}`, {
                level: 'error',
                tags: { module: 'web', subsystem: 'startup-selfcheck' }
            });
        } catch (error) {
            // The alert path itself must never break middleware module load.
            console.error('[web] SSR internal-bypass alert emission threw unexpectedly:', error);
        }
    }

    return result;
}

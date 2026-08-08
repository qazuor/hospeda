/**
 * Sentry browser-side configuration for hospeda-web.
 *
 * Auto-discovered by `@sentry/astro` at build time (no explicit import needed
 * from the app). Only configures runtime behavior — DSN, environment, sampling,
 * integrations. Source-map upload is configured in `astro.config.mjs` via the
 * `@sentry/astro` Vite plugin (SPEC-180 BETA-66).
 *
 * PRIVACY NOTE — crash reporting consent gate:
 * Sentry is initialized ONLY when the user has explicitly opted in to crash
 * reporting via the cookie-consent banner (`consent.crashReporting === true`).
 * This is an intentional privacy decision, NOT a bug:
 *   - Crash reporting is a separate consent category from analytics/tracking.
 *   - Users who reject all optional cookies (first visit, no cookie) get
 *     NO Sentry initialization at all — the SDK stays dormant.
 *   - Users who accept crash reporting get full error and replay coverage.
 * Do NOT remove the consent gate without a privacy/legal review.
 *
 * PERFORMANCE — the SDK is imported DYNAMICALLY (HOS-369):
 * `@sentry/astro` used to be a static import here. Because this file is emitted
 * as a `<script type="module">` in every page's `<head>`, that made the browser
 * fetch ~236 KB raw / ~78 KB over the wire at high priority on EVERY page load —
 * including for the majority of visitors who never consent, since the gate below
 * only skipped `Sentry.init()`, never the download. On a bandwidth-bound mobile
 * connection those bytes competed directly with the LCP image.
 *
 * Two changes fix that, and both matter:
 *   1. `await import('@sentry/astro')` — so the SDK lands in its own async
 *      chunk that is only requested when the consent gate actually passes.
 *   2. The import is scheduled after `load` + idle, so even consenting users do
 *      not pay for it inside the LCP window.
 *
 * Errors thrown before the SDK finishes loading are NOT lost: `error` and
 * `unhandledrejection` listeners installed synchronously below buffer them, and
 * `registerSentry()` replays the buffer once `init()` has run. Those listeners
 * are removed immediately before `init()` so Sentry's own global handlers do not
 * double-report the same exception.
 *
 * All other browser-side Sentry access goes through `src/lib/observability/
 * sentry-lazy.ts`. Do NOT add a static `@sentry/astro` import to any file that
 * ships to the browser — one is enough to pull the SDK back onto the critical
 * path.
 *
 * SPEC-180 BETA-64: the `capture` LoggerOptions flag is NOT used here — the
 * web app does not use `@repo/logger`. Client-side errors reach Sentry via
 * the `@sentry/astro` SDK's automatic instrumentation (uncaught exceptions,
 * unhandled rejections, and the replay integration).
 */

import { getConsent } from './src/lib/cookie-consent';
import { registerSentry } from './src/lib/observability/sentry-lazy';

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
// Prefer PUBLIC_SENTRY_ENVIRONMENT over MODE so staging and prod (both
// MODE=production) end up in different Sentry environments. Falls back
// to MODE when the explicit override is unset.
const environment =
    import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development';

// First-party tunnel path (SPEC-181 follow-up). When set (e.g. `/api/event`),
// the browser SDK POSTs all envelopes to this same-origin path instead of
// directly to *.sentry.io, so ad-blockers (uBlock `||sentry.io^$3p`) cannot
// intercept error reporting. A Cloudflare Worker bound to that path
// (infra/cloudflare/sentry-tunnel/) parses the DSN and forwards to Sentry.
// Leave unset to report directly to Sentry (the Worker must be live BEFORE this
// is set — see the Worker README for the deploy order + CSP coupling).
const tunnel = import.meta.env.PUBLIC_SENTRY_TUNNEL || undefined;

// Only initialize Sentry when the user has consented to crash reporting.
// Crash reporting is its own consent category (separate from analytics) so
// users who opt out of behavioural tracking can still opt in to error
// reporting that helps us fix bugs that affect them. If no consent cookie
// exists (first visit), Sentry stays silent until the user opts in.
const consent = getConsent();
const crashReportingAllowed = consent?.crashReporting === true;

/**
 * Exceptions that happen between page parse and the deferred SDK load. Captured
 * by temporary global listeners and replayed through `registerSentry()`. Bounded
 * so an error loop cannot grow it without limit.
 */
const MAX_EARLY_ERRORS = 10;
const earlyErrors: unknown[] = [];

function bufferEarlyError(value: unknown): void {
    if (earlyErrors.length < MAX_EARLY_ERRORS) {
        earlyErrors.push(value);
    }
}

function onEarlyError(event: ErrorEvent): void {
    bufferEarlyError(event.error ?? event.message);
}

function onEarlyRejection(event: PromiseRejectionEvent): void {
    bufferEarlyError(event.reason);
}

/**
 * Import, initialise, and publish the SDK, then replay anything that failed
 * while it was loading. Any failure here is swallowed: crash reporting going
 * down must never take the page down with it.
 */
async function loadAndInitSentry(): Promise<void> {
    // Hand the global handlers over to Sentry BEFORE init so the same exception
    // is not reported twice (once from our buffer, once by Sentry's own hooks).
    window.removeEventListener('error', onEarlyError);
    window.removeEventListener('unhandledrejection', onEarlyRejection);

    try {
        const Sentry = await import('@sentry/astro');

        Sentry.init({
            dsn,
            environment,
            // Route envelopes through the first-party tunnel when configured (only
            // included when set, so the default behavior is unchanged).
            ...(tunnel ? { tunnel } : {}),
            release: import.meta.env.PUBLIC_SENTRY_RELEASE || 'development',

            initialScope: {
                tags: {
                    project: 'hospeda',
                    app_type: 'web'
                }
            },

            tracesSampleRate: import.meta.env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,

            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    // Privacy hardening (production launch, Argentina real users):
                    // mask all text content and block all media in session replays
                    // so replays never leak personal data (names, addresses,
                    // booking details, photos) rendered in the DOM.
                    maskAllText: true,
                    blockAllMedia: true
                })
            ],

            beforeSend(event) {
                if (event.request?.headers) {
                    const {
                        Authorization: _auth,
                        Cookie: _cookie,
                        'X-Auth-Token': _token,
                        ...cleanHeaders
                    } = event.request.headers;
                    event.request.headers = cleanHeaders;
                }
                return event;
            },

            beforeBreadcrumb(breadcrumb) {
                if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
                    return null;
                }
                return breadcrumb;
            }
        });

        registerSentry(Sentry);

        for (const error of earlyErrors) {
            Sentry.captureException(error);
        }
        earlyErrors.length = 0;
    } catch {
        // Loading or initialising Sentry failed (offline, blocked by an
        // extension, chunk 404 after a deploy). Nothing to report it to.
    }
}

/**
 * Schedule the SDK load outside the LCP window: after `load`, then on the first
 * idle slot, with a timeout so a permanently busy page still gets crash
 * reporting.
 */
function scheduleSentryLoad(): void {
    const start = (): void => {
        void loadAndInitSentry();
    };

    const schedule = (): void => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(start, { timeout: 3000 });
        } else {
            window.setTimeout(start, 1000);
        }
    };

    if (document.readyState === 'complete') {
        schedule();
    } else {
        window.addEventListener('load', schedule, { once: true });
    }
}

if (dsn && crashReportingAllowed) {
    window.addEventListener('error', onEarlyError);
    window.addEventListener('unhandledrejection', onEarlyRejection);
    scheduleSentryLoad();
}

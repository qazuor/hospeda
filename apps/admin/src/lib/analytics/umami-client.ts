/**
 * @file umami-client.ts
 * @description Umami browser client for the admin dashboard (HOS-2119).
 *
 * Self-hosted Umami analytics client. The tracker is injected as a
 * deferred `<script>` carrying the per-request CSP nonce, so it is allowed by
 * the admin CSP. Events go through `createBrowserAnalytics`, which validates
 * them against the shared catalog (`prepareAnalyticsEvent`).
 *
 * Initialization is gated by:
 *   - `window` presence, so it never runs during SSR.
 *   - the Vite DEV flag, so `pnpm dev` never posts to Umami.
 *   - `VITE_UMAMI_SCRIPT_URL` and `VITE_UMAMI_WEBSITE_ID`, so unconfigured
 *     builds (local, CI) stay silent.
 *
 * Only the staff user id is ever identified (OQ-5). Never pass an email.
 *
 * Identify order (OQ-5, same rule as the web): the identify is sent strictly
 * after Umami answered this document's pageview, i.e. once the tracker holds
 * the `x-umami-cache` token (`getSession().cache`, read with the shared
 * `hasUmamiCacheToken`). Sent earlier it carries no token and opens a separate
 * `uuid(…, id)` session instead of claiming the anonymous one. The admin keeps
 * the tracker's own auto pageview (no `<ClientRouter />`), whose promise is
 * internal to the tracker, so the answer is detected by polling the token,
 * bounded from when that pageview goes out: the tracker sends it once the
 * document is `complete`, so the bound starts at the script `load` or the
 * window `load`, whichever is later. When the token never shows up (ad
 * blocker, failed request) no identify is sent and nothing throws.
 *
 * @example
 * ```ts
 * import { initUmami, trackEvent } from '@/lib/analytics/umami-client';
 * initUmami();
 * trackEvent('admin_tour_completed', { role: null, tour_id: 'welcome' });
 * ```
 */

import type {
    AnalyticsEventName,
    AnalyticsEventProperties,
    BrowserAnalyticsDiagnostics
} from '@repo/analytics';
import {
    createBrowserAnalytics,
    createUmamiBrowserClient,
    hasUmamiCacheToken
} from '@repo/analytics';
import { env } from '@/env';
import { getCspNonceOnClient } from '@/lib/csp-nonce';
import { adminLogger } from '@/utils/logger';

/**
 * Singleton flag so the tracker script is injected at most once, even when
 * React strict mode or several entry points call `initUmami()`.
 */
let isInitialized = false;

/** Interval between checks for the tracker's cache token. */
export const UMAMI_ACK_POLL_INTERVAL_MS = 250;
/** Maximum checks once the auto pageview went out (about 10 seconds). */
export const UMAMI_ACK_MAX_POLLS = 40;

/**
 * Identity waiting for the pageview acknowledgement. Flushed when the poll
 * sees the cache token, cleared by `resetUser()`.
 */
let pendingUserId: string | null = null;
/** User id already identified in this document (the tracker keeps it in memory). */
let identifiedUserId: string | null = null;
/** Whether the bounded acknowledgement poll was started (at most once per document). */
let acknowledgementPollStarted = false;

/** Whether the tracker holds the cache token of an answered request. */
function isPageviewAcknowledged(): boolean {
    return hasUmamiCacheToken({ tracker: Reflect.get(window, 'umami') });
}

/** Sends the identify for `userId` unless this document already sent it. */
function identifyNow(userId: string): void {
    pendingUserId = null;
    if (identifiedUserId === userId) return;
    identifiedUserId = userId;
    analytics.identify(userId);
}

/** Delivers the pending identity (if any) now that the pageview was acknowledged. */
function flushPendingIdentity(): void {
    if (pendingUserId === null) return;
    identifyNow(pendingUserId);
}

/** Polls the cache token a bounded number of times; gives up silently. */
function pollForAcknowledgement(): void {
    let polls = 0;
    const timer = window.setInterval(() => {
        polls += 1;
        if (isPageviewAcknowledged()) {
            window.clearInterval(timer);
            flushPendingIdentity();
            return;
        }
        if (polls >= UMAMI_ACK_MAX_POLLS) window.clearInterval(timer);
    }, UMAMI_ACK_POLL_INTERVAL_MS);
}

/**
 * The tracker script loaded. Its auto pageview goes out once the document is
 * `complete`, so the bounded poll starts then (at most once).
 */
function startAcknowledgementPoll(): void {
    if (acknowledgementPollStarted) return;
    acknowledgementPollStarted = true;
    if (document.readyState === 'complete') {
        pollForAcknowledgement();
        return;
    }
    window.addEventListener('load', pollForAcknowledgement, { once: true });
}

const umamiClient = createUmamiBrowserClient();

function resolveBrowserEnvironment():
    | 'development'
    | 'test'
    | 'preview'
    | 'staging'
    | 'production' {
    if (typeof window === 'undefined') {
        return import.meta.env.DEV ? 'development' : 'production';
    }

    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
        return 'development';
    }
    if (hostname.includes('staging')) {
        return 'staging';
    }
    if (hostname.includes('preview')) {
        return 'preview';
    }
    if (hostname.includes('test')) {
        return 'test';
    }
    return 'production';
}

const analytics = createBrowserAnalytics({
    debug: import.meta.env.DEV,
    enabled: true,
    getClient: () => (typeof window === 'undefined' ? undefined : umamiClient),
    getGlobalProperties: () => ({
        app: 'admin',
        app_version: env.VITE_APP_VERSION,
        environment: resolveBrowserEnvironment()
    }),
    onDiagnostic: ({ message, payload }: BrowserAnalyticsDiagnostics) => {
        adminLogger.debug(`[analytics] ${message}`, payload);
    }
});

/**
 * Inject the Umami tracker script once, when the build and environment allow.
 *
 * Idempotent: later calls after the first successful init are no-ops. Safe to
 * call from any client-only entry point; returns silently on the server, in
 * development, and when the Umami env vars are unset.
 */
export function initUmami(): void {
    if (isInitialized) return;
    if (typeof window === 'undefined') return;
    if (import.meta.env.DEV) {
        adminLogger.debug('[Umami] Skipping initialization in development');
        return;
    }

    const scriptUrl = env.VITE_UMAMI_SCRIPT_URL;
    const websiteId = env.VITE_UMAMI_WEBSITE_ID;
    if (!scriptUrl || !websiteId) {
        adminLogger.warn('[Umami] VITE_UMAMI_SCRIPT_URL / VITE_UMAMI_WEBSITE_ID not set; disabled');
        return;
    }

    const script = document.createElement('script');
    script.defer = true;
    script.src = scriptUrl;
    script.setAttribute('data-website-id', websiteId);
    const nonce = getCspNonceOnClient();
    if (nonce) {
        script.nonce = nonce;
    }
    script.addEventListener('load', startAcknowledgementPoll);
    document.head.appendChild(script);

    isInitialized = true;
    adminLogger.info('[Umami] Initialized');
}

/**
 * Whether `initUmami()` has injected the tracker in this browser session.
 */
export function isUmamiInitialized(): boolean {
    return isInitialized;
}

/**
 * Capture a catalog analytics event. Validated by the shared analytics
 * package; invalid events are dropped, never thrown. No-op on the server,
 * before init, or while the tracker script has not loaded.
 *
 * @param name - Catalog event name.
 * @param props - Event properties for that event.
 */
export function trackEvent<TName extends AnalyticsEventName>(
    name: TName,
    props: AnalyticsEventProperties<TName>
): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    analytics.capture(name, props);
}

/**
 * Identify the current staff member by user id only (OQ-5). Never pass an
 * email or other personal data.
 *
 * Sent only once Umami acknowledged this document's pageview (see the file
 * header): at once when the tracker already holds the cache token, otherwise
 * kept pending until the bounded poll sees it. Repeated calls with the same
 * id send one identify per document.
 *
 * @param userId - Stable user ID (Better Auth user.id).
 */
export function identifyUser(userId: string): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    if (isPageviewAcknowledged()) {
        identifyNow(userId);
        return;
    }
    pendingUserId = userId;
}

/**
 * Clear the identified user on sign-out: drops a pending identify and lets a
 * later login identify again. Umami derives sessions server-side and has no
 * reset API, so the tracker itself is left untouched.
 */
export function resetUser(): void {
    if (typeof window === 'undefined') return;
    pendingUserId = null;
    identifiedUserId = null;
    if (!isInitialized) return;
    analytics.reset();
}

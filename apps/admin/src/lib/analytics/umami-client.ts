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
 * Identify order (OQ-5, revised 2026-11-17, owner, after staging smoke: claimed
 * fingerprint session leaked across accounts): a staff member lives in a
 * per-user `uuid(…, id)` Umami session and server events carrying the same user
 * id join it; the anonymous fingerprint session is never claimed. That only
 * holds when the identify is the document's FIRST request, i.e. the tracker
 * does not hold an `x-umami-cache` token yet (`getSession().cache`, read with
 * the shared `hasUmamiCacheToken`): with the token Umami would claim the
 * fingerprint session. So the identify is sent as soon as the tracker script is
 * present and SKIPPED (never delayed) when the tracker already holds a token:
 * that document stays anonymous. The admin keeps the tracker's own auto
 * pageview and its session resolves asynchronously, so a slow session fetch
 * loses the race and that document is not identified (fail-closed). Nothing
 * is persisted: every document identifies again.
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

/** Identity waiting for the tracker script to load. Cleared by `resetUser()`. */
let pendingUserId: string | null = null;
/** User id already identified in this document (the tracker keeps it in memory). */
let identifiedUserId: string | null = null;

/** Whether the tracker script is present (it loads deferred, or never when blocked). */
function isTrackerPresent(): boolean {
    return typeof Reflect.get(Reflect.get(window, 'umami') ?? {}, 'identify') === 'function';
}

/**
 * Sends the identify for `userId` unless this document already sent it or the
 * tracker already holds a cache token (an identify would then claim the
 * anonymous fingerprint session, see the file header).
 */
function identifyNow(userId: string): void {
    pendingUserId = null;
    if (identifiedUserId === userId) return;
    if (hasUmamiCacheToken({ tracker: Reflect.get(window, 'umami') })) {
        adminLogger.debug('[analytics] identify skipped: tracker already holds a session token');
        return;
    }
    identifiedUserId = userId;
    analytics.identify(userId);
}

/** The tracker script loaded: delivers the pending identity, if any. */
function flushPendingIdentity(): void {
    if (pendingUserId === null) return;
    identifyNow(pendingUserId);
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
    script.addEventListener('load', flushPendingIdentity);
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
 * Sent as soon as the tracker is present, and only while it holds no session
 * token (see the file header); until the script loads it stays pending.
 * Repeated calls with the same id send one identify per document.
 *
 * @param userId - Stable user ID (Better Auth user.id).
 */
export function identifyUser(userId: string): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    if (isTrackerPresent()) {
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

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
 * that document stays anonymous. Nothing is persisted: every document
 * identifies again.
 *
 * Pageviews: the tracker renders with `data-auto-pageview="false"` and the
 * router sends them through {@link trackPageview} (`UmamiPageviews`), because
 * the tracker's own pageview went out before the session resolved and its
 * answer left the token that made the identify skip. The FIRST pageview of a
 * document under the authenticated layout is held until the identity settles:
 * identify sent (or skipped), `markVisitorAnonymous`, or
 * {@link FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS} elapsed (then it goes out
 * anonymously and the token guard still applies). Later pageviews are not
 * held; one counted meanwhile queues behind the first. Custom events issued
 * before the identity settles wait in the same queue (see `trackEvent`). `data-auto-pageview`,
 * not `data-auto-track`: with auto-track off the tracker stops following
 * `pushState`, so every custom event would carry the landing page URL.
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
    BrowserAnalyticsDiagnostics,
    UmamiTracker
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

/** How long the first pageview waits for the identity before going out anonymously. */
export const FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS = 3000;

/** Input of {@link trackPageview}. */
export interface TrackPageviewInput {
    /** Absolute URL of the page being counted. */
    readonly url: string;
    /** Title of the page being counted. */
    readonly title: string;
    /** Referrer to send; omitted keeps the tracker's own (`document.referrer`). */
    readonly referrer?: string;
    /**
     * Whether the page lives under the authenticated layout, whose
     * `AuthProvider` settles the identity. Only the document's first pageview
     * reads it.
     */
    readonly awaitIdentity: boolean;
}

/** Whether the identity of this document settled (see the file header). */
let identitySettled = false;
/** Whether this document already counted its first page. */
let firstPageCounted = false;
/**
 * Pageviews and custom events waiting for the identity (or, for pageviews, the
 * tracker script), in the order they were issued.
 */
let pendingSends: Array<(tracker: UmamiTracker) => void> = [];
/** Bounded wait for the identity, while one is pending. */
let firstPageviewTimer: ReturnType<typeof setTimeout> | null = null;
/** The tracker script failed to load (ad blocker): queued sends are dropped. */
let trackerFailed = false;

function getTracker(): UmamiTracker | undefined {
    const candidate: unknown = Reflect.get(window, 'umami');
    if (typeof candidate !== 'object' || candidate === null) return undefined;
    const hasMethods =
        typeof Reflect.get(candidate, 'track') === 'function' &&
        typeof Reflect.get(candidate, 'identify') === 'function';
    return hasMethods ? (candidate as UmamiTracker) : undefined;
}

/** Whether the tracker script is present (it loads deferred, or never when blocked). */
function isTrackerPresent(): boolean {
    return typeof Reflect.get(Reflect.get(window, 'umami') ?? {}, 'identify') === 'function';
}

function sendPageview({ url, title, referrer }: TrackPageviewInput, tracker: UmamiTracker): void {
    try {
        tracker.track((defaults) => ({
            ...defaults,
            url,
            title,
            ...(referrer === undefined ? {} : { referrer })
        }));
    } catch {
        // Best-effort: analytics must never break the page.
    }
}

/** Sends everything queued once the identity settled and the tracker is present. */
function flushPageviews(): void {
    if (!identitySettled) return;
    const tracker = getTracker();
    if (!tracker) return;
    const queue = pendingSends;
    pendingSends = [];
    for (const send of queue) send(tracker);
}

/** Starts the bounded wait for the identity, once. */
function armIdentityTimeout(): void {
    if (identitySettled || firstPageviewTimer !== null) return;
    firstPageviewTimer = setTimeout(() => {
        firstPageviewTimer = null;
        settleIdentity();
    }, FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS);
}

/** The identity is settled for this document: releases the held pageviews. */
function settleIdentity(): void {
    if (firstPageviewTimer !== null) {
        clearTimeout(firstPageviewTimer);
        firstPageviewTimer = null;
    }
    identitySettled = true;
    flushPageviews();
}

/** The tracker script could not load: nothing will ever be sent. */
function dropPageviews(): void {
    trackerFailed = true;
    pendingSends = [];
    if (firstPageviewTimer !== null) {
        clearTimeout(firstPageviewTimer);
        firstPageviewTimer = null;
    }
}

/**
 * Sends the identify for `userId` unless this document already sent it or the
 * tracker already holds a cache token (an identify would then claim the
 * anonymous fingerprint session, see the file header).
 */
function identifyNow(userId: string): void {
    pendingUserId = null;
    if (identifiedUserId !== userId) {
        if (hasUmamiCacheToken({ tracker: Reflect.get(window, 'umami') })) {
            adminLogger.debug(
                '[analytics] identify skipped: tracker already holds a session token'
            );
        } else {
            identifiedUserId = userId;
            analytics.identify(userId);
        }
    }
    // Sent or skipped: the first pageview may go now.
    settleIdentity();
}

/** The tracker script loaded: delivers the pending identity, then the pageviews. */
function onTrackerLoaded(): void {
    if (pendingUserId !== null) identifyNow(pendingUserId);
    flushPageviews();
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
    script.setAttribute('data-auto-pageview', 'false');
    script.addEventListener('load', onTrackerLoaded);
    script.addEventListener('error', dropPageviews);
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
 * before init, or once the tracker script failed to load.
 *
 * Until the identity of the document settles (see the file header) the event
 * waits in the same queue as the held first pageview, in issue order: an
 * on-mount event (a tour or What's New modal shown) can fire before the router
 * counted the page and before `AuthProvider` identified, and its answer would
 * hand the tracker the token that makes the identify skip. The wait is bounded
 * by {@link FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS}. After that it is sent at once
 * (and dropped when the tracker has not loaded, as before).
 *
 * @param name - Catalog event name.
 * @param props - Event properties for that event.
 */
export function trackEvent<TName extends AnalyticsEventName>(
    name: TName,
    props: AnalyticsEventProperties<TName>
): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized || trackerFailed) return;
    if (identitySettled) {
        analytics.capture(name, props);
        return;
    }
    pendingSends.push(() => analytics.capture(name, props));
    armIdentityTimeout();
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
 * Declare that the auth state resolved without a signed-in user. Releases the
 * document's first pageview, which waits for the identity (see the file
 * header). A signed-in user goes through {@link identifyUser} instead.
 */
export function markVisitorAnonymous(): void {
    if (typeof window === 'undefined') return;
    settleIdentity();
}

/**
 * Count a page. Called by the router (`UmamiPageviews`) on the initial load and
 * after every navigation. The document's first pageview waits, when
 * `awaitIdentity` is set, until the identity settles or
 * {@link FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS} elapses; later ones go out as soon
 * as the tracker is present (behind a still-held first one). No-op on the
 * server, before init and once the tracker script failed to load.
 *
 * @param input - URL, title and referrer of the page, and whether it may wait.
 */
export function trackPageview(input: TrackPageviewInput): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized || trackerFailed) return;
    pendingSends.push((tracker) => sendPageview(input, tracker));
    if (!firstPageCounted) {
        firstPageCounted = true;
        if (!input.awaitIdentity) {
            settleIdentity();
            return;
        }
        armIdentityTimeout();
    }
    flushPageviews();
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
    settleIdentity();
    if (!isInitialized) return;
    analytics.reset();
}

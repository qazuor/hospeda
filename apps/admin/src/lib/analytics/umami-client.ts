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
import { createBrowserAnalytics, createUmamiBrowserClient } from '@repo/analytics';
import { env } from '@/env';
import { getCspNonceOnClient } from '@/lib/csp-nonce';
import { adminLogger } from '@/utils/logger';

/**
 * Singleton flag so the tracker script is injected at most once, even when
 * React strict mode or several entry points call `initUmami()`.
 */
let isInitialized = false;

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
 * @param userId - Stable user ID (Better Auth user.id).
 */
export function identifyUser(userId: string): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    analytics.identify(userId);
}

/**
 * Clear the identified user on sign-out. Umami derives sessions server-side
 * and has no reset API, so this is a harmless no-op kept for call-site parity.
 */
export function resetUser(): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    analytics.reset();
}

/**
 * @file posthog-client.ts
 * @description PostHog browser client for the admin dashboard.
 *
 * Uses the ESM-only pattern (no inline snippet) because the admin is internal,
 * authenticated, and runs after the React tree mounts — we never need PostHog
 * stub-and-replay before the bundle finishes loading. This avoids the
 * snippet+ESM collision the web app hit in SPEC-140.
 *
 * Initialization is gated by:
 *   - `import.meta.env.DEV` → skip in dev so `pnpm dev` never POSTs to PostHog.
 *   - `env.VITE_POSTHOG_KEY` presence → skip when the key is unset (local
 *     builds, CI). Same gating shape as `sentry.config.ts`.
 *
 * No cookie-consent banner runs in admin — staff users are authenticated and
 * covered by an internal usage notice. We still set `respect_dnt: true` so a
 * user who has set the browser's Do-Not-Track header is excluded, and we
 * disable session recording by default because the admin panel surfaces
 * customer PII (user profiles, billing data) that should not be replayed.
 *
 * Call sites should import `trackEvent` from this module rather than touching
 * `posthog` directly. Keeping the import surface narrow makes it easy to
 * swap the SDK or add server-side filtering later.
 *
 * @example
 * ```ts
 * // Call once at app startup (already wired in __root.tsx).
 * import { initPostHog, trackEvent } from '@/lib/analytics/posthog-client';
 * initPostHog();
 *
 * // From any component or service:
 * trackEvent('admin.accommodation.published', { accommodationId });
 * ```
 */

import type {
    AnalyticsEventName,
    AnalyticsEventProperties,
    AnalyticsPersonProperties,
    BrowserAnalyticsDiagnostics
} from '@repo/analytics';
import { buildAnalyticsGlobalProperties, createBrowserAnalytics } from '@repo/analytics';
import posthog from 'posthog-js';
import { env } from '@/env';
import { adminLogger } from '@/utils/logger';

/**
 * Default PostHog Cloud ingestion endpoint when the env var is unset.
 * Matches the web app's default so both surfaces stay in the US region.
 */
const DEFAULT_HOST = 'https://us.i.posthog.com';

/**
 * Singleton flag to prevent double-init when React 18 strict mode mounts
 * components twice. Safe to call `initPostHog()` from multiple effects.
 */
let isInitialized = false;

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
    getClient: () => (typeof window === 'undefined' ? undefined : posthog),
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
 * Check whether PostHog should be initialized given the current build mode
 * and environment configuration. Returns `false` (and logs why) when any
 * gate is closed.
 */
function shouldInitialize(): boolean {
    // posthog-js is browser-only — calling posthog.init() during Nitro SSR
    // crashes the node-server bundle with `init is not a function` because
    // the package's default export is a no-op stub on the server side.
    if (typeof window === 'undefined') {
        return false;
    }
    if (import.meta.env.DEV) {
        adminLogger.debug('[PostHog] Skipping initialization in development');
        return false;
    }
    if (!env.VITE_POSTHOG_KEY) {
        adminLogger.warn('[PostHog] VITE_POSTHOG_KEY not set; analytics disabled');
        return false;
    }
    return true;
}

/**
 * Initialize the PostHog browser SDK.
 *
 * Idempotent: subsequent calls after the first successful init are no-ops.
 * Safe to call from any client-only entry point (root effect, route loader).
 */
export function initPostHog(): void {
    if (isInitialized) return;
    if (!shouldInitialize()) return;

    posthog.init(env.VITE_POSTHOG_KEY as string, {
        api_host: env.VITE_POSTHOG_HOST ?? DEFAULT_HOST,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        capture_pageleave: false,
        autocapture: false,
        disable_session_recording: true,
        respect_dnt: true,
        loaded: (instance) => {
            instance.register(
                buildAnalyticsGlobalProperties({
                    app: 'admin',
                    app_version: env.VITE_APP_VERSION,
                    environment: resolveBrowserEnvironment()
                })
            );
        }
    });

    isInitialized = true;
    adminLogger.info('[PostHog] Initialized');
}

/**
 * Whether `initPostHog()` has run successfully in this browser session.
 * Useful for tests and for guards in code paths that depend on PostHog
 * being live.
 */
export function isPostHogInitialized(): boolean {
    return isInitialized;
}

/**
 * Capture a custom analytics event.
 *
 * Safe to call before `initPostHog()` resolves — posthog-js queues events
 * internally until init completes. Returns silently on the server (where
 * `window` is undefined) so it is callable from isomorphic code.
 *
 * @param name - Event name. Convention: `admin.<domain>.<verb>`.
 * @param props - Optional properties serialized to PostHog as-is. Avoid
 *   sending personally identifiable customer data; use generic identifiers.
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
 * Identify the current admin user to PostHog so events are grouped per
 * staff member. Call after the auth session is resolved.
 *
 * @param userId - Stable user ID (Better Auth user.id).
 * @param props - Optional user properties (role, email, name).
 */
export function identifyUser(userId: string, props?: AnalyticsPersonProperties): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    analytics.identify(userId, props);
}

/**
 * Clear the identified user. Call on sign-out so subsequent events from
 * the same browser are not attributed to the previous user.
 */
export function resetUser(): void {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;
    analytics.reset();
}

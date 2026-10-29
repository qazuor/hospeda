/**
 * Sentry Configuration
 *
 * Initializes Sentry for error tracking and performance monitoring.
 * Only runs in production environment.
 *
 * @example
 * ```typescript
 * // In __root.tsx
 * import { initSentry } from '@/lib/sentry/sentry.config';
 *
 * // Initialize in root component
 * if (typeof window !== 'undefined') {
 *   initSentry();
 * }
 * ```
 */

import { anonymizeEmail } from '@repo/utils';
import type { BrowserOptions, ErrorEvent } from '@sentry/react';
import * as Sentry from '@sentry/react';
import { env } from '@/env';
import { adminLogger } from '../../utils/logger';

/**
 * Sentry configuration options
 */
export interface SentryConfig {
    /** Sentry DSN from environment */
    readonly dsn: string | undefined;
    /** Application environment */
    readonly environment: string;
    /** Application release/version */
    readonly release: string | undefined;
    /** Sample rate for traces (0.0 - 1.0) */
    readonly tracesSampleRate: number;
    /** Sample rate for session replays on error (0.0 - 1.0) */
    readonly replaysOnErrorSampleRate: number;
    /** Sample rate for session replays (0.0 - 1.0) */
    readonly replaysSessionSampleRate: number;
}

/**
 * Get Sentry configuration from environment
 */
function getSentryConfig(): SentryConfig {
    return {
        dsn: env.VITE_SENTRY_DSN,
        // Prefer VITE_SENTRY_ENVIRONMENT over MODE so staging and prod (both
        // MODE=production) end up in different Sentry environments. Falls
        // back to MODE when the explicit override is unset.
        environment: env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development',
        // Read VITE_SENTRY_RELEASE with `||` (not `??`) so empty strings from
        // Coolify also fall through to the 'development' default. Matches the
        // web pattern in apps/web/sentry.client.config.ts. VITE_APP_VERSION is
        // intentionally NOT used as a fallback — it defaults to '1.0.0' for
        // every deploy and would defeat per-deploy release tracking. Operators
        // should set VITE_SENTRY_RELEASE to the deploy's git SHA in Coolify
        // (SPEC-146).
        release: env.VITE_SENTRY_RELEASE || 'development',
        // Performance monitoring
        tracesSampleRate: 0.1, // 10% of transactions
        // Session replay
        replaysOnErrorSampleRate: 1.0, // 100% when error occurs
        replaysSessionSampleRate: 0.1 // 10% of sessions
    };
}

/**
 * Header names/fragments never sent to Sentry (matched as substrings,
 * case-insensitive). Same list as the API (HOS-1892).
 */
const DENIED_HEADER_FRAGMENTS: string[] = [
    'authorization',
    'cookie',
    'token',
    'api-key',
    'apikey',
    'csrf',
    'forwarded',
    '-ip',
    'remote-',
    'via',
    '-user'
];

/**
 * Explicit Sentry v11 `dataCollection` policy for the admin.
 *
 * v11 defaults collect cookies, request/response bodies, user info and URL
 * query params. The admin sends NONE of those: no cookies, no auth headers, no
 * HTTP bodies, no automatic user info (the user is set manually via
 * `setSentryUser` with an anonymized email) and no URL query params.
 *
 * Exported so tests pin it.
 */
export const SENTRY_DATA_COLLECTION: NonNullable<BrowserOptions['dataCollection']> = {
    userInfo: false,
    cookies: false,
    httpHeaders: {
        request: { deny: DENIED_HEADER_FRAGMENTS },
        response: { deny: [...DENIED_HEADER_FRAGMENTS, 'set-cookie'] }
    },
    httpBodies: [],
    // Empty allowlist: NO query param is collected (auth callbacks carry
    // code, state, token, etc.).
    urlQueryParams: { allow: [] }
};

/**
 * Strip the query string and fragment from a URL-like string.
 */
function stripQueryAndFragment(url: string): string {
    const index = url.search(/[?#]/);
    return index === -1 ? url : url.slice(0, index);
}

/**
 * `beforeSend` scrubber: drops sensitive headers and, as defense in depth on
 * top of `dataCollection`, never ships a query string or fragment.
 *
 * Exported so it is unit-testable independently of `Sentry.init()`.
 */
export function applyBeforeSend(event: ErrorEvent): ErrorEvent {
    if (event.request?.headers) {
        const {
            Authorization: _auth,
            Cookie: _cookie,
            'X-Auth-Token': _token,
            ...cleanHeaders
        } = event.request.headers;
        event.request.headers = cleanHeaders;
    }

    if (event.request) {
        if ('query_string' in event.request) {
            const { query_string: _queryString, ...safeRequest } = event.request;
            event.request = safeRequest;
        }
        if (typeof event.request.url === 'string') {
            event.request.url = stripQueryAndFragment(event.request.url);
        }
    }

    return event;
}

/**
 * Project identification for multi-project Sentry organization
 */
const PROJECT_TAGS = {
    project: env.VITE_SENTRY_PROJECT ?? 'hospeda',
    app_type: 'admin'
};

/**
 * Check if Sentry should be initialized
 */
function shouldInitializeSentry(): boolean {
    // @sentry/react targets the browser. Its integrations (browserTracing,
    // replay) reach for `window`/DOM APIs and the SDK is not safe to init in
    // Nitro's node-server SSR bundle. Server-side error tracking should go
    // through the API's own Sentry middleware, not the React SDK.
    if (typeof window === 'undefined') {
        return false;
    }

    const config = getSentryConfig();

    // Only initialize in production with valid DSN
    if (import.meta.env.DEV) {
        adminLogger.debug('[Sentry] Skipping initialization in development');
        return false;
    }

    if (!config.dsn) {
        adminLogger.warn('[Sentry] DSN not configured. Set VITE_SENTRY_DSN to enable.');
        return false;
    }

    return true;
}

/**
 * Flag to track initialization status
 */
let isInitialized = false;

/**
 * Initialize Sentry error tracking
 *
 * Should be called once at application startup.
 * Safe to call multiple times (will only initialize once).
 */
export function initSentry(): void {
    if (isInitialized) {
        return;
    }

    if (!shouldInitializeSentry()) {
        return;
    }

    const config = getSentryConfig();

    Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,

        // Project identification tags for multi-project filtering
        initialScope: {
            tags: PROJECT_TAGS
        },

        // Performance Monitoring
        tracesSampleRate: config.tracesSampleRate,

        // Session Replay
        replaysSessionSampleRate: config.replaysSessionSampleRate,
        replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,

        // Integrations
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                // Privacy hardening (production launch, real users' PII):
                // mask all text content for privacy
                maskAllText: true,
                // Block all media (images, videos) — may include user uploads
                // (accommodation photos, avatars) or other sensitive content
                blockAllMedia: true
            })
        ],

        // v11 `dataCollection` defaults are permissive. Pin the restrictive
        // v10 posture explicitly.
        dataCollection: SENTRY_DATA_COLLECTION,

        // Filter out sensitive data (headers, query string, fragment)
        beforeSend: applyBeforeSend,

        // Filter breadcrumbs
        beforeBreadcrumb(breadcrumb) {
            // Filter out noisy console logs
            if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
                return null;
            }
            return breadcrumb;
        }
    });

    isInitialized = true;
    adminLogger.info('[Sentry] Initialized successfully');
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
    return isInitialized;
}

/**
 * Set user context in Sentry.
 *
 * The email is anonymized (domain-only) before being attached to the Sentry
 * scope — never the raw address — so Sentry issues never leak PII while
 * still letting support cross-reference the user id.
 */
export function setSentryUser(
    user: { id: string; email?: string; username?: string } | null
): void {
    if (!isInitialized) return;

    if (user) {
        Sentry.setUser({
            id: user.id,
            email: user.email ? anonymizeEmail(user.email) : undefined,
            username: user.username
        });
    } else {
        Sentry.setUser(null);
    }
}

/**
 * Add custom tags to Sentry context
 */
export function setSentryTags(tags: Record<string, string>): void {
    if (!isInitialized) return;

    for (const [key, value] of Object.entries(tags)) {
        Sentry.setTag(key, value);
    }
}

/**
 * Capture an error with Sentry
 */
export function captureError(
    error: Error | string,
    context?: {
        level?: Sentry.SeverityLevel;
        tags?: Record<string, string>;
        extra?: Record<string, unknown>;
    }
): string | undefined {
    if (!isInitialized) {
        adminLogger.error('[Sentry] Not initialized, error not captured:', error);
        return undefined;
    }

    const eventId = Sentry.captureException(error, {
        level: context?.level ?? 'error',
        tags: context?.tags,
        extra: context?.extra
    });

    return eventId;
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info'
): string | undefined {
    if (!isInitialized) {
        return undefined;
    }

    return Sentry.captureMessage(message, level);
}

// Re-export Sentry for direct access when needed
export { Sentry };

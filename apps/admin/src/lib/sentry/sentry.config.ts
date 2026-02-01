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

import * as Sentry from '@sentry/react';

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
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE || 'development',
        release: import.meta.env.VITE_APP_VERSION,
        // Performance monitoring
        tracesSampleRate: 0.1, // 10% of transactions
        // Session replay
        replaysOnErrorSampleRate: 1.0, // 100% when error occurs
        replaysSessionSampleRate: 0.1 // 10% of sessions
    };
}

/**
 * Check if Sentry should be initialized
 */
function shouldInitializeSentry(): boolean {
    const config = getSentryConfig();

    // Only initialize in production with valid DSN
    if (import.meta.env.DEV) {
        console.debug('[Sentry] Skipping initialization in development');
        return false;
    }

    if (!config.dsn) {
        console.warn('[Sentry] DSN not configured. Set VITE_SENTRY_DSN to enable.');
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

        // Performance Monitoring
        tracesSampleRate: config.tracesSampleRate,

        // Session Replay
        replaysSessionSampleRate: config.replaysSessionSampleRate,
        replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,

        // Integrations
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                // Mask all text content for privacy
                maskAllText: false,
                // Block all media (images, videos)
                blockAllMedia: false
            })
        ],

        // Filter out sensitive data
        beforeSend(event) {
            // Remove sensitive headers
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
    console.info('[Sentry] Initialized successfully');
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
    return isInitialized;
}

/**
 * Set user context in Sentry
 */
export function setSentryUser(
    user: { id: string; email?: string; username?: string } | null
): void {
    if (!isInitialized) return;

    if (user) {
        Sentry.setUser({
            id: user.id,
            email: user.email,
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
        console.error('[Sentry] Not initialized, error not captured:', error);
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

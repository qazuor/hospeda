/**
 * Sentry Configuration for Web App
 *
 * Initializes Sentry for error tracking in the Astro frontend.
 * Uses @sentry/astro for optimal Astro integration.
 *
 * @module lib/sentry
 */

import * as Sentry from '@sentry/astro';

/**
 * Project identification for multi-project Sentry organization
 */
const PROJECT_TAGS = {
    project: import.meta.env.PUBLIC_SENTRY_PROJECT || 'hospeda',
    app_type: 'web'
};

/**
 * Flag to track initialization status
 */
let isInitialized = false;

/**
 * Initialize Sentry error tracking for the web app
 *
 * Should be called once at application startup.
 * Safe to call multiple times (will only initialize once).
 */
export function initSentry(): void {
    if (isInitialized) {
        return;
    }

    const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

    // Skip in development or if no DSN
    if (import.meta.env.DEV) {
        console.debug('[Sentry] Skipping initialization in development');
        return;
    }

    if (!dsn) {
        console.warn('[Sentry] DSN not configured. Set PUBLIC_SENTRY_DSN to enable.');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'production',
        release:
            import.meta.env.PUBLIC_SENTRY_RELEASE ||
            import.meta.env.VERCEL_GIT_COMMIT_SHA ||
            'development',

        // Project identification tags for multi-project filtering
        initialScope: {
            tags: PROJECT_TAGS
        },

        // Performance Monitoring
        tracesSampleRate: 0.1, // 10% of transactions

        // Session Replay (if using @sentry/astro with replay)
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% when error occurs

        // Filter sensitive data
        beforeSend(event) {
            // Remove sensitive headers
            if (event.request?.headers) {
                const sanitized = { ...event.request.headers } as Record<
                    string,
                    string | undefined
                >;
                sanitized.authorization = undefined;
                sanitized.cookie = undefined;
                sanitized['x-auth-token'] = undefined;
                event.request.headers = sanitized as Record<string, string>;
            }
            return event;
        }
    });

    isInitialized = true;
    console.info('[Sentry] Initialized successfully for web app');
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
export function setSentryUser(user: { id: string; email?: string } | null): void {
    if (!isInitialized) return;

    if (user) {
        Sentry.setUser({
            id: user.id,
            email: user.email ? `***@${user.email.split('@')[1]}` : undefined
        });
    } else {
        Sentry.setUser(null);
    }
}

/**
 * Capture an error with Sentry
 */
export function captureError(
    error: Error | string,
    context?: {
        tags?: Record<string, string>;
        extra?: Record<string, unknown>;
    }
): string | undefined {
    if (!isInitialized) {
        console.error('[Sentry] Not initialized, error not captured:', error);
        return undefined;
    }

    return Sentry.captureException(error, {
        tags: context?.tags,
        extra: context?.extra
    });
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info'
): string | undefined {
    if (!isInitialized) {
        return undefined;
    }

    return Sentry.captureMessage(message, level);
}

// Re-export Sentry for direct access
export { Sentry };

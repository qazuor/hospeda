/**
 * PostHog Server Client — lazy singleton for AI event analytics (SPEC-173 T-035).
 *
 * Provides a lazily-initialised server-side PostHog Node.js client for recording
 * product analytics events (AI feature usage, reliability dashboards, moderation
 * outcomes). The client is a no-op when `HOSPEDA_POSTHOG_KEY` is not set, so the
 * service degrades gracefully in development or when analytics are intentionally
 * disabled.
 *
 * ## Lifecycle
 *
 * The client is created on first access via {@link getPostHogClient}. It is flushed
 * and shut down during graceful server shutdown via {@link shutdownPostHog}, which is
 * registered in `apps/api/src/index.ts` alongside the Sentry flush.
 *
 * ## Server-side batching
 *
 * `flushAt: 20` and `flushInterval: 10_000` (10 s) are chosen for server batching:
 * - Low-traffic AI features benefit from a longer interval to avoid per-event HTTP
 *   round-trips to PostHog.
 * - The flush-on-shutdown call in {@link shutdownPostHog} ensures no events are lost
 *   when the process exits.
 *
 * @module lib/posthog
 */

import { PostHog } from 'posthog-node';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Batch size before flushing to PostHog (default PostHog Node default is 20). */
const FLUSH_AT = 20;

/** Interval in ms between automatic flushes. */
const FLUSH_INTERVAL_MS = 10_000;

/** Timeout in ms for the shutdown flush call. */
const SHUTDOWN_FLUSH_TIMEOUT_MS = 3_000;

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

/** Module-level singleton — null until first access, or permanently null when disabled. */
let _client: PostHog | null = null;
/** Set to true once we have tried to initialise (prevents re-init after explicit shutdown). */
let _initialised = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the singleton PostHog server client, or `null` when PostHog is disabled
 * (i.e. `HOSPEDA_POSTHOG_KEY` is not set in the environment).
 *
 * The client is initialised lazily on first call.  Subsequent calls return the
 * cached instance.  After {@link shutdownPostHog} has been called the function
 * always returns `null`.
 *
 * @returns The PostHog client, or `null` when disabled.
 *
 * @example
 * ```ts
 * const ph = getPostHogClient();
 * if (ph) {
 *   ph.capture({ distinctId: 'api-server', event: 'ai_feature_used', properties: { feature: 'text_improve' } });
 * }
 * ```
 */
export function getPostHogClient(): PostHog | null {
    if (_initialised) {
        return _client;
    }

    _initialised = true;

    const apiKey = env.HOSPEDA_POSTHOG_KEY;
    if (!apiKey) {
        apiLogger.debug('PostHog: HOSPEDA_POSTHOG_KEY not set — AI event analytics disabled');
        _client = null;
        return null;
    }

    const host = env.HOSPEDA_POSTHOG_HOST ?? 'https://us.i.posthog.com';

    try {
        _client = new PostHog(apiKey, {
            host,
            flushAt: FLUSH_AT,
            flushInterval: FLUSH_INTERVAL_MS
        });
        apiLogger.info({ host }, 'PostHog: server-side AI event analytics client initialised');
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'PostHog: failed to initialise client — AI event analytics disabled'
        );
        _client = null;
    }

    return _client;
}

/**
 * Returns `true` when the PostHog client is initialised and ready to accept events.
 *
 * @returns Whether PostHog is enabled.
 *
 * @example
 * ```ts
 * if (isPostHogEnabled()) {
 *   // safe to call getPostHogClient()
 * }
 * ```
 */
export function isPostHogEnabled(): boolean {
    return getPostHogClient() !== null;
}

/**
 * Flushes pending events and shuts down the PostHog client.
 *
 * Should be called during graceful server shutdown (SIGTERM/SIGINT) to ensure
 * no events are lost.  Safe to call multiple times — subsequent calls are no-ops.
 *
 * Shutdown is registered in `apps/api/src/index.ts` alongside `closeSentry()`
 * in the `gracefulShutdown` handler.
 *
 * @returns Promise that resolves when the flush is complete (or immediately when
 *   PostHog is disabled).
 *
 * @example
 * ```ts
 * // In gracefulShutdown handler:
 * await shutdownPostHog();
 * await closeSentry(2000);
 * ```
 */
export async function shutdownPostHog(): Promise<void> {
    const client = _client;
    if (client === null) {
        return;
    }

    // Mark as shut down before awaiting so re-entrant calls are no-ops.
    _client = null;

    try {
        await client.shutdown(SHUTDOWN_FLUSH_TIMEOUT_MS);
        apiLogger.debug('PostHog: client shut down, pending events flushed');
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'PostHog: error during shutdown flush (events may be lost)'
        );
    }
}

/**
 * Resets the singleton state.
 *
 * FOR TESTING ONLY — allows test suites to re-initialise the client between cases.
 * Never call this in production code.
 *
 * @internal
 */
export function _resetPostHogClientForTests(): void {
    _client = null;
    _initialised = false;
}

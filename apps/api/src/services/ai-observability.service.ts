/**
 * AI Observability Sink (SPEC-173 T-035).
 *
 * Creates the `recordEvent` callback that is injected into `createAiService` via
 * the factory.  The sink fans out each {@link AiEngineEvent} to structured logging,
 * Sentry (for reliability/alerting), and PostHog (for product analytics).
 *
 * ## Design: fire-and-forget
 *
 * The returned callback is SYNCHRONOUS from the engine's perspective (matches the
 * `recordEvent?: (event: AiEngineEvent) => void` contract).  All async work
 * (Sentry + PostHog captures) is enqueued with `void asyncHandle(...)` and never
 * throws back to the engine.
 *
 * ## AC-4 compliance
 *
 * This file lives in `apps/api`, NOT in `packages/ai-core`.  The ai-core package
 * has zero knowledge of Sentry or PostHog.  The sink is injected at the
 * `createConfiguredAiService()` call site in `ai-service.factory.ts`.
 *
 * ## PII safety (AC-11)
 *
 * Any free-text field that might contain user content (fallback provider error
 * messages, moderation error messages) MUST pass through {@link scrubPii} before
 * being attached to an external telemetry payload.  Enum-like fields (feature,
 * providerId, direction, categories) are safe and are passed as-is.
 *
 * ## PostHog distinctId
 *
 * AI engine events carry NO userId — the engine is a shared infrastructure layer.
 * A stable server identity (`'api-server'`) is used as the `distinctId` for all
 * PostHog captures from this sink.  Per-user attribution will arrive separately
 * from the user-facing route layer (children specs), which can call
 * `ph.capture({ distinctId: userId, ... })` directly or via a route-level hook.
 *
 * @module services/ai-observability
 */

import type { AiEngineEvent } from '@repo/ai-core';
import { scrubPii } from '@repo/ai-core';
import { getPostHogClient } from '../lib/posthog.js';
import { Sentry, isSentryEnabled } from '../lib/sentry.js';
import { apiLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Stable server-side `distinctId` used for PostHog captures from this sink.
 * Per-user attribution is the responsibility of user-facing route handlers.
 */
const POSTHOG_DISTINCT_ID = 'api-server';

// ---------------------------------------------------------------------------
// Internal async handlers (one per event type)
// ---------------------------------------------------------------------------

/**
 * Handles Sentry + PostHog side-effects for a `fallback` event.
 *
 * Spec §5.3: fallback = breadcrumb (NOT exception).  The provider error message
 * is scrubbed via `scrubPii` before being attached to the breadcrumb.
 *
 * @param event - The fallback event.
 */
async function handleFallback(event: {
    readonly type: 'fallback';
    readonly feature: string;
    readonly fromProvider: string;
    readonly toProvider: string;
    readonly error: Error;
}): Promise<void> {
    const scrubbedMessage = scrubPii({ text: event.error.message }).scrubbed;

    if (isSentryEnabled()) {
        Sentry.addBreadcrumb({
            category: 'ai',
            message: `AI fallback: ${event.feature} ${event.fromProvider} → ${event.toProvider} (${scrubbedMessage})`,
            level: 'warning',
            data: {
                feature: event.feature,
                fromProvider: event.fromProvider,
                toProvider: event.toProvider,
                error: scrubbedMessage
            }
        });
    }

    const ph = getPostHogClient();
    if (ph) {
        ph.capture({
            distinctId: POSTHOG_DISTINCT_ID,
            event: 'ai_fallback',
            properties: {
                feature: event.feature,
                from_provider: event.fromProvider,
                to_provider: event.toProvider
            }
        });
    }
}

/**
 * Handles Sentry + PostHog side-effects for an `exhausted` event.
 *
 * All providers failed — treated as a real error in Sentry.
 *
 * @param event - The exhausted event.
 */
async function handleExhausted(event: {
    readonly type: 'exhausted';
    readonly feature: string;
}): Promise<void> {
    if (isSentryEnabled()) {
        Sentry.captureMessage(`AI all providers exhausted for feature '${event.feature}'`, {
            level: 'error',
            tags: {
                module: 'ai',
                feature: event.feature
            }
        });
    }

    const ph = getPostHogClient();
    if (ph) {
        ph.capture({
            distinctId: POSTHOG_DISTINCT_ID,
            event: 'ai_call_exhausted',
            properties: {
                feature: event.feature
            }
        });
    }
}

/**
 * Handles Sentry + PostHog side-effects for a `kill_switch` event.
 *
 * Kill-switch = expected behavior, not an error.  Sentry breadcrumb only (info level).
 *
 * @param event - The kill_switch event.
 */
async function handleKillSwitch(event: {
    readonly type: 'kill_switch';
    readonly feature: string;
}): Promise<void> {
    if (isSentryEnabled()) {
        Sentry.addBreadcrumb({
            category: 'ai',
            message: `AI kill switch active for feature '${event.feature}'`,
            level: 'info',
            data: {
                feature: event.feature
            }
        });
    }

    const ph = getPostHogClient();
    if (ph) {
        ph.capture({
            distinctId: POSTHOG_DISTINCT_ID,
            event: 'ai_kill_switch_hit',
            properties: {
                feature: event.feature
            }
        });
    }
}

/**
 * Handles Sentry side-effects for a `moderation_error` event.
 *
 * Moderation outage must be visible in Sentry (warning level).  The error message
 * is scrubbed via `scrubPii`.  No PostHog event — this is infrastructure noise,
 * not a product analytics signal.
 *
 * @param event - The moderation_error event.
 */
async function handleModerationError(event: {
    readonly type: 'moderation_error';
    readonly feature: string;
    readonly direction: 'input' | 'output';
    readonly errorMessage: string;
}): Promise<void> {
    const scrubbedMessage = scrubPii({ text: event.errorMessage }).scrubbed;

    if (isSentryEnabled()) {
        Sentry.captureMessage(
            `AI moderation error on ${event.direction} for feature '${event.feature}': ${scrubbedMessage}`,
            {
                level: 'warning',
                tags: {
                    module: 'ai',
                    feature: event.feature,
                    direction: event.direction
                }
            }
        );
    }
}

/**
 * Handles PostHog side-effects for a `moderation_blocked` event.
 *
 * Moderation blocks are EXPECTED policy outcomes — no Sentry.  PostHog captures the
 * event for product-side moderation analytics.  The `categories` object contains
 * boolean flags (safe to include — no PII).
 *
 * @param event - The moderation_blocked event.
 */
async function handleModerationBlocked(event: {
    readonly type: 'moderation_blocked';
    readonly feature: string;
    readonly direction: 'input' | 'output';
    readonly categories: Record<string, boolean>;
}): Promise<void> {
    const ph = getPostHogClient();
    if (ph) {
        ph.capture({
            distinctId: POSTHOG_DISTINCT_ID,
            event: 'ai_moderation_blocked',
            properties: {
                feature: event.feature,
                direction: event.direction,
                categories: event.categories
            }
        });
    }
}

/**
 * Handles PostHog side-effects for a `success` event.
 *
 * Records per-feature AI usage for product analytics (spec §5.13).
 *
 * @param event - The success event.
 */
async function handleSuccess(event: {
    readonly type: 'success';
    readonly feature: string;
    readonly providerId: string;
}): Promise<void> {
    const ph = getPostHogClient();
    if (ph) {
        ph.capture({
            distinctId: POSTHOG_DISTINCT_ID,
            event: 'ai_feature_used',
            properties: {
                feature: event.feature,
                provider: event.providerId
            }
        });
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the AI observability sink — the `recordEvent` callback for injection
 * into `createAiService`.
 *
 * The returned function is SYNCHRONOUS (matches the engine contract).  Internally
 * it dispatches async side-effects via `void asyncHandle(...)` and NEVER throws.
 *
 * ## Behavior per event type
 *
 * | Event type          | Logger   | Sentry                       | PostHog                  |
 * |---------------------|----------|------------------------------|--------------------------|
 * | `success`           | debug    | —                            | `ai_feature_used`        |
 * | `fallback`          | debug    | breadcrumb (warning)         | `ai_fallback`            |
 * | `exhausted`         | debug    | captureMessage (error)       | `ai_call_exhausted`      |
 * | `kill_switch`       | debug    | breadcrumb (info)            | `ai_kill_switch_hit`     |
 * | `moderation_error`  | debug    | captureMessage (warning)     | —                        |
 * | `moderation_blocked`| debug    | —                            | `ai_moderation_blocked`  |
 *
 * @returns A synchronous `(event: AiEngineEvent) => void` callback.
 *
 * @example
 * ```ts
 * // In ai-service.factory.ts:
 * const recordEvent = createAiObservabilityRecordEvent();
 * return createAiService({ ..., recordEvent });
 * ```
 */
export function createAiObservabilityRecordEvent(): (event: AiEngineEvent) => void {
    return (event: AiEngineEvent): void => {
        // ALL events: preserve the existing structured debug log.
        apiLogger.debug(
            {
                aiEngineEvent: event.type,
                feature: 'feature' in event ? event.feature : undefined
            },
            'ai-engine event'
        );

        // Dispatch async side-effects — fire-and-forget, never throws.
        void (async () => {
            try {
                switch (event.type) {
                    case 'success':
                        await handleSuccess(event);
                        break;
                    case 'fallback':
                        await handleFallback(event);
                        break;
                    case 'exhausted':
                        await handleExhausted(event);
                        break;
                    case 'kill_switch':
                        await handleKillSwitch(event);
                        break;
                    case 'moderation_error':
                        await handleModerationError(event);
                        break;
                    case 'moderation_blocked':
                        await handleModerationBlocked(event);
                        break;
                    default: {
                        // Exhaustive type guard — the compiler will error here if
                        // a new AiEngineEvent variant is added without handling it.
                        const _exhaustive: never = event;
                        apiLogger.warn(
                            { aiEngineEvent: (_exhaustive as { type: string }).type },
                            'ai-observability: unhandled AiEngineEvent type (sink update needed)'
                        );
                    }
                }
            } catch (error) {
                // Best-effort: swallow ALL errors from the sink so the engine call
                // is never affected by observability failures.
                apiLogger.warn(
                    {
                        aiEngineEvent: event.type,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'ai-observability: sink error swallowed (non-fatal)'
                );
            }
        })();
    };
}

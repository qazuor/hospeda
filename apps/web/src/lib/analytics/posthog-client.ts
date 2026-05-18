/**
 * @file posthog-client.ts
 * @description Single source of truth for PostHog SDK initialization in the
 * web app (SPEC-140).
 *
 * Consent + dev gating model:
 *
 * | State                                | Init?     | Persistence              |
 * | ------------------------------------ | --------- | ------------------------ |
 * | Server-side (no window)              | skip      | n/a                      |
 * | PUBLIC_POSTHOG_KEY unset             | skip      | n/a                      |
 * | import.meta.env.MODE === development | skip      | n/a                      |
 * | analytics consent === true           | yes       | localStorage + cookie    |
 * | analytics consent !== true (or null) | yes       | memory (cookieless)      |
 *
 * The cookieless fallback (memory persistence) ensures pageviews are still
 * collected for visitors who decline analytics OR haven't seen the consent
 * banner yet — without ever setting a `ph_*` cookie or writing to local
 * storage. PostHog stays SOC 2 / GDPR friendly in this mode because no
 * identifier is persisted across sessions.
 *
 * Session recordings are explicitly disabled at launch (privacy + bandwidth
 * + legal review burden — toggle in PostHog UI later if needed).
 *
 * The trackEvent() wrapper is a no-op when PostHog hasn't been initialized
 * so call sites don't need to guard. Event names should come from the typed
 * catalog in `./events.ts` rather than literals.
 */

import posthog from 'posthog-js';
import type { ConsentState } from '../cookie-consent';
import { getPostHogHost, getPostHogKey, isDevelopment } from '../env';

/** Fallback ingestion endpoint when PUBLIC_POSTHOG_HOST is unset. */
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

/** Tracks whether posthog.init() has been called successfully on this page. */
let initialized = false;

/**
 * Initialize PostHog with the provided consent state.
 *
 * Idempotent within a single page: a second call with the same consent is
 * a no-op. A second call with a CHANGED consent state will reset the SDK
 * and re-init with the new persistence mode — useful when the user updates
 * their preferences without a full page reload.
 *
 * Safe to call on the server (returns early when `window` is undefined).
 *
 * @param consent - The current consent state, or null when no decision recorded.
 */
export function initPostHog({
    consent
}: {
    readonly consent: ConsentState | null;
}): void {
    if (typeof window === 'undefined') return;

    const key = getPostHogKey();
    if (!key) return;

    if (isDevelopment()) return;

    if (initialized) return;

    const analyticsAllowed = consent?.analytics === true;
    const apiHost = getPostHogHost() ?? DEFAULT_POSTHOG_HOST;

    posthog.init(key, {
        api_host: apiHost,
        person_profiles: 'identified_only',
        capture_pageview: true,
        autocapture: true,
        disable_session_recording: true,
        persistence: analyticsAllowed ? 'localStorage+cookie' : 'memory',
        disable_persistence: false,
        respect_dnt: true
    });

    initialized = true;
}

/**
 * Re-initialize PostHog with a new consent state.
 *
 * Resets any existing identity + persisted state and re-inits with the new
 * persistence mode. Intended to be called from the cookie consent banner
 * after the user updates preferences mid-session (so they don't have to
 * wait for the next page navigation for the new mode to take effect).
 *
 * If PostHog has not been initialized yet (e.g. dev mode, missing key)
 * this falls through to a normal init attempt.
 *
 * @param consent - The new consent state, or null when no decision recorded.
 */
export function setConsent(consent: ConsentState | null): void {
    if (typeof window === 'undefined') return;

    if (initialized) {
        posthog.reset();
        initialized = false;
    }

    initPostHog({ consent });
}

/**
 * Capture a custom event. No-op when PostHog has not been initialized
 * (so call sites don't need to guard on consent / dev mode / missing key).
 *
 * Prefer importing event names from `./events.ts` over passing string
 * literals — the catalog makes the event surface discoverable + typed.
 *
 * @param name - Event name (use values from {@link ./events}).
 * @param props - Optional event properties; serialized to PostHog as-is.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
    if (!initialized) return;
    posthog.capture(name, props);
}

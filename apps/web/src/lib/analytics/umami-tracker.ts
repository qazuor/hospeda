/**
 * @file umami-tracker.ts
 * @description Typed access to the global Umami tracker (`window.umami`) and a
 * bounded wait for it (HOS-2119).
 *
 * The tracker script is external and `defer`, so it may not exist yet when a
 * module or island runs, and it never appears when an ad blocker drops it.
 * Every caller therefore resolves it at call time and, when it must act once
 * the tracker is there, waits a bounded number of polls and then gives up
 * silently. Analytics are best-effort and must never break the page.
 */

import type { UmamiTracker } from '@repo/analytics';

/** `name` of the `<meta>` `UmamiScript.astro` renders with the tracker config (HOS-2681). */
export const UMAMI_CONFIG_META_NAME = 'umami-config';

/** Selector of the config meta. The tracker script itself is injected only after consent. */
export const UMAMI_CONFIG_SELECTOR = `meta[name="${UMAMI_CONFIG_META_NAME}"]`;

/** Tracker config read from {@link UMAMI_CONFIG_SELECTOR}. */
export interface UmamiConfig {
    /** Absolute http(s) URL of the (renamed) tracker script. */
    readonly scriptUrl: string;
    /** Umami website id. */
    readonly websiteId: string;
}

/**
 * Reads the tracker config the page renders. The config is inert: it loads and
 * sends nothing, so it can sit on every page before consent.
 *
 * @returns The config, or `null` on the server, on a page without it, or when
 *   its URL is not http(s).
 */
export function readUmamiConfig(): UmamiConfig | null {
    if (typeof document === 'undefined') return null;
    const meta = document.querySelector<HTMLMetaElement>(UMAMI_CONFIG_SELECTOR);
    const scriptUrl = meta?.getAttribute('data-script-url')?.trim();
    const websiteId = meta?.getAttribute('data-website-id')?.trim();
    if (!scriptUrl || !websiteId) return null;
    try {
        const url = new URL(scriptUrl, window.location.href);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return { scriptUrl: url.href, websiteId };
    } catch {
        return null;
    }
}

/** Interval between checks for `window.umami`. */
export const UMAMI_POLL_INTERVAL_MS = 250;
/** Maximum number of checks (about 5 seconds in total). */
export const UMAMI_MAX_POLL_ATTEMPTS = 20;

function isUmamiTracker(value: unknown): value is UmamiTracker {
    if (typeof value !== 'object' || value === null) return false;
    return (
        typeof Reflect.get(value, 'track') === 'function' &&
        typeof Reflect.get(value, 'identify') === 'function'
    );
}

/**
 * Returns the live Umami tracker, or `undefined` on the server, before the
 * deferred script ran, or when it was blocked.
 *
 * @returns The tracker when present.
 */
export function getUmamiTracker(): UmamiTracker | undefined {
    if (typeof window === 'undefined') return undefined;
    const candidate: unknown = Reflect.get(window, 'umami');
    return isUmamiTracker(candidate) ? candidate : undefined;
}

/** Input of {@link waitForUmamiTracker}. */
export interface WaitForUmamiTrackerInput {
    /** Called once with the tracker as soon as it is present. */
    readonly onReady: (tracker: UmamiTracker) => void;
    /** Called once when the wait gives up without finding the tracker. */
    readonly onGiveUp?: () => void;
    /** Poll interval in ms. Defaults to {@link UMAMI_POLL_INTERVAL_MS}. */
    readonly intervalMs?: number;
    /** Maximum polls. Defaults to {@link UMAMI_MAX_POLL_ATTEMPTS}. */
    readonly maxAttempts?: number;
}

/** Result of {@link waitForUmamiTracker}. */
export interface WaitForUmamiTrackerResult {
    /** Stops a pending wait. A no-op once `onReady` ran or the wait gave up. */
    readonly cancel: () => void;
}

/**
 * Runs `onReady` with the tracker: synchronously when it is already present,
 * otherwise on the first poll that finds it. Gives up silently after
 * `maxAttempts` polls (then `onGiveUp`), so a blocked tracker never leaves a
 * timer behind.
 *
 * @param input - Callback and optional poll settings.
 * @returns A handle to cancel the pending wait.
 */
export function waitForUmamiTracker({
    onReady,
    onGiveUp,
    intervalMs = UMAMI_POLL_INTERVAL_MS,
    maxAttempts = UMAMI_MAX_POLL_ATTEMPTS
}: WaitForUmamiTrackerInput): WaitForUmamiTrackerResult {
    const noop = { cancel: () => undefined };
    if (typeof window === 'undefined') return noop;

    const ready = getUmamiTracker();
    if (ready) {
        onReady(ready);
        return noop;
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
        attempts += 1;
        const tracker = getUmamiTracker();
        if (tracker) {
            window.clearInterval(timer);
            onReady(tracker);
        } else if (attempts >= maxAttempts) {
            window.clearInterval(timer);
            onGiveUp?.();
        }
    }, intervalMs);

    return { cancel: () => window.clearInterval(timer) };
}

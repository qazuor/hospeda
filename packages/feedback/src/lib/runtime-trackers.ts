/**
 * @repo/feedback - Runtime trackers (navigation history + last interactions).
 *
 * Module-scoped ring buffers that capture lightweight context the user can
 * include in feedback reports. State lives outside React so the FAB does
 * not re-render on every navigation or click.
 *
 * Privacy: only structural information about user interactions is captured.
 * No textContent, input values, or attribute values are recorded.
 */
import type { FeedbackInteraction } from '../schemas/feedback.schema.js';

/** Maximum number of URLs retained in the navigation history ring buffer. */
const MAX_NAV_HISTORY = 10;

/** Maximum number of clicks retained in the interaction ring buffer. */
const MAX_INTERACTIONS = 5;

/** Selector hint preferring root that excludes the FAB itself. */
const FEEDBACK_ROOT_SELECTOR = '[data-feedback-root], [data-feedback-modal]';

// ---------------------------------------------------------------------------
// Ring buffer state (module-level singletons)
// ---------------------------------------------------------------------------

let navHistory: string[] = [];
let lastInteractions: FeedbackInteraction[] = [];

let trackersInstalled = false;
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;
let popStateHandler: (() => void) | null = null;
let clickHandler: ((event: Event) => void) | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current pathname + search string in a defensive try/catch.
 *
 * @returns Path + search, or `undefined` when window is unavailable.
 */
function readCurrentPath(): string | undefined {
    try {
        if (typeof window === 'undefined') return undefined;
        return `${window.location.pathname}${window.location.search}`;
    } catch {
        return undefined;
    }
}

/**
 * Pushes a new URL into the navigation history ring buffer.
 *
 * Skips consecutive duplicates so navigation noise (e.g. silent
 * `replaceState` calls during hydration) does not flood the buffer.
 *
 * @param url - URL to record
 */
function pushNav(url: string | undefined): void {
    if (!url) return;
    if (navHistory[navHistory.length - 1] === url) return;
    navHistory =
        navHistory.length >= MAX_NAV_HISTORY ? [...navHistory.slice(1), url] : [...navHistory, url];
}

/**
 * Builds a short selector hint from a click target (id, then first className,
 * then the tag name as fallback).
 *
 * @param el - The click target element
 * @returns Selector string, capped at 80 chars
 */
function buildSelectorHint(el: Element): string {
    try {
        if (el.id) return `#${el.id}`.slice(0, 80);
        const className = (el as HTMLElement).className;
        if (typeof className === 'string' && className.trim().length > 0) {
            const first = className.trim().split(/\s+/)[0];
            return `.${first}`.slice(0, 80);
        }
        return el.tagName.toLowerCase();
    } catch {
        return 'unknown';
    }
}

/**
 * Records a click as a `FeedbackInteraction` into the ring buffer.
 *
 * Skips clicks that originated inside the feedback widget itself so opening
 * the form does not poison the buffer.
 *
 * @param event - The click event
 */
function recordClick(event: Event): void {
    try {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest(FEEDBACK_ROOT_SELECTOR)) return;

        const interaction: FeedbackInteraction = {
            type: target.tagName,
            selector: buildSelectorHint(target),
            timestamp: new Date().toISOString()
        };

        lastInteractions =
            lastInteractions.length >= MAX_INTERACTIONS
                ? [...lastInteractions.slice(1), interaction]
                : [...lastInteractions, interaction];
    } catch {
        // Ignore listener failures so user clicks are never blocked
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Installs runtime trackers (idempotent).
 *
 * - Patches `history.pushState` / `history.replaceState` to capture SPA navigation.
 * - Subscribes to `popstate` for back/forward navigation.
 * - Adds a delegated `click` listener at the document level.
 *
 * Calling this multiple times is safe — only the first call installs.
 */
export function installRuntimeTrackers(): void {
    if (trackersInstalled) return;
    if (typeof window === 'undefined') return;

    try {
        // Seed with the current path so the first navigation has context
        pushNav(readCurrentPath());

        originalPushState = history.pushState.bind(history);
        originalReplaceState = history.replaceState.bind(history);

        history.pushState = ((...args: Parameters<typeof history.pushState>) => {
            const result = originalPushState?.apply(history, args);
            pushNav(readCurrentPath());
            return result;
        }) as typeof history.pushState;

        history.replaceState = ((...args: Parameters<typeof history.replaceState>) => {
            const result = originalReplaceState?.apply(history, args);
            pushNav(readCurrentPath());
            return result;
        }) as typeof history.replaceState;

        popStateHandler = () => pushNav(readCurrentPath());
        window.addEventListener('popstate', popStateHandler);

        clickHandler = recordClick;
        document.addEventListener('click', clickHandler, true);

        trackersInstalled = true;
    } catch {
        // If installation fails (SSR, restricted iframe), leave buffers empty
    }
}

/**
 * Uninstalls runtime trackers and restores the original History API.
 *
 * Mainly intended for tests; production code typically keeps the trackers
 * installed for the lifetime of the page.
 */
export function uninstallRuntimeTrackers(): void {
    if (!trackersInstalled) return;
    try {
        if (originalPushState) history.pushState = originalPushState;
        if (originalReplaceState) history.replaceState = originalReplaceState;
        if (popStateHandler) window.removeEventListener('popstate', popStateHandler);
        if (clickHandler) document.removeEventListener('click', clickHandler, true);
    } catch {
        // Ignore teardown failures
    } finally {
        originalPushState = null;
        originalReplaceState = null;
        popStateHandler = null;
        clickHandler = null;
        trackersInstalled = false;
    }
}

/**
 * Returns a snapshot of the current navigation history ring buffer.
 *
 * @returns Array of URLs (most recent last), or `undefined` when empty.
 */
export function getNavigationHistory(): string[] | undefined {
    if (navHistory.length === 0) return undefined;
    return [...navHistory];
}

/**
 * Returns a snapshot of the recent interactions ring buffer.
 *
 * @returns Array of interactions (most recent last), or `undefined` when empty.
 */
export function getLastInteractions(): FeedbackInteraction[] | undefined {
    if (lastInteractions.length === 0) return undefined;
    return [...lastInteractions];
}

/**
 * Resets both ring buffers. Exposed for tests.
 */
export function resetRuntimeTrackers(): void {
    navHistory = [];
    lastInteractions = [];
}

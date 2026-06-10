/**
 * @repo/feedback - Runtime trackers (navigation history + last interactions).
 *
 * Module-scoped ring buffers that capture lightweight context the user can
 * include in feedback reports. State lives outside React so the FAB does
 * not re-render on every navigation or click, and is mirrored to
 * `sessionStorage` so it survives full-page reloads (e.g. when navigating
 * to a route without `<ClientRouter />`).
 *
 * Privacy: interactions capture visible labels (text / aria-label) and the
 * href of same-origin links, but never input values, password fields, or
 * elements marked with `data-feedback-skip` / `data-private`.
 */
import type { FeedbackInteraction } from '@repo/schemas';

/** Maximum number of URLs retained in the navigation history ring buffer. */
const MAX_NAV_HISTORY = 10;

/** Maximum number of interactions retained in the ring buffer. */
const MAX_INTERACTIONS = 5;

/** Selector hint preferring root that excludes the FAB itself. */
const FEEDBACK_ROOT_SELECTOR = '[data-feedback-root], [data-feedback-modal]';

/** Sentinel attributes that opt an element (and its descendants) out of capture. */
const PRIVACY_SKIP_SELECTOR = '[data-feedback-skip], [data-private]';

/** sessionStorage keys (namespaced to avoid app collisions). */
const SS_NAV_KEY = '__hospeda_feedback_nav__';
const SS_INTERACTIONS_KEY = '__hospeda_feedback_interactions__';

/** Hard limits applied at capture time so we never blow past schema caps. */
const TEXT_LIMIT = 60;
const HREF_LIMIT = 200;
const DOM_PATH_LIMIT = 120;
const DOM_PATH_DEPTH = 4;

// ---------------------------------------------------------------------------
// Ring buffer state (module-level singletons, mirrored to sessionStorage)
// ---------------------------------------------------------------------------

let navHistory: string[] = [];
let lastInteractions: FeedbackInteraction[] = [];

let trackersInstalled = false;
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;
let popStateHandler: (() => void) | null = null;
let clickHandler: ((event: Event) => void) | null = null;
let submitHandler: ((event: Event) => void) | null = null;
let astroAfterSwapHandler: (() => void) | null = null;

// ---------------------------------------------------------------------------
// sessionStorage helpers — every read/write is wrapped because storage may be
// disabled (private mode, quota exceeded, file://) and must never throw.
// ---------------------------------------------------------------------------

function safeReadJson<T>(key: string): T | null {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return null;
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function safeWriteJson(key: string, value: unknown): void {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Silently ignore quota or serialization errors.
    }
}

function loadFromSession(): void {
    const nav = safeReadJson<string[]>(SS_NAV_KEY);
    if (Array.isArray(nav)) {
        navHistory = nav.filter((u) => typeof u === 'string').slice(-MAX_NAV_HISTORY);
    }
    const inter = safeReadJson<FeedbackInteraction[]>(SS_INTERACTIONS_KEY);
    if (Array.isArray(inter)) {
        lastInteractions = inter.slice(-MAX_INTERACTIONS);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCurrentPath(): string | undefined {
    try {
        if (typeof window === 'undefined') return undefined;
        return `${window.location.pathname}${window.location.search}`;
    } catch {
        return undefined;
    }
}

function pushNav(url: string | undefined): void {
    if (!url) return;
    if (navHistory[navHistory.length - 1] === url) return;
    navHistory =
        navHistory.length >= MAX_NAV_HISTORY ? [...navHistory.slice(1), url] : [...navHistory, url];
    safeWriteJson(SS_NAV_KEY, navHistory);
}

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
 * Build a short DOM ancestry path like `nav > ul > li > button`.
 * Bounded by depth and a hard char cap.
 */
function buildDomPath(el: Element): string {
    const segments: string[] = [];
    let cursor: Element | null = el;
    let depth = 0;
    while (cursor && depth < DOM_PATH_DEPTH) {
        const tag = cursor.tagName.toLowerCase();
        if (tag === 'html' || tag === 'body') break;
        let segment = tag;
        if (cursor.id) {
            segment += `#${cursor.id}`;
        } else {
            const className = (cursor as HTMLElement).className;
            if (typeof className === 'string' && className.trim().length > 0) {
                segment += `.${className.trim().split(/\s+/)[0]}`;
            }
        }
        segments.unshift(segment);
        cursor = cursor.parentElement;
        depth += 1;
    }
    const path = segments.join('>');
    return path.length > DOM_PATH_LIMIT ? path.slice(0, DOM_PATH_LIMIT) : path;
}

/**
 * Walk up the tree to find the closest "actionable" element when the user
 * clicked something inside it (e.g. an `<svg>` inside a `<button>`).
 *
 * Returns the original target if no actionable ancestor is found.
 */
function findActionable(start: Element): Element {
    const ACTIONABLE = 'button, a, [role="button"], [role="link"], input[type="submit"], summary';
    const closest = start.closest(ACTIONABLE);
    return closest ?? start;
}

/**
 * Decide whether the element (or any ancestor) is opted out of capture.
 *
 * Skips:
 * - elements inside the feedback widget itself
 * - explicit opt-outs (`data-feedback-skip`, `data-private`)
 * - sensitive inputs (password, hidden, file)
 * - inputs with autocomplete tokens that smell like PII (cc-*, off, current-password, ...)
 */
function isPrivacySkipped(el: Element): boolean {
    if (el.closest(FEEDBACK_ROOT_SELECTOR)) return true;
    if (el.closest(PRIVACY_SKIP_SELECTOR)) return true;
    if (el instanceof HTMLInputElement) {
        const sensitive = new Set(['password', 'hidden', 'file', 'tel', 'email']);
        if (sensitive.has(el.type)) return true;
        const auto = (el.autocomplete ?? '').toLowerCase();
        if (
            auto.startsWith('cc-') ||
            auto === 'current-password' ||
            auto === 'new-password' ||
            auto === 'one-time-code'
        ) {
            return true;
        }
    }
    if (el instanceof HTMLTextAreaElement) return true;
    return false;
}

/**
 * Pull a usable visible label for the element.
 *
 * Order: `aria-label` → `title` → trimmed `textContent`.
 * Inputs (non-button) are excluded — capturing user-typed text is a privacy risk.
 */
function readVisibleLabel(el: Element): { text?: string; ariaLabel?: string } {
    const ariaLabel = (el.getAttribute('aria-label') ?? '').trim();
    let text: string | undefined;

    // Avoid reading textContent on form inputs; for buttons / links / role-button
    // it's safe to capture the visible label.
    const tag = el.tagName.toLowerCase();
    const isInputLike = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (!isInputLike) {
        const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (raw) text = raw;
    }
    // Fallback to title attribute when there's no visible text (icon-only buttons)
    if (!text) {
        const title = (el.getAttribute('title') ?? '').trim();
        if (title) text = title;
    }

    return {
        text: text ? text.slice(0, TEXT_LIMIT) : undefined,
        ariaLabel: ariaLabel ? ariaLabel.slice(0, TEXT_LIMIT) : undefined
    };
}

/**
 * Extract the `href` for `<a>` targets, but only when same-origin so we
 * never leak external destinations (e.g. payment redirects, OAuth flows).
 */
function readSafeHref(el: Element): string | undefined {
    if (!(el instanceof HTMLAnchorElement)) return undefined;
    const href = el.getAttribute('href');
    if (!href) return undefined;
    try {
        const resolved = new URL(href, window.location.origin);
        if (resolved.origin !== window.location.origin) return undefined;
        const path = `${resolved.pathname}${resolved.search}`;
        return path.length > HREF_LIMIT ? path.slice(0, HREF_LIMIT) : path;
    } catch {
        return undefined;
    }
}

function recordInteraction(interaction: FeedbackInteraction): void {
    lastInteractions =
        lastInteractions.length >= MAX_INTERACTIONS
            ? [...lastInteractions.slice(1), interaction]
            : [...lastInteractions, interaction];
    safeWriteJson(SS_INTERACTIONS_KEY, lastInteractions);
}

function recordClick(event: Event): void {
    try {
        const rawTarget = event.target;
        if (!(rawTarget instanceof Element)) return;
        if (isPrivacySkipped(rawTarget)) return;

        const target = findActionable(rawTarget);
        if (isPrivacySkipped(target)) return;

        const labels = readVisibleLabel(target);
        recordInteraction({
            type: target.tagName,
            selector: buildSelectorHint(target),
            timestamp: new Date().toISOString(),
            event: 'click',
            text: labels.text,
            ariaLabel: labels.ariaLabel,
            href: readSafeHref(target),
            domPath: buildDomPath(target)
        });
    } catch {
        // Never block user interaction on a tracker error.
    }
}

function recordSubmit(event: Event): void {
    try {
        const target = event.target;
        if (!(target instanceof HTMLFormElement)) return;
        if (isPrivacySkipped(target)) return;

        // For forms we capture only structural info — never field values.
        const name = target.getAttribute('name') ?? target.getAttribute('id') ?? 'form';
        const action = target.getAttribute('action') ?? '';
        const safeAction = action && !action.startsWith('http') ? action : undefined;

        recordInteraction({
            type: 'FORM',
            selector: buildSelectorHint(target),
            timestamp: new Date().toISOString(),
            event: 'submit',
            text: name.slice(0, TEXT_LIMIT),
            href: safeAction?.slice(0, HREF_LIMIT),
            domPath: buildDomPath(target)
        });
    } catch {
        // ignore
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Installs runtime trackers (idempotent).
 *
 * - Loads any previously persisted state from sessionStorage so navigation
 *   captured before the FAB hydrated (e.g. by the BaseLayout init script)
 *   carries forward.
 * - Patches `history.pushState` / `history.replaceState` to capture SPA navigation.
 * - Subscribes to `popstate` for back/forward navigation.
 * - Subscribes to Astro's `astro:after-swap` event so view-transition
 *   navigations are captured even if the History API patching missed them.
 * - Adds delegated `click` and `submit` listeners at the document level.
 *
 * Calling this multiple times is safe — only the first call installs.
 */
export function installRuntimeTrackers(): void {
    if (trackersInstalled) return;
    if (typeof window === 'undefined') return;

    try {
        loadFromSession();

        // Seed with the current path so the first navigation has context.
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

        // Astro view transitions: re-read the current path after each swap.
        // Safe to subscribe even when ClientRouter is not present.
        astroAfterSwapHandler = () => pushNav(readCurrentPath());
        document.addEventListener('astro:after-swap', astroAfterSwapHandler);

        clickHandler = recordClick;
        document.addEventListener('click', clickHandler, true);

        submitHandler = recordSubmit;
        document.addEventListener('submit', submitHandler, true);

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
        if (astroAfterSwapHandler) {
            document.removeEventListener('astro:after-swap', astroAfterSwapHandler);
        }
        if (clickHandler) document.removeEventListener('click', clickHandler, true);
        if (submitHandler) document.removeEventListener('submit', submitHandler, true);
    } catch {
        // ignore
    } finally {
        originalPushState = null;
        originalReplaceState = null;
        popStateHandler = null;
        astroAfterSwapHandler = null;
        clickHandler = null;
        submitHandler = null;
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
 * Resets both ring buffers (memory + sessionStorage). Exposed for tests
 * and for the embedding app when it needs to start from a clean slate.
 */
export function resetRuntimeTrackers(): void {
    navHistory = [];
    lastInteractions = [];
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(SS_NAV_KEY);
            window.sessionStorage.removeItem(SS_INTERACTIONS_KEY);
        }
    } catch {
        // ignore
    }
}

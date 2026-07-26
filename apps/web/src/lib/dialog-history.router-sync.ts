/**
 * @file dialog-history.router-sync.ts
 * @description Tracks whether Astro's `<ClientRouter />` still agrees with the
 * document's URL, so `dialog-history` knows when it is safe to claim a history
 * entry through `navigate()` (HOS-310).
 *
 * The router's no-swap fast path is gated on `samePage(originalLocation, to)`,
 * comparing pathname AND search. `originalLocation` is module-private to the
 * router and advances only when the router itself navigates — so any raw
 * `pushState`/`replaceState` in app code silently invalidates it. Claiming from
 * that state would take the full refetch-and-swap path, which is exactly what
 * the feature exists to avoid.
 *
 * Full rationale: `apps/web/docs/dialog-history.md`.
 *
 * @module dialog-history.router-sync
 */

/** How long after `astro:before-preparation` a navigation is assumed live. */
const NAVIGATION_WINDOW_MS = 10_000;

/**
 * `pathname + search` of the last URL the router is known to agree with, or
 * `null` when that is unknown.
 */
let routerAgreesOn: string | null = null;

/**
 * When the last `astro:before-preparation` fired, or `null`. A navigation that
 * aborts never fires another lifecycle event, so this expires on a clock rather
 * than waiting for a completion somebody may never send.
 */
let navigationStartedAt: number | null = null;

/** True between `astro:before-swap` and the `astro:page-load` that follows. */
let swapInProgress = false;

let listenersAttached = false;
let onSwapStart: (() => void) | null = null;

/** Whether `<ClientRouter />` is mounted on the current page. */
export function transitionsEnabled(): boolean {
    return document.querySelector('[name="astro-view-transitions-enabled"]') !== null;
}

function pathSearchOf(href: string): string | null {
    try {
        const url = new URL(href, window.location.href);
        return `${url.pathname}${url.search}`;
    } catch {
        return null;
    }
}

/** Records that the router's private location now matches the document's. */
export function markRouterAgrees(): void {
    routerAgreesOn = pathSearchOf(window.location.href);
}

/**
 * Whether a `navigate()` claim is safe right now — i.e. whether the router's
 * `samePage(originalLocation, to)` check will pass. Anything that moved the URL
 * without going through the router leaves this false until the next real
 * navigation re-syncs both views.
 */
export function routerViewIsCurrent(): boolean {
    return routerAgreesOn !== null && routerAgreesOn === pathSearchOf(window.location.href);
}

/**
 * Whether a router navigation is mid-flight, in which case `navigate()` must
 * not be called: its first act is `abortAndRecreateMostRecentNavigation()`,
 * which would cancel the navigation the user actually asked for and leave the
 * tapped link dead.
 */
export function navigationInFlight(): boolean {
    return navigationStartedAt !== null && Date.now() - navigationStartedAt < NAVIGATION_WINDOW_MS;
}

function onBeforePreparation(): void {
    navigationStartedAt = Date.now();
}

/**
 * A swap really happened, so the router has moved `originalLocation` itself.
 *
 * This is the event the re-sync is gated on, rather than `astro:page-load`
 * alone: `ListingLayout.astro`'s partial swap hand-dispatches `after-swap` and
 * `page-load` without ever running the router, and it never forges this one.
 * Unlike `before-preparation`, it also cannot fire for a navigation that aborts.
 */
function onBeforeSwap(): void {
    navigationStartedAt = null;
    swapInProgress = true;
    onSwapStart?.();
}

/**
 * Deliberately does NOT clear `navigationStartedAt`. `ListingLayout.astro`
 * hand-dispatches this event, and letting forged input close the in-flight
 * window would be the one place untrusted code reaches a safety mechanism.
 * `onBeforeSwap` closes it on success; the expiry covers aborts.
 */
function onPageLoad(): void {
    if (!swapInProgress) return;
    swapInProgress = false;
    markRouterAgrees();
}

interface AttachParams {
    /** Called when a real swap begins and any owned entries become unreachable. */
    readonly onSwapStart: () => void;
}

/**
 * Starts observing the router. MUST run at module evaluation, not on first use:
 * these listeners are the only production re-sync of the agreement baseline,
 * and the JS realm survives soft navigations — attaching them lazily would let
 * every swap before the first modal go unobserved, leaving the baseline stale
 * and every later claim refused.
 */
export function attachRouterSyncListeners(params: AttachParams): void {
    if (listenersAttached) return;
    listenersAttached = true;
    onSwapStart = params.onSwapStart;
    document.addEventListener('astro:before-swap', onBeforeSwap);
    document.addEventListener('astro:before-preparation', onBeforePreparation);
    document.addEventListener('astro:page-load', onPageLoad);
}

/**
 * Test-only reset.
 *
 * @internal
 */
export function resetRouterSyncForTests(): void {
    navigationStartedAt = null;
    swapInProgress = false;
    markRouterAgrees();
    if (listenersAttached) {
        document.removeEventListener('astro:before-swap', onBeforeSwap);
        document.removeEventListener('astro:before-preparation', onBeforePreparation);
        document.removeEventListener('astro:page-load', onPageLoad);
        listenersAttached = false;
        onSwapStart = null;
    }
}

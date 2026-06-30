/**
 * @file nav-progress.ts
 * @description Controller for the global navigation loading feedback rendered by
 * `NavigationProgress.astro`. Extracted from the component's inline script so the
 * behaviour can be unit-tested.
 *
 * Three layers driven by Astro View Transitions (ClientRouter) lifecycle events:
 *   1. A slim top progress bar (`#nav-progress`) shown instantly on
 *      `astro:before-preparation` and completed on `astro:after-swap`.
 *   2. A threshold-gated full-screen overlay with a centered spinner, shown only
 *      when a navigation exceeds `thresholdMs` (e.g. a cold-cache SSR page). The
 *      threshold avoids a flash on fast navigations.
 *   3. `cursor: progress` on <html> for the duration of the navigation.
 *
 * The bar node lives in the swapped <body> (no `transition:persist`), so
 * ClientRouter recreates it on each navigation. The controller therefore reads
 * the live node on every event via `getBar()` instead of caching a reference —
 * a cached reference would point at a detached node from the second SPA
 * navigation onward (the hoisted module script runs only once).
 */

/** Configuration for {@link createNavigationProgress}. */
export interface NavigationProgressOptions {
    /** Element id of the top progress bar. Defaults to `'nav-progress'`. */
    readonly barId?: string;
    /** Delay (ms) before the content overlay is shown. Defaults to `450`. */
    readonly thresholdMs?: number;
}

/** Imperative handle returned by {@link createNavigationProgress}. */
export interface NavigationProgressController {
    /** Begin feedback for a navigation (bar + cursor + overlay timer). */
    onNavStart(): void;
    /**
     * Complete the bar. Wired to `astro:before-swap`, while the OLD bar (the one
     * that has `is-active`) is still in the DOM — the body swap happens right
     * after this event, so completing on `astro:after-swap` would run against
     * the fresh, invisible bar of the next page.
     */
    onNavComplete(): void;
    /** Tear down overlay + cursor once the new DOM is in place (`astro:after-swap`). */
    onNavCleanup(): void;
    /** Full teardown for non-VT navigations / bfcache restores. */
    onNavEnd(): void;
    /** Wire the controller to the ClientRouter lifecycle. Returns a detacher. */
    attach(): () => void;
}

/** Fallback label used if the bar's `data-loading-label` is missing. */
const FALLBACK_LABEL = 'Cargando...';

/**
 * Create a navigation-progress controller bound to the global `document` /
 * `window`. The caller wires it with {@link NavigationProgressController.attach}.
 *
 * @param options - {@link NavigationProgressOptions}
 * @returns the controller handle
 */
export function createNavigationProgress(
    options: NavigationProgressOptions = {}
): NavigationProgressController {
    const barId = options.barId ?? 'nav-progress';
    const thresholdMs = options.thresholdMs ?? 450;

    let animationFrame: number | null = null;
    let overlayTimer: number | null = null;
    let running = false;

    /** Read the live bar node (recreated on every ClientRouter swap). */
    function getBar(): HTMLElement | null {
        return document.getElementById(barId);
    }

    function startProgress(): void {
        const bar = getBar();
        if (!bar) return;
        // Guard against a second start for the same navigation so the bar does
        // not visually reset to its initial width mid-animation.
        if (running) return;
        running = true;

        // `is-active` makes opacity appear instantly (no fade-in); the bar also
        // starts at a visible width so the feedback is immediate.
        bar.classList.add('is-active');
        let width = 12;
        bar.style.width = `${width}%`;

        const animate = (): void => {
            if (width < 90) {
                // Quick start, then gradually slow toward the 90% ceiling.
                const increment = width < 30 ? 3 : width < 60 ? 1 : 0.5;
                width += increment;
                bar.style.width = `${width}%`;
                animationFrame = window.requestAnimationFrame(animate);
            }
        };
        animationFrame = window.requestAnimationFrame(animate);
    }

    function completeProgress(): void {
        running = false;
        if (animationFrame) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        const bar = getBar();
        if (!bar) return;
        bar.style.width = '100%';
        // Removing `is-active` re-enables the base opacity transition → fade-out.
        bar.classList.remove('is-active');
        window.setTimeout(() => {
            const b = getBar();
            // A new navigation may have started; don't clobber it.
            if (!b || running) return;
            b.style.width = '0%';
        }, 300);
    }

    /** Pointer affordance for the whole navigation (no-op on touch). */
    function setCursorBusy(busy: boolean): void {
        document.documentElement.style.cursor = busy ? 'progress' : '';
    }

    function showOverlay(): void {
        // Don't stack with an overlay already shown (e.g. PaginationLoading).
        if (document.querySelector('[data-nav-overlay]')) return;
        const label = getBar()?.dataset.loadingLabel || FALLBACK_LABEL;

        const overlay = document.createElement('div');
        overlay.dataset.navOverlay = 'global';
        overlay.className = 'nav-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', label);

        const ring = document.createElement('div');
        ring.className = 'nav-overlay__ring';
        ring.setAttribute('aria-hidden', 'true');

        overlay.appendChild(ring);
        document.body.appendChild(overlay);
    }

    function removeOverlay(): void {
        document.querySelector('[data-nav-overlay="global"]')?.remove();
    }

    function clearOverlayTimer(): void {
        if (overlayTimer) {
            clearTimeout(overlayTimer);
            overlayTimer = null;
        }
    }

    function onNavStart(): void {
        startProgress();
        setCursorBusy(true);
        clearOverlayTimer();
        overlayTimer = window.setTimeout(showOverlay, thresholdMs);
    }

    /**
     * Fired on `astro:before-swap`: the document fetch has finished and the OLD
     * bar is still present. Cancel any pending overlay (the slow phase is over)
     * and run the bar's completion on the node that actually has `is-active`.
     * Cancelling the timer here also closes the race with PaginationLoading,
     * which drops its `[data-nav-overlay]` marker on the same event.
     */
    function onNavComplete(): void {
        clearOverlayTimer();
        completeProgress();
    }

    /** Fired on `astro:after-swap`: new DOM is in place — tear down the overlay. */
    function onNavCleanup(): void {
        clearOverlayTimer();
        removeOverlay();
        setCursorBusy(false);
    }

    /** Full teardown for non-VT navigations / bfcache restores. */
    function onNavEnd(): void {
        onNavCleanup();
        completeProgress();
    }

    function onPageShow(event: PageTransitionEvent): void {
        // Only the bfcache restore needs recovery; the initial page load fires
        // `pageshow` too (persisted === false) but has nothing to tear down.
        if (event.persisted) onNavEnd();
    }

    function attach(): () => void {
        // ClientRouter lifecycle: `before-preparation` starts the next-document
        // fetch (the slow phase on cold SSR); `before-swap` fires once it lands,
        // before the DOM is replaced; `after-swap` once the new DOM is in place.
        document.addEventListener('astro:before-preparation', onNavStart);
        document.addEventListener('astro:before-swap', onNavComplete);
        document.addEventListener('astro:after-swap', onNavCleanup);
        window.addEventListener('pageshow', onPageShow);

        return () => {
            document.removeEventListener('astro:before-preparation', onNavStart);
            document.removeEventListener('astro:before-swap', onNavComplete);
            document.removeEventListener('astro:after-swap', onNavCleanup);
            window.removeEventListener('pageshow', onPageShow);
        };
    }

    return { onNavStart, onNavComplete, onNavCleanup, onNavEnd, attach };
}

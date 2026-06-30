/**
 * @file scroll-reveal.ts
 * @description IntersectionObserver-based scroll reveal animation system.
 * Observes elements with [data-reveal] attribute and adds .revealed class.
 *
 * Tracks the active observer to properly disconnect on re-initialization
 * (View Transitions), preventing memory leaks from accumulated observers.
 */

/** Reference to the currently active observer for cleanup on re-init */
let activeObserver: IntersectionObserver | null = null;

/**
 * Watches for `[data-reveal]` elements inserted AFTER init. Server Islands
 * (`server:defer`) fetch their content asynchronously and can resolve after
 * `astro:page-load` has already run `initScrollReveal()`, so their elements
 * miss the initial observe pass. Tracked for cleanup alongside `activeObserver`.
 */
let lateContentObserver: MutationObserver | null = null;

/**
 * Initialize scroll reveal observers. Call from BaseLayout on `astro:page-load`.
 *
 * Disconnects any previously active observer before creating a new one,
 * preventing memory leaks across View Transition navigations.
 *
 * Elements already inside the viewport at init time are marked revealed
 * synchronously (no animation) so above-the-fold content does not flash
 * in on page load.
 *
 * Respects `prefers-reduced-motion`: if the user has requested reduced motion,
 * all [data-reveal] elements are immediately marked as .revealed without
 * animation.
 *
 * @example
 * ```ts
 * import { initScrollReveal } from '@/lib/scroll-reveal';
 * initScrollReveal();
 * ```
 */
export function initScrollReveal(): void {
    // Clean up previous observers to prevent memory leaks across navigations.
    if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
    }
    if (lateContentObserver) {
        lateContentObserver.disconnect();
        lateContentObserver = null;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
        activeObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        (entry.target as HTMLElement).classList.add('revealed');
                        activeObserver?.unobserve(entry.target);
                    }
                }
            },
            // Positive bottom margin pre-fires the reveal ~15% of the viewport
            // BEFORE the element scrolls into view, so the opacity/translate
            // transition has time to finish as it enters — instead of popping in
            // mid-screen. A negative margin (the previous '-10%') triggered too
            // late, causing the abrupt appearance reported in BETA-28.
            { threshold: 0, rootMargin: '0px 0px 15% 0px' }
        );
    }

    // Reveal or observe a single element, honoring reduced-motion. Shared by the
    // initial pass and the late-content MutationObserver so both behave alike.
    const handleElement = (el: Element): void => {
        if (prefersReducedMotion) {
            el.classList.add('revealed');
            return;
        }
        const rect = el.getBoundingClientRect();
        // Already in (or above) the viewport — reveal instantly, skip animation.
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('revealed');
            return;
        }
        activeObserver?.observe(el);
    };

    for (const el of document.querySelectorAll('[data-reveal]')) {
        handleElement(el);
    }

    // Catch `[data-reveal]` elements that arrive after this pass — e.g. a
    // Server Island whose async fetch resolves after astro:page-load. Without
    // this they would stay at opacity:0 forever (Bug B5: home events vanished
    // when navigating back via View Transitions).
    lateContentObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches('[data-reveal]')) handleElement(node);
                for (const child of node.querySelectorAll('[data-reveal]')) {
                    handleElement(child);
                }
            }
        }
    });
    lateContentObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Disconnect the active scroll reveal observer and release references.
 * Useful for manual cleanup in tests or teardown scenarios.
 */
export function destroyScrollReveal(): void {
    if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
    }
    if (lateContentObserver) {
        lateContentObserver.disconnect();
        lateContentObserver = null;
    }
}

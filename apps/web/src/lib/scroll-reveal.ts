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
 * Initialize scroll reveal observers. Call from BaseLayout on `astro:page-load`.
 *
 * Disconnects any previously active observer before creating a new one,
 * preventing memory leaks across View Transition navigations.
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
    // Clean up previous observer to prevent memory leaks
    if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        for (const el of document.querySelectorAll('[data-reveal]')) {
            el.classList.add('revealed');
        }
        return;
    }

    activeObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('revealed');
                    activeObserver?.unobserve(entry.target);
                }
            }
        },
        { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    for (const el of document.querySelectorAll('[data-reveal]')) {
        activeObserver.observe(el);
    }
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
}

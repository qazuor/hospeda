/**
 * @file scroll-reveal.ts
 * @description IntersectionObserver-based scroll reveal animation system.
 * Observes elements with [data-reveal] attribute and adds .revealed class.
 */

/**
 * Initialize scroll reveal observers. Call once from BaseLayout inline script.
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
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        for (const el of document.querySelectorAll('[data-reveal]')) {
            el.classList.add('revealed');
        }
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            }
        },
        { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    for (const el of document.querySelectorAll('[data-reveal]')) {
        observer.observe(el);
    }
}

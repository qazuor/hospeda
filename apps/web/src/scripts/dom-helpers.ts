/**
 * @file dom-helpers.ts
 * @description Delegated DOM event handlers to replace inline `on*=` attributes
 * that are blocked by the strict CSP (SPEC-047).
 *
 * Each helper attaches a single document-level listener via event delegation,
 * so the cost is O(1) regardless of how many target elements are present.
 * All helpers are idempotent — safe to call multiple times across page
 * navigations because they use module-level flags.
 */

let stopPropagationInitialized = false;

/**
 * Initialise a delegated click handler for `[data-stop-propagation]` elements.
 *
 * Replaces inline `onclick="event.stopPropagation();"` handlers, which are
 * blocked by CSP without `'unsafe-inline'`. Mark any element that needs to
 * stop click propagation with `data-stop-propagation`:
 *
 * ```html
 * <a href="..." data-stop-propagation>Inner link inside a card</a>
 * ```
 */
export function initStopPropagation(): void {
    if (stopPropagationInitialized) return;
    stopPropagationInitialized = true;

    document.addEventListener('click', (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const stopper = target.closest('[data-stop-propagation]');
        if (stopper) event.stopPropagation();
    });
}

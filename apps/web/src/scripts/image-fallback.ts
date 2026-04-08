/**
 * @file image-fallback.ts
 * @description Delegated image error handler for CSP-compatible fallback images.
 *
 * Uses a single event listener on `document` to catch `error` events from `<img>`
 * elements. Supports two modes:
 *
 * 1. **Fallback src**: `data-fallback="/path/to/placeholder.webp"` — replaces the src
 * 2. **Hide on error**: `data-hide-on-error` — hides the image via `display: none`
 *
 * This replaces inline `onerror` handlers which are blocked by strict CSP.
 *
 * @example
 * ```html
 * <img src="/real.webp" data-fallback="/placeholder.webp" alt="..." />
 * <img src="/icon.svg" data-hide-on-error alt="" />
 * ```
 */

let initialized = false;

/**
 * Initialize the delegated image fallback listener.
 * Safe to call multiple times — uses a module-level flag to prevent duplicate listeners.
 */
export function initImageFallback(): void {
    if (initialized) return;
    initialized = true;

    document.addEventListener(
        'error',
        (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLImageElement)) return;

            // Mode 1: Replace with fallback src
            const fallbackSrc = target.dataset.fallback;
            if (fallbackSrc) {
                delete target.dataset.fallback;
                target.src = fallbackSrc;
                return;
            }

            // Mode 2: Hide the image
            if (target.hasAttribute('data-hide-on-error')) {
                target.style.display = 'none';
                target.removeAttribute('data-hide-on-error');
            }
        },
        true // Use capture phase to catch errors before they bubble
    );
}

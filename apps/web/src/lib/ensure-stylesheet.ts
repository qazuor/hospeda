/**
 * @file ensure-stylesheet.ts
 * @description Attach a stylesheet at runtime, once (HOS-369 W3-5).
 *
 * ## Why this exists
 *
 * Astro collects the CSS of **everything in a page's module graph** into that
 * page's `<head>`, and it does not distinguish a static import from a dynamic
 * one. So the obvious ways to make vendor CSS lazy do not work:
 *
 * - `import('some.css')` from an inline `.astro` script → still linked in `<head>`.
 * - a `load-x.ts` module whose only job is `import 'x.css'` → Vite merges the
 *   module into its parent chunk (it has no runtime code to justify a split),
 *   and the CSS surfaces in `<head>` again.
 *
 * Both were measured, not assumed: `glightbox.min.css` shipped render-blocking
 * on every page despite living behind a `[data-glightbox]` guard and a dynamic
 * import, and `react-day-picker/style.css` did the same after being moved into
 * its own module.
 *
 * Importing the stylesheet with Vite's `?url` suffix is what breaks the chain:
 * the file is emitted as an asset and you get its hashed URL back as a string,
 * **without** the importing module declaring a style dependency. Astro then has
 * nothing to hoist, and the caller decides when the `<link>` appears.
 *
 * ## CSP
 *
 * The injected element is a same-origin `<link rel="stylesheet">`, allowed by
 * `style-src 'self'`. It is NOT an inline `<style>`, so it needs no hash — see
 * `buildCspHeader` in `lib/middleware-helpers.ts`.
 *
 * @param href - The hashed asset URL, obtained via `import '...css?url'`.
 * @returns A promise that settles when the stylesheet has loaded (or failed).
 */
export function ensureStylesheet({ href }: { readonly href: string }): Promise<void> {
    if (typeof document === 'undefined') return Promise.resolve();

    const existing = document.querySelector<HTMLLinkElement>(
        `link[rel="stylesheet"][data-ensured="${CSS.escape(href)}"]`
    );
    if (existing) {
        return existing.dataset.loaded === 'true'
            ? Promise.resolve()
            : new Promise((resolve) => {
                  existing.addEventListener('load', () => resolve(), { once: true });
                  existing.addEventListener('error', () => resolve(), { once: true });
              });
    }

    return new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.ensured = href;
        // Resolve on error too: a missing stylesheet must not deadlock the
        // caller's flow — the feature degrades unstyled rather than not at all.
        link.addEventListener(
            'load',
            () => {
                link.dataset.loaded = 'true';
                resolve();
            },
            { once: true }
        );
        link.addEventListener('error', () => resolve(), { once: true });
        document.head.appendChild(link);
    });
}

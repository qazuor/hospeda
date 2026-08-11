/**
 * @file load-glightbox.ts
 * @description Lazy entry point for the GLightbox gallery (HOS-369 W3-5).
 *
 * `BaseLayout.astro` already guarded the library behind
 * `if (document.querySelector('[data-glightbox]'))` and imported both the JS
 * and the CSS dynamically. The JS was genuinely lazy; **the stylesheet was
 * not** — it shipped as a render-blocking `<link>` in `<head>` on every page,
 * 11,089 B of rules on the home, where no gallery can exist.
 *
 * The reason is that Astro hoists the CSS of every module in a page's graph
 * into that page's `<head>`, dynamic import or not. `?url` is what breaks the
 * chain: the stylesheet is emitted as an asset and imported as a plain string,
 * so this module declares no style dependency for Astro to hoist, and the
 * `<link>` is created only when `loadGlightbox()` actually runs.
 *
 * Import this ONLY via `await import('@/lib/load-glightbox')`, and never import
 * `glightbox/dist/css/glightbox.min.css` directly anywhere —
 * `test/static-guards/lazy-vendor-css.test.ts` fails on both.
 */
import GLightbox from 'glightbox';
import glightboxCssUrl from 'glightbox/dist/css/glightbox.min.css?url';
import { ensureStylesheet } from '@/lib/ensure-stylesheet';

/**
 * Loads GLightbox's stylesheet, then returns the library.
 *
 * The stylesheet is awaited rather than fired and forgotten: the gallery is
 * initialised immediately after this resolves, and an unstyled lightbox is a
 * full-screen artifact, not a subtle one.
 *
 * @returns The GLightbox constructor, ready to use.
 */
export async function loadGlightbox(): Promise<typeof GLightbox> {
    await ensureStylesheet({ href: glightboxCssUrl });
    return GLightbox;
}

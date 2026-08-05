/**
 * @file load-driver.ts
 * @description Lazy entry point for the host onboarding tour (driver.js).
 *
 * HOS-369 W3-4 — this module exists to keep driver.js's stylesheet OFF the
 * global CSS bundle. `global.css` used to `@import "driver.js/dist/driver.css"`
 * and carry the themed overrides inline, which meant every page on the site
 * (home, listings, detail pages — none of which can start a tour) downloaded
 * ~4 KB of popover CSS.
 *
 * Both callers reach this module through a dynamic `import()`, so Vite emits
 * the driver.js runtime AND `styles/driver-tour.css` as an async chunk pair and
 * injects the stylesheet `<link>` only when that chunk is actually fetched —
 * i.e. when a signed-in account user starts or restarts the tour.
 *
 * Consequences to respect:
 * - Import this module ONLY via `await import('@/lib/load-driver')`. A static
 *   import from an island would fold the CSS back into that island's eagerly
 *   linked stylesheet.
 * - Do not import `driver.js` directly from a component again: the JS would
 *   still be lazy, but it would render unstyled (that regression is BETA-121).
 *
 * `test/styles/driver-css-lazy.guard.test.ts` enforces both rules.
 */
import '@/styles/driver-tour.css';

export { driver } from 'driver.js';

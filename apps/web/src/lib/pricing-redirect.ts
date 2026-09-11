/**
 * @file pricing-redirect.ts
 * @description Target of a moved URL's 301, query string included.
 *
 * Named for the seven redirects HOS-1032 left behind, which is where it came
 * from; HOS-1156's five use it too. The file name has stayed put rather than
 * being renamed across a dozen call sites for a word.
 *
 * ## Why this exists at all
 *
 * The obvious spelling — `Astro.redirect(buildUrl({ locale, path }), 301)` —
 * rebuilds the URL from its parts and therefore DROPS everything the request
 * carried after the `?`. Nothing about that looks wrong: the status is right,
 * the destination is right, and following the redirect by hand lands on a 200.
 *
 * It is wrong for one live sender and several silent ones:
 *
 * - **The trial-ending nudge.** `buildTrialUpgradeUrl`
 *   (`apps/api/src/services/trial.service.ts`) appends
 *   `?interval=<monthly|annual>` so the pricing page can pre-select the toggle
 *   the customer started from. `resolveQueryInterval` in `PricingCardsGrid`
 *   reads it on load. Drop the query and a customer who chose ANNUAL is shown
 *   monthly prices — the exact outcome HOS-115 §5 built the parameter to
 *   prevent, delivered silently, in the email that asks them to pay.
 * - **Attribution.** Any `?utm_*` on a shared or indexed old link is lost, so
 *   the traffic arrives unattributed rather than misattributed, which is harder
 *   to notice.
 *
 * A redirect that forwards the query is the ordinary contract for a URL that
 * MOVED, as opposed to one that was retired: the resource is the same resource,
 * so the parameters addressed to it still apply.
 *
 * @module lib/pricing-redirect
 */

import type { SupportedLocale } from './i18n';
import { buildUrl } from './urls';

/**
 * Build a 301 target for a moved pricing URL, preserving the query string.
 *
 * @param params.locale - The request's validated locale.
 * @param params.path - Locale-agnostic destination path, normally read from
 *   `PRICING_PAGE_PATH_BY_AUDIENCE`.
 * @param params.search - `Astro.url.search`, i.e. `''` or `'?a=1&b=2'`. Passed
 *   in rather than read here so this stays a pure function with no `Astro`
 *   global, and so every degraded shape is testable without a request.
 * @returns The destination path with the original query appended verbatim.
 *
 * @example
 * ```ts
 * buildPricingRedirectTarget({ locale: 'es', path: 'planes/anfitriones/precios', search: '?interval=annual' });
 * // '/es/planes/anfitriones/precios/?interval=annual'
 * ```
 */
export function buildPricingRedirectTarget({
    locale,
    path,
    search
}: {
    readonly locale: SupportedLocale;
    readonly path: string;
    readonly search: string;
}): string {
    const target = buildUrl({ locale, path });

    // `Astro.url.search` is `''` when there is no query and `'?…'` when there
    // is — it never yields a bare `'?'` for `/page?`, which URL parsing
    // normalises away. Appending it unconditionally would otherwise be able to
    // produce a trailing `?`, which is a second URL for one page.
    return search ? `${target}${search}` : target;
}

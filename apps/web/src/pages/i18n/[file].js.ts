/**
 * @file [file].js.ts
 * @description Serves one locale's flattened translation dictionary as a
 * hashed, immutable JavaScript asset (HOS-369 Wave D).
 *
 * `GET /i18n/<locale>.<8 hex>.js` → a classic script that assigns
 * `window.__HOSPEDA_I18N__[<locale>]`. Client islands read that global
 * synchronously through `getClientLocaleDict` (`@/lib/i18n`); the page links to
 * it from `<head>` via `I18nClientData.astro`.
 *
 * Both the URL and the body come from `@/lib/i18n-asset`, so what this endpoint
 * serves and what the page requests cannot drift apart.
 *
 * TWO naming rules produced this filename, and both are load-bearing:
 *
 *  - The directory is `/i18n/`, NOT `/_i18n/`. Astro removes every
 *    `src/pages/_*` path from the route manifest, so an underscored name would
 *    yield no route at all.
 *  - The `.js` belongs in the ROUTE (`[file].js.ts`), not inside the dynamic
 *    param (`[file].ts`). The app runs `trailingSlash: 'always'`, and Astro
 *    applies that to a route whose own path has no file extension — `/i18n/[file]`
 *    would compile to the pattern `^\/i18n\/([^/]+?)\/$`, which `/i18n/es.abc.js`
 *    does not match. Astro's trailing-slash redirect would not rescue it either:
 *    that handler skips any request pathname that HAS an extension. The result
 *    is a 404 for every dictionary request, in production only. With the `.js`
 *    in the route, `trailingSlashForPath` returns `'never'` and the pattern
 *    becomes `^\/i18n\/([^/]+?)\.js$`.
 *
 * Consequence of that second rule: Astro strips the route's `.js` suffix before
 * populating `params.file`, so this handler re-appends it to reconstruct the
 * filename the resolver validates.
 *
 * Caching: the response is content-addressed, so it is `immutable` for a year
 * and is NEVER purged — a dictionary change produces a NEW URL and the old one
 * simply stops being requested. That is why it deliberately does not go through
 * `applyCacheHeaders`: there is no cache tag that could invalidate it and
 * nothing for a purge to do. The same reasoning already exempts `pages/api/og.ts`
 * from the two cache-tag static guards, which carry an entry for this file too.
 *
 * @route GET /i18n/[file].js
 */

import type { APIRoute } from 'astro';
import { getI18nAssetBody, I18N_ASSET_EXTENSION, resolveI18nAssetLocale } from '@/lib/i18n-asset';

export const prerender = false;

/** One year, the maximum `max-age` browsers and Cloudflare honour. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export const GET: APIRoute = ({ params }) => {
    // An unknown locale OR a hash that is not the current one both 404. The
    // second half is what makes `immutable` safe: answering a stale URL with
    // this deployment's content would pin the wrong dictionary for a year in
    // every cache that asked, with no way to invalidate it.
    const locale = resolveI18nAssetLocale(`${params.file ?? ''}${I18N_ASSET_EXTENSION}`);
    if (locale === null) {
        return new Response('Not Found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    return new Response(getI18nAssetBody(locale), {
        status: 200,
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': IMMUTABLE_CACHE_CONTROL
        }
    });
};

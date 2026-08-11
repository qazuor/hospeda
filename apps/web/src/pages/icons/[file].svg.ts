/**
 * @file [file].svg.ts
 * @description Serves the hashed, immutable SVG sprite that every Phosphor icon
 * on the page references (HOS-369 W3-6).
 *
 * `GET /icons/sprite.<8 hex>.svg` → one `<symbol>` per glyph per shipped weight.
 * Pages point at it with `<use href="/icons/sprite.<hash>.svg#StarIcon-duotone">`
 * instead of inlining the glyph's paths, so a shape is downloaded once per
 * session rather than re-serialized on every instance on every page.
 *
 * Both the URL and the body come from `@/lib/icon-sprite`, so what this endpoint
 * serves and what the pages request cannot drift apart.
 *
 * TWO naming rules produced this filename, and both are load-bearing — they are
 * the same two that shaped `pages/i18n/[file].js.ts`:
 *
 *  - The directory is `/icons/`, NOT `/_icons/`. Astro removes every
 *    `src/pages/_*` path from the route manifest, so an underscored name would
 *    yield no route at all.
 *  - The `.svg` belongs in the ROUTE (`[file].svg.ts`), not inside the dynamic
 *    param (`[file].ts`). The app runs `trailingSlash: 'always'`, and Astro
 *    applies that to a route whose own path has no file extension —
 *    `/icons/[file]` would compile to the pattern `^\/icons\/([^/]+?)\/$`, which
 *    `/icons/sprite.abc.svg` does not match. Astro's trailing-slash redirect
 *    would not rescue it either: that handler skips any request pathname that
 *    HAS an extension. The result is a 404 for every sprite request — and so
 *    every icon on the site rendering as nothing — in production only, invisible
 *    in dev, in vitest and in `astro check`. With the `.svg` in the route,
 *    `trailingSlashForPath` returns `'never'` and the pattern becomes
 *    `^\/icons\/([^/]+?)\.svg$`.
 *
 * Consequence of that second rule: Astro strips the route's `.svg` suffix before
 * populating `params.file`, so this handler re-appends it to reconstruct the
 * filename the resolver validates.
 *
 * Caching: the response is content-addressed, so it is `immutable` for a year
 * and is NEVER purged — an icon change produces a NEW URL and the old one simply
 * stops being requested. That is why it deliberately does not go through
 * `applyCacheHeaders`: there is no cache tag that could invalidate it and
 * nothing for a purge to do. The same reasoning already exempts `pages/api/og.ts`
 * and `pages/i18n/[file].js.ts` from the two cache-tag static guards, which carry
 * an entry for this file too.
 *
 * @route GET /icons/[file].svg
 */

import type { APIRoute } from 'astro';
import {
    getIconSpriteBody,
    ICON_SPRITE_EXTENSION,
    isCurrentIconSpriteFile
} from '@/lib/icon-sprite';

export const prerender = false;

/** One year, the maximum `max-age` browsers and Cloudflare honour. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export const GET: APIRoute = ({ params }) => {
    // A malformed filename OR a hash that is not the current one both 404. The
    // second half is what makes `immutable` safe: answering a stale URL with
    // this deployment's sprite would pin the wrong symbol set for a year in
    // every cache that asked, with no way to invalidate it — and the pages that
    // requested it reference symbol ids that sprite may not even contain.
    if (!isCurrentIconSpriteFile(`${params.file ?? ''}${ICON_SPRITE_EXTENSION}`)) {
        return new Response('Not Found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    return new Response(getIconSpriteBody(), {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': IMMUTABLE_CACHE_CONTROL
        }
    });
};

/**
 * @file publish-pages-are-not-cacheable.guard.test.ts
 * @description The three publish pages read the session, so none of them may
 * ever be edge-cached (HOS-1156 T-027, AC-8, R-1).
 *
 * ## Why this needs its own guard
 *
 * `cacheable-routes-parse-no-session.guard.test.ts` checks the invariant from
 * the other end: nothing on the cacheable list may be session-optional. It would
 * stay green if somebody added `publicar` to that list AND removed it from
 * `SESSION_OPTIONAL_SEGMENTS` in the same change — at which point these pages
 * would be cacheable and `Astro.locals.user` would be `null` on all three, so
 * every visitor would silently get the signed-out CTA. This guard asserts the
 * pairing that keeps that from being a quiet regression.
 *
 * The stakes are the ones R-1 records. A personalised response that reaches a
 * shared cache is served to the NEXT visitor: here that would be one owner's
 * draft names and quota, on a page anyone can open from the navbar.
 *
 * ## What it deliberately does not check
 *
 * Whether Cloudflare has a Cache Rule for `/publicar/*`. That lives in the
 * Cloudflare dashboard, not in this repo — see the sibling guard's own note.
 * What is checkable here is that the repo never declares the intent.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PROTECTED_SEGMENTS, SESSION_OPTIONAL_SEGMENTS } from '@/lib/routes';

/** The three pages this spec ships, and the route segment they all share. */
const PUBLISH_PAGES: ReadonlyArray<{ readonly route: string; readonly file: string }> = [
    { route: '/{lang}/publicar/', file: 'publicar/index.astro' },
    { route: '/{lang}/publicar/gastronomia/', file: 'publicar/gastronomia/index.astro' },
    { route: '/{lang}/publicar/experiencias/', file: 'publicar/experiencias/index.astro' }
];

/** The second path segment of every publish route. */
const PUBLISH_SEGMENT = 'publicar';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

function readPage(file: string): string {
    return readFileSync(resolve(PAGES_DIR, file), 'utf8');
}

/**
 * The cacheable families, read from the sibling guard's source rather than
 * re-declared.
 *
 * A second hand-maintained copy of that list would drift, and the drift would be
 * invisible: this guard would keep passing against a stale list while the real
 * one had grown an entry that breaks these pages.
 */
function cacheableFamiliesFromSiblingGuard(): readonly string[] {
    const src = readFileSync(
        resolve(__dirname, '../lib/cacheable-routes-parse-no-session.guard.test.ts'),
        'utf8'
    );
    const start = src.indexOf('const CACHEABLE_ROUTE_FAMILIES');
    const end = src.indexOf('];', start);
    expect(start, 'the sibling guard no longer declares CACHEABLE_ROUTE_FAMILIES').toBeGreaterThan(
        -1
    );
    return [...src.slice(start, end).matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

describe('HOS-1156 AC-8 — the publish pages are never edge-cached', () => {
    it('reads a non-empty cacheable list from the sibling guard', () => {
        // Non-vacuity: an empty list, or a rename that broke the extraction,
        // would make every assertion below pass without checking anything.
        expect(cacheableFamiliesFromSiblingGuard().length).toBeGreaterThan(3);
    });

    it('the publicar segment is not on the cacheable list', () => {
        expect(cacheableFamiliesFromSiblingGuard()).not.toContain(PUBLISH_SEGMENT);
    });

    it('the publicar segment IS session-optional, which is what makes the pages work', () => {
        // The pages branch on `Astro.locals.user`: signed-out visitors get the
        // signup CTA, everyone else gets a precheck. Off this list the session is
        // never parsed and all three states collapse into the first one.
        expect(SESSION_OPTIONAL_SEGMENTS as ReadonlyArray<string>).toContain(PUBLISH_SEGMENT);
    });

    it('the publicar segment is not protected — these pages are public (D-1)', () => {
        // A public navbar button must not land on a login redirect. Adding
        // `publicar` here would reintroduce exactly that, at the middleware
        // level, where no page-level test would see it.
        expect(PROTECTED_SEGMENTS as ReadonlyArray<string>).not.toContain(PUBLISH_SEGMENT);
    });

    for (const page of PUBLISH_PAGES) {
        it(`${page.route} declares prerender = false`, () => {
            // A prerendered page has no request to read a cookie from, so it
            // would build once, signed out, and serve that to everyone.
            expect(readPage(page.file)).toContain('export const prerender = false;');
        });

        it(`${page.route} does not opt into any cache header`, () => {
            const src = readPage(page.file);
            expect(src).not.toContain('Cache-Control');
            expect(src).not.toContain('cacheTTL');
        });
    }
});

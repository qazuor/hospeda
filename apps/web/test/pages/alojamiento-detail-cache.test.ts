/**
 * @file alojamiento-detail-cache.test.ts
 * @description HOS-369 — the accommodation detail page opts into the edge
 * cache, tagged by its own entity rather than by the collection.
 *
 * This is the first page to use `buildEntityCacheTags`, which shipped with W1-1
 * and had no call site until now. The scoping is the point: tagging a detail
 * page with `list-accom` would make every accommodation write evict every other
 * accommodation's page, which is the opposite of what selective purge is for.
 *
 * `.astro` frontmatter cannot render in Vitest, so these are source-based —
 * the established pattern here (see `alojamientos-ssr-cache.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DETAIL_PAGE = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro');

/**
 * Extracts the argument text of a call, anchored on the call itself so it can
 * never match the import statement instead — the mistake that made an earlier
 * assertion in `alojamientos-ssr-cache.test.ts` inspect a block of imports and
 * pass vacuously.
 */
function callArgsOf(source: string, call: string): string {
    const start = source.indexOf(`${call}(`);
    expect(start, `${call}( not found`).toBeGreaterThan(-1);

    let depth = 0;
    for (let i = start + call.length; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        if (char === ')') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced parentheses after ${call}(`);
}

describe('accommodation detail page — edge cacheability (HOS-369)', () => {
    const source = readFileSync(DETAIL_PAGE, 'utf8');

    it('opts into the edge cache through applyCacheHeaders', () => {
        // Not by setting `Cache-Control` itself: that path is blocked by the
        // static guard precisely because it lets a page ship a cacheable
        // response with no purge tags.
        expect(source).toContain('applyCacheHeaders({');
    });

    it('derives its tags from the entity, carrying BOTH the slug and the id', () => {
        const args = callArgsOf(source, 'buildEntityCacheTags');

        expect(args).toContain("entity: 'accommodation'");
        // Both identifiers, because the ~40 revalidation call sites are not
        // consistent about which one they hold — emitting one while purging by
        // the other purges nothing, silently.
        expect(args).toMatch(/\bslug\b/);
        expect(args).toMatch(/\bid:\s*accommodation\.id\b/);
    });

    it('is NOT tagged with the accommodation collection as a listing would be', () => {
        // A detail page tagged `list-accom` would be evicted by every write to
        // any other accommodation. The only mention of the collection is the
        // unreachable branch of the tuple-type fallback, which never reaches a
        // response — so the tags actually passed must come from the entity
        // helper, not from the collection constant.
        const args = callArgsOf(source, 'applyCacheHeaders');
        expect(args).toContain('primaryCacheTag');
        expect(args).toContain('extraCacheTags');
    });

    it('stays private for any request carrying a query string', () => {
        // Every `ctx*` on this page comes from a search param and feeds the
        // WhatsApp prefill with the visitor's dates and party size, so a
        // query-bearing render is visitor-specific. The Cloudflare rule already
        // bypasses on a non-empty query; this is the origin refusing to MARK it
        // shareable, which must hold regardless of what the edge is configured
        // to do.
        const args = callArgsOf(source, 'applyCacheHeaders');
        expect(args).toContain("Astro.url.search === ''");
    });

    it('declares cacheability only AFTER the 404/410 guards', () => {
        // Marking an error response `public, s-maxage=300` would pin a 404 at
        // the edge for five minutes. The guards return before this point, so
        // the ordering is the whole protection.
        const guardIndex = source.indexOf('status: result.error.status === 410 ? 410 : 404');
        const cacheIndex = source.indexOf('applyCacheHeaders({');

        expect(guardIndex).toBeGreaterThan(-1);
        expect(cacheIndex).toBeGreaterThan(guardIndex);
    });

    it('reads no session state, which is what makes the response shareable', () => {
        // Also enforced fail-closed for every page by
        // `cacheable-pages-are-session-blind.guard.test.ts`. Repeated here so a
        // reader of THIS file sees the precondition the caching depends on.
        expect(source).not.toContain('Astro.locals.user');
        expect(source).not.toMatch(/locals\s+as\s+\{[^}]*user/);
    });
});

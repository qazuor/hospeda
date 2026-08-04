/**
 * @file catalog-cache.test.ts
 * @description HOS-369 W2-3 — destinations, events and posts opt into the edge cache.
 *
 * Three families whose purge side ALREADY existed and evicted nothing:
 * `entity-tag-mapper.ts` has emitted `list-dest` / `list-event` / `list-post`
 * and the `dest-` / `event-` / `post-` entity tags since long before any page
 * declared them. These assertions pin the emitter half so the two cannot drift
 * apart again — the same silent no-op the `home` tag sat in before W2-1.
 *
 * Deliberately NOT covered, because their purge chain does not exist yet
 * (no vocabulary entry, no `entity-tag-mapper` case, no `scheduleRevalidation`
 * call in their services): `/destinos/atraccion/`, `/destinos/lugar/`,
 * `/gastronomia/`, `/experiencias/`. Caching those today would manufacture the
 * exact unpurgeable-response failure this suite exists to prevent.
 *
 * `.astro` frontmatter cannot render in Vitest, so these are source-based —
 * the established pattern here (see `home-cache.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** A page, the tag it must declare, and how it decides cacheability. */
interface CatalogPage {
    readonly path: string;
    /**
     * For a `collection` page, the identifier that must appear inside the
     * `applyCacheHeaders` call. For an `entity` page, the `entity:` value that
     * must be passed to `buildEntityCacheTags` — that call happens BEFORE
     * `applyCacheHeaders` (it derives the tag the call then spreads), so it is
     * asserted against the whole source, not against the call's arguments.
     */
    readonly tag: string;
    /** `collection` uses a static tag; `entity` derives per-entity tags. */
    readonly kind: 'collection' | 'entity';
    /** How the `cacheable` argument is expected to be decided. */
    readonly gate: 'always' | 'pagination-only' | 'facet-seo' | 'entity-tag';
}

const CATALOG_PAGES: readonly CatalogPage[] = [
    // --- destinations ---
    {
        path: 'destinos/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.destination',
        kind: 'collection',
        gate: 'always'
    },
    {
        path: 'destinos/mapa.astro',
        tag: 'CACHE_TAG_COLLECTIONS.destination',
        kind: 'collection',
        gate: 'always'
    },
    { path: 'destinos/[...path].astro', tag: 'destination', kind: 'entity', gate: 'entity-tag' },
    {
        path: 'destinos/[slug]/alojamientos/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.accommodation',
        kind: 'collection',
        gate: 'pagination-only'
    },
    {
        path: 'destinos/[slug]/eventos/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.event',
        kind: 'collection',
        gate: 'pagination-only'
    },
    // --- events ---
    {
        path: 'eventos/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.event',
        kind: 'collection',
        gate: 'facet-seo'
    },
    { path: 'eventos/[slug].astro', tag: 'event', kind: 'entity', gate: 'entity-tag' },
    {
        path: 'eventos/categoria/[category]/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.event',
        kind: 'collection',
        gate: 'pagination-only'
    },
    {
        path: 'eventos/en/[slug]/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.event',
        kind: 'collection',
        gate: 'pagination-only'
    },
    // --- posts ---
    {
        path: 'publicaciones/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.post',
        kind: 'collection',
        gate: 'facet-seo'
    },
    { path: 'publicaciones/[slug].astro', tag: 'post', kind: 'entity', gate: 'entity-tag' },
    {
        path: 'publicaciones/autor/[slug]/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.post',
        kind: 'collection',
        gate: 'pagination-only'
    },
    {
        path: 'publicaciones/categoria/[category]/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.post',
        kind: 'collection',
        gate: 'pagination-only'
    },
    {
        path: 'publicaciones/etiqueta/[tag]/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.post',
        kind: 'collection',
        gate: 'pagination-only'
    }
] as const;

/**
 * The six pages W2-3 deliberately left uncached, now cacheable.
 *
 * W2-4 built the purge chain they were waiting on: entries in
 * `@repo/cache-tags`, `EntityChangeData` variants, `entity-tag-mapper` cases,
 * and a `scheduleRevalidation` call in each service. The standing assertion
 * that used to guard them (`stays uncached until its purge chain exists`) has
 * done its job and is replaced by real coverage below.
 *
 * `attraction` and `pointOfInterest` have NO collection tag on purpose —
 * nothing lists them — so they are checked separately from the two commerce
 * families.
 */
const W2_4_PAGES = [
    {
        path: 'gastronomia/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.gastronomy',
        kind: 'collection'
    },
    {
        path: 'experiencias/index.astro',
        tag: 'CACHE_TAG_COLLECTIONS.experience',
        kind: 'collection'
    },
    { path: 'gastronomia/[slug].astro', tag: 'gastronomy', kind: 'entity' },
    { path: 'experiencias/[slug].astro', tag: 'experience', kind: 'entity' },
    { path: 'destinos/atraccion/[slug]/index.astro', tag: 'attraction', kind: 'entity' },
    { path: 'destinos/lugar/[slug]/index.astro', tag: 'pointOfInterest', kind: 'entity' }
] as const;

/** The two W2-4 entities that have a detail page but no listing anywhere. */
const NO_COLLECTION_PAGES = [
    'destinos/atraccion/[slug]/index.astro',
    'destinos/lugar/[slug]/index.astro'
] as const;

/** Argument text of a call, anchored on the call so it cannot match an import. */
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

function readPage(relative: string): string {
    return readFileSync(resolve(__dirname, '../../src/pages/[lang]', relative), 'utf8');
}

describe('catalog pages — edge cacheability (HOS-369 W2-3)', () => {
    it.each(CATALOG_PAGES)('$path opts in through applyCacheHeaders', ({ path }) => {
        // Not by setting `Cache-Control` itself — that path is blocked by the
        // static guard, because it lets a page ship a cacheable response with
        // no purge tags.
        expect(readPage(path)).toContain('applyCacheHeaders({');
    });

    it.each(CATALOG_PAGES.filter((p) => p.kind === 'collection'))('$path declares $tag', ({
        path,
        tag
    }) => {
        const args = callArgsOf(readPage(path), 'applyCacheHeaders');
        // Escaped for the `.` in `CACHE_TAG_COLLECTIONS.destination`, and
        // word-anchored so a longer identifier containing this one cannot
        // pass — `toContain` would also accept `…destinationSomething`.
        expect(args).toMatch(new RegExp(`\\b${tag.replace(/\./g, '\\.')}\\b`));
    });

    it.each(
        CATALOG_PAGES.filter((p) => p.kind === 'entity')
    )('$path derives its tags from the $tag entity', ({ path, tag }) => {
        // `buildEntityCacheTags` is called BEFORE `applyCacheHeaders` (it
        // produces the tag the call then spreads), so this asserts against
        // the whole source. Pinning the `entity:` value is what makes the
        // assertion mean something: a detail page wired to the wrong
        // entity would emit tags no write ever purges.
        const source = readPage(path);
        expect(source).toMatch(
            new RegExp(`buildEntityCacheTags\\(\\{\\s*\\n?\\s*entity:\\s*'${tag}'`)
        );
    });

    it.each(
        CATALOG_PAGES.filter((p) => p.kind === 'entity')
    )('$path is a detail page and must NOT be tagged with its collection', ({ path }) => {
        // A detail page tagged with its collection would be evicted by
        // every sibling's write. The ternary's fallback arm DOES name the
        // collection tag, but only to satisfy the non-empty tuple type on
        // a branch `applyCacheHeaders` returns before reaching. So assert
        // the shape — the passed tags come from the derived entity tag —
        // rather than the mere absence of the collection identifier.
        const args = callArgsOf(readPage(path), 'applyCacheHeaders');
        expect(args).toMatch(/tags:\s*\n?\s*\w*Tag\s*!==\s*undefined/);
        expect(args).toMatch(/\?\s*\[\s*\w*Tag,\s*\.\.\.\w+\s*\]/);
    });

    it.each(
        CATALOG_PAGES.filter((p) => p.gate === 'pagination-only')
    )('$path gates on hasOnlyPaginationParams, not on an empty query', ({ path }) => {
        // `Astro.url.search === ''` would look correct on page 1 and
        // silently stop caching every `/page/N/`, which rewrites here with
        // `?page=N` appended.
        const source = readPage(path);
        const args = callArgsOf(source, 'applyCacheHeaders');
        expect(args).toContain('hasOnlyPaginationParams');
        expect(args).not.toContain("Astro.url.search === ''");
    });

    it.each(
        CATALOG_PAGES.filter((p) => p.gate === 'facet-seo')
    )('$path reuses its own SEO predicate rather than a parallel one', ({ path }) => {
        const args = callArgsOf(readPage(path), 'applyCacheHeaders');
        expect(args).toContain('facetSeoDecision.noindex');
        // `hasActiveFilters` on the posts listing also counts `page > 1`
        // and a non-default sort, because it drives empty-state copy.
        // Using it here would mark every paginated and sorted page
        // private — a large silent loss of coverage. Only the
        // `hasOther*Filters` variants are correct.
        expect(args).toMatch(/hasOther\w*Filters/);
        expect(args).not.toMatch(/[^r]\bhasActiveFilters\b/);
    });

    it.each(
        CATALOG_PAGES.filter((p) => p.gate === 'always')
    )('$path is cacheable unconditionally', ({ path }) => {
        const args = callArgsOf(readPage(path), 'applyCacheHeaders');
        expect(args).toMatch(/cacheable:\s*true/);
    });

    it.each(CATALOG_PAGES)('$path reads no session state', ({ path }) => {
        // Also enforced fail-closed for every page by
        // `cacheable-pages-are-session-blind.guard.test.ts`. Repeated here so a
        // reader of THIS file sees the precondition the caching depends on.
        const source = readPage(path);
        expect(source).not.toContain('Astro.locals.user');
        expect(source).not.toMatch(/locals\s+as\s+\{[^}]*user/);
    });
});

describe('W2-4 pages — cacheable now that their purge chain exists (HOS-369)', () => {
    it.each(W2_4_PAGES)('$path opts in through applyCacheHeaders', ({ path }) => {
        expect(readPage(path)).toContain('applyCacheHeaders({');
    });

    it.each(W2_4_PAGES.filter((p) => p.kind === 'collection'))('$path declares $tag', ({
        path,
        tag
    }) => {
        const args = callArgsOf(readPage(path), 'applyCacheHeaders');
        expect(args).toMatch(new RegExp(`\\b${tag.replace(/\./g, '\\.')}\\b`));
    });

    it.each(
        W2_4_PAGES.filter((p) => p.kind === 'entity')
    )('$path derives its tags from the $tag entity', ({ path, tag }) => {
        const source = readPage(path);
        expect(source).toMatch(
            new RegExp(`buildEntityCacheTags\\(\\{\\s*\\n?\\s*entity:\\s*'${tag}'`)
        );
    });

    it.each(NO_COLLECTION_PAGES)('%s falls back to an id tag, not a collection tag', (path) => {
        // These two have no collection tag to fall back to — that is the whole
        // reason `CACHE_TAG_COLLECTIONS` became partial in W2-4. If somebody
        // later adds `list-attr`/`list-poi` to satisfy a type, this catches it:
        // a collection tag for something nothing lists is a tag nothing purges.
        const args = callArgsOf(readPage(path), 'applyCacheHeaders');
        expect(args).not.toContain('CACHE_TAG_COLLECTIONS');
    });

    it.each(W2_4_PAGES)('$path reads no session state', ({ path }) => {
        const source = readPage(path);
        expect(source).not.toContain('Astro.locals.user');
        expect(source).not.toMatch(/locals\s+as\s+\{[^}]*user/);
    });

    it('the commerce detail pages cache only AFTER their visibility gate', () => {
        // A PRIVATE or RESTRICTED listing 404s before reaching
        // `applyCacheHeaders`. If the call ever moves above that gate, a
        // non-public listing becomes shareable from the edge — the worst
        // possible cache bug, and one no page would visibly fail on.
        for (const path of ['gastronomia/[slug].astro', 'experiencias/[slug].astro']) {
            const source = readPage(path);
            const gate = source.indexOf("visibility !== 'PUBLIC'");
            const call = source.indexOf('applyCacheHeaders({');
            expect(gate, `${path}: visibility gate not found`).toBeGreaterThan(-1);
            expect(call, `${path}: cache call must come after the gate`).toBeGreaterThan(gate);
        }
    });

    it('the POI page caches only AFTER the hasOwnPage gate', () => {
        // `hasOwnPage` separates a curated landmark from the 839 catalog rows
        // that must never get a URL. Caching before it would share pages that
        // are supposed to 404.
        const source = readPage('destinos/lugar/[slug]/index.astro');
        const gate = source.indexOf('hasOwnPage !== true');
        const call = source.indexOf('applyCacheHeaders({');
        expect(gate).toBeGreaterThan(-1);
        expect(call).toBeGreaterThan(gate);
    });
});

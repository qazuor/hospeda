/**
 * @file listing-pagination.guard.test.ts
 * @description Static guard for HOS-1797: every vertical listing paginates
 * through the ONE shared mechanism in `src/lib/listing/listing-pagination.ts`.
 *
 * What it fails on:
 * 1. a vertical listing that renders `<Pagination>` (so its links and canonical
 *    point at `.../page/N/`) with no sibling `page/[page].astro` — the exact
 *    shape of the gastronomy/experiences bug, where every page 2+ canonicalized
 *    to a 404;
 * 2. a `page/[page].astro` shim that decides by hand (own `Astro.rewrite`,
 *    `Astro.redirect` or `Number(...)`) instead of calling
 *    `handlePaginationRoute`;
 * 3. a listing that hand-builds the `page/${n}/` path instead of using
 *    `buildPaginationLinks` / `buildPaginatedPath`.
 *
 * Fail-closed: the sweep walks the vertical trees, so a new listing is checked
 * the moment it is created. Source text only; it cannot see a path built
 * through some other helper.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = join(__dirname, '../../src/pages/[lang]');

/** Vertical listing trees, relative to `src/pages/[lang]`. */
const VERTICAL_ROOTS = ['alojamientos', 'comer-y-salir', 'experiencias'] as const;

/** Vertical listings living outside those trees. */
const EXTRA_LISTINGS = ['destinos/[slug]/alojamientos/index.astro'] as const;

function collect({ dir, name }: { readonly dir: string; readonly name: string }): string[] {
    if (!existsSync(dir)) return [];
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...collect({ dir: abs, name }));
        else if (entry.isFile() && entry.name === name) found.push(abs);
    }
    return found;
}

/** Listings that render `<Pagination` (and so link to `/page/N/`). */
function findPaginatedListings(): string[] {
    const files = [
        ...VERTICAL_ROOTS.flatMap((root) =>
            collect({ dir: join(PAGES_ROOT, root), name: 'index.astro' })
        ),
        ...EXTRA_LISTINGS.map((p) => join(PAGES_ROOT, ...p.split('/')))
    ];
    return files.filter((f) => existsSync(f) && readFileSync(f, 'utf8').includes('<Pagination'));
}

/** Violations of rule 1 and 3 for one listing source. */
function listingViolations({
    source,
    hasShim
}: {
    readonly source: string;
    readonly hasShim: boolean;
}): string[] {
    const out: string[] = [];
    if (!hasShim) out.push('renders <Pagination> but has no sibling page/[page].astro');
    if (/page\/\$\{/.test(source)) {
        out.push('builds the page/N/ path by hand; use buildPaginationLinks');
    }
    return out;
}

/** Violations of rule 2 for one shim source. */
function shimViolations({ source }: { readonly source: string }): string[] {
    const out: string[] = [];
    if (!source.includes('handlePaginationRoute')) out.push('does not call handlePaginationRoute');
    if (/Astro\.(rewrite|redirect)\(/.test(source)) out.push('rewrites/redirects by hand');
    if (/Number\(/.test(source)) out.push('parses the page param by hand');
    return out;
}

const rel = (abs: string) => relative(PAGES_ROOT, abs).split(sep).join('/');

describe('listing pagination guard (HOS-1797)', () => {
    const listings = findPaginatedListings();

    it('finds the vertical listings (non-vacuity of the sweep)', () => {
        const names = listings.map(rel);
        expect(names).toContain('alojamientos/index.astro');
        expect(names).toContain('comer-y-salir/index.astro');
        expect(names).toContain('experiencias/index.astro');
        expect(names.length).toBeGreaterThanOrEqual(6);
    });

    for (const listing of listings) {
        describe(rel(listing), () => {
            const shim = join(listing, '..', 'page', '[page].astro');
            const source = readFileSync(listing, 'utf8');

            it('has a pagination shim and builds no page path by hand', () => {
                expect(listingViolations({ source, hasShim: existsSync(shim) })).toEqual([]);
            });

            it('delegates its shim to the shared handler', () => {
                if (!existsSync(shim)) return;
                expect(shimViolations({ source: readFileSync(shim, 'utf8') })).toEqual([]);
            });
        });
    }

    it('every vertical page/[page].astro is a shared-handler shim', () => {
        const shims = VERTICAL_ROOTS.flatMap((root) =>
            collect({ dir: join(PAGES_ROOT, root), name: '[page].astro' })
        );
        expect(shims.length).toBeGreaterThanOrEqual(6);
        for (const shim of shims) {
            expect({
                shim: rel(shim),
                v: shimViolations({ source: readFileSync(shim, 'utf8') })
            }).toEqual({ shim: rel(shim), v: [] });
        }
    });

    describe('detectors are not vacuous', () => {
        it('flags a listing with no shim', () => {
            expect(listingViolations({ source: '<Pagination />', hasShim: false })).toHaveLength(1);
        });

        it('flags a hand-built page path', () => {
            // biome-ignore lint/suspicious/noTemplateCurlyInString: synthetic source text
            const src = 'const c = `${baseUrl}page/${page}/`;';
            expect(listingViolations({ source: src, hasShim: true })).toHaveLength(1);
        });

        it('flags a hand-rolled shim', () => {
            // biome-ignore lint/suspicious/noTemplateCurlyInString: synthetic source text
            const src = 'return Astro.rewrite(`/x/?page=${Number(p)}`);';
            expect(shimViolations({ source: src }).length).toBeGreaterThanOrEqual(3);
        });

        it('accepts a conforming shim', () => {
            const src = 'return handlePaginationRoute({ astro: Astro, basePath: "/" });';
            expect(shimViolations({ source: src })).toEqual([]);
        });
    });
});

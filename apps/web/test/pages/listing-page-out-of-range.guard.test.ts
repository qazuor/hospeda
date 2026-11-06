/**
 * @file listing-page-out-of-range.guard.test.ts
 * @description HOS-1981: a `/page/N/` beyond the last page must answer 404, never
 * 200 with an empty `index,follow` list (a soft 404).
 *
 * Two layers:
 * 1. behaviour of the shared predicate `isPageOutOfRange`, table-driven;
 * 2. a static sweep over EVERY listing under `src/pages/[lang]` that renders
 *    `<Pagination` or owns a `page/[page].astro` shim: it must call the shared
 *    predicate (or the author twin, same rule) and answer 404 with it. Fail-closed,
 *    so a new paginated listing is checked the moment it exists.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAuthorPageOutOfRange } from '../../src/lib/authors/author-page-pagination';
import { isPageOutOfRange } from '../../src/lib/listing/listing-pagination';

const PAGES_ROOT = join(__dirname, '../../src/pages/[lang]');

function walk({ dir }: { readonly dir: string }): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk({ dir: abs }));
        else if (entry.isFile()) out.push(abs);
    }
    return out;
}

/** Index pages that only redirect: their pages are rendered (and checked) elsewhere. */
const REDIRECT_ONLY = new Set(['destinos/index.astro', 'autores/[slug]/eventos/index.astro']);

const rel = (abs: string) => relative(PAGES_ROOT, abs).split(sep).join('/');

const CASES: ReadonlyArray<{
    readonly name: string;
    readonly page: number;
    readonly totalPages: number | null;
    readonly expected: boolean;
}> = [
    { name: 'page beyond total', page: 99, totalPages: 2, expected: true },
    { name: 'first page past the end', page: 3, totalPages: 2, expected: true },
    { name: 'last valid page', page: 2, totalPages: 2, expected: false },
    { name: 'middle page', page: 2, totalPages: 5, expected: false },
    { name: 'page 1 of an empty listing', page: 1, totalPages: 0, expected: false },
    { name: 'page 2 of an empty listing', page: 2, totalPages: 0, expected: true },
    { name: 'failed fetch (unknown total)', page: 99, totalPages: null, expected: false }
];

describe('isPageOutOfRange (HOS-1981)', () => {
    for (const c of CASES) {
        it(c.name, () => {
            expect(isPageOutOfRange({ page: c.page, totalPages: c.totalPages })).toBe(c.expected);
        });
    }

    it('the author twin applies the same rule', () => {
        for (const c of CASES) {
            expect(isAuthorPageOutOfRange({ page: c.page, totalPages: c.totalPages })).toBe(
                c.expected
            );
        }
    });
});

describe('every paginated listing 404s out-of-range pages (HOS-1981)', () => {
    const listings = walk({ dir: PAGES_ROOT }).filter((f) => {
        if (!f.endsWith(`${sep}index.astro`)) return false;
        const hasShim = existsSync(join(f, '..', 'page', '[page].astro'));
        return hasShim || readFileSync(f, 'utf8').includes('<Pagination');
    });

    it('finds the listings (non-vacuity)', () => {
        const names = listings.map(rel);
        expect(names).toContain('alojamientos/index.astro');
        expect(names).toContain('eventos/index.astro');
        expect(names).toContain('publicaciones/index.astro');
        expect(names).toContain('autores/[slug]/index.astro');
        expect(names.length).toBeGreaterThanOrEqual(15);
    });

    for (const listing of listings) {
        // The destinations listing no longer paginates; its shim only redirects.
        if (REDIRECT_ONLY.has(rel(listing))) continue;
        it(`${rel(listing)} answers 404 through the shared predicate`, () => {
            const source = readFileSync(listing, 'utf8');
            expect(source).toMatch(
                /(isPageOutOfRange|isAuthorPageOutOfRange)\([\s\S]{0,300}?status: 404/
            );
        });
    }
});

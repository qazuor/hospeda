/**
 * @file account-pagination.test.ts
 * @description Regression tests (HOS-2440): the properties, events and posts
 * lists in `/mi-cuenta/` were silently cut at 50. They now page through the
 * URL; these tests cover the page maths with more than 50 items and the wiring
 * of the three pages.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    ACCOUNT_LIST_PAGE_SIZE,
    buildAccountPageHref,
    fetchListTotal,
    parsePageParam,
    resolveAccountPageState
} from '@/lib/account-pagination';

describe('parsePageParam', () => {
    it.each([
        [null, 1],
        [undefined, 1],
        ['', 1],
        ['abc', 1],
        ['0', 1],
        ['-3', 1],
        ['2.5', 1],
        ['3', 3],
        ['99999999', 10_000]
    ])('parses %s as %i', (value, expected) => {
        expect(parsePageParam({ value })).toBe(expected);
    });
});

describe('resolveAccountPageState with more than 50 items', () => {
    it('reports every item reachable: 120 items need 6 pages of 20', () => {
        const state = resolveAccountPageState({ requestedPage: 1, total: 120 });
        expect(ACCOUNT_LIST_PAGE_SIZE * state.totalPages).toBeGreaterThanOrEqual(120);
        expect(state.totalPages).toBe(6);
        expect(state.isPastEnd).toBe(false);
    });

    it('keeps 51 items from vanishing: the 51st lands on page 3', () => {
        expect(resolveAccountPageState({ requestedPage: 3, total: 51 })).toEqual({
            page: 3,
            totalPages: 3,
            isPastEnd: false
        });
    });

    it('flags a page past the end so the page can redirect instead of showing "empty"', () => {
        expect(resolveAccountPageState({ requestedPage: 9, total: 51 }).isPastEnd).toBe(true);
    });

    it('treats an unknown or empty total as a single page', () => {
        expect(resolveAccountPageState({ requestedPage: 1, total: null }).totalPages).toBe(1);
        expect(resolveAccountPageState({ requestedPage: 4, total: 0 }).isPastEnd).toBe(false);
    });
});

describe('buildAccountPageHref', () => {
    it('keeps page 1 query-free and adds ?page=N after it', () => {
        expect(buildAccountPageHref({ locale: 'es', path: 'mi-cuenta/eventos', page: 1 })).toBe(
            '/es/mi-cuenta/eventos/'
        );
        expect(buildAccountPageHref({ locale: 'en', path: 'mi-cuenta/eventos', page: 3 })).toBe(
            '/en/mi-cuenta/eventos/?page=3'
        );
    });
});

describe('the three list pages page instead of capping at 50', () => {
    const read = (rel: string): string =>
        readFileSync(resolve(__dirname, '../../src/pages/[lang]/mi-cuenta', rel), 'utf8');

    it.each([
        'eventos/index.astro',
        'publicaciones/index.astro'
    ])('%s requests the page from the URL and renders the pager', (rel) => {
        const source = read(rel);
        expect(source).not.toMatch(/pageSize(=|:\s*)50/);
        expect(source).toContain('parsePageParam');
        expect(source).toContain('ACCOUNT_LIST_PAGE_SIZE');
        expect(source).toContain('<AccountPagination');
        expect(source).toContain('pageState.isPastEnd');
    });

    it('propiedades/index.astro (kit, HOS-2483) requests the page and renders the kit Pagination', () => {
        const source = read('propiedades/index.astro');
        expect(source).not.toMatch(/pageSize(=|:\s*)50/);
        expect(source).toContain('parsePageParam');
        expect(source).toContain('ACCOUNT_LIST_PAGE_SIZE');
        expect(source).toMatch(/pageState\.totalPages > 1 && \(\s*<Pagination/);
        expect(source).toContain('pageCount={pageState.totalPages}');
        expect(source).toContain('pageState.isPastEnd');
    });

    it('propiedades reads owner-wide published and draft counts, not the page', () => {
        const source = read('propiedades/index.astro');
        expect(source).toContain('publicationStatus=${status}');
        expect(source).toContain('publishedTotal ??');
        expect(source).toContain('draftTotal !== null');
    });
});

describe('AccountPagination.astro', () => {
    const source = readFileSync(
        resolve(__dirname, '../../src/components/account/AccountPagination.astro'),
        'utf8'
    );

    it('renders nothing for a single page and labels its controls from i18n', () => {
        expect(source).toContain('totalPages > 1 &&');
        expect(source).toContain("t('common.prevPage'");
        expect(source).toContain("t('common.nextPage'");
        expect(source).toContain("t('common.pagination'");
    });

    it('uses plain links with rel prev/next so it works without JavaScript', () => {
        expect(source).toContain('rel="prev"');
        expect(source).toContain('rel="next"');
    });
});

describe('fetchListTotal is non-fatal (HOS-2440)', () => {
    const call = (fetchImpl: typeof fetch) =>
        fetchListTotal({ url: 'https://api.test/x', headers: {}, fetchImpl });

    it('returns the total on a good answer', async () => {
        const ok = vi.fn(async () =>
            Response.json({ data: { pagination: { total: 7 } } })
        ) as unknown as typeof fetch;
        expect(await call(ok)).toBe(7);
    });

    it('resolves null instead of throwing on a network reject', async () => {
        const reject = vi.fn(async () => {
            throw new Error('network down');
        }) as unknown as typeof fetch;
        expect(await call(reject)).toBeNull();
    });

    it('resolves null on a 200 with a non-JSON body', async () => {
        const html = vi.fn(
            async () => new Response('<html>', { status: 200 })
        ) as unknown as typeof fetch;
        expect(await call(html)).toBeNull();
    });

    it('resolves null on a non-2xx and on a missing total', async () => {
        const bad = vi.fn(
            async () => new Response('{}', { status: 500 })
        ) as unknown as typeof fetch;
        const empty = vi.fn(async () => Response.json({ data: {} })) as unknown as typeof fetch;
        expect(await call(bad)).toBeNull();
        expect(await call(empty)).toBeNull();
    });

    it('the page uses it for both counts, outside the list fetch error path', () => {
        const source = readFileSync(
            resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/propiedades/index.astro'),
            'utf8'
        );
        expect(source.match(/fetchListTotal\(/g)).toHaveLength(2);
    });
});

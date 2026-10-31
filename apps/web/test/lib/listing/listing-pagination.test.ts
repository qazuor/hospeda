/**
 * @file listing-pagination.test.ts
 * @description Unit tests for the shared listing pagination helper (HOS-1797).
 */

import { describe, expect, it, vi } from 'vitest';
import {
    buildPaginatedPath,
    buildPaginationLinks,
    handlePaginationRoute,
    PAGE_ONE_REDIRECT_STATUS,
    parsePageParam,
    resolvePaginationRoute
} from '../../../src/lib/listing/listing-pagination';

const BASE = '/es/comer-y-salir/';

describe('parsePageParam', () => {
    it.each(['1', '2', '10', '999999'])('accepts canonical page %s', (raw) => {
        expect(parsePageParam({ pageParam: raw })).toBe(Number(raw));
    });

    it.each([
        undefined,
        '',
        '0',
        '-1',
        '02',
        '2.0',
        '1e1',
        ' 2',
        'abc',
        '1000000'
    ])('rejects %j', (raw) => {
        expect(parsePageParam({ pageParam: raw })).toBeNull();
    });
});

describe('resolvePaginationRoute', () => {
    it('answers not-found for an invalid page param', () => {
        const decision = resolvePaginationRoute({ pageParam: 'x', basePath: BASE, search: '' });
        expect(decision).toEqual({ kind: 'not-found' });
    });

    it('redirects page 1 to the listing root', () => {
        const decision = resolvePaginationRoute({ pageParam: '1', basePath: BASE, search: '' });
        expect(decision).toEqual({
            kind: 'redirect',
            location: BASE,
            status: PAGE_ONE_REDIRECT_STATUS
        });
    });

    it('keeps filters and drops a stray page param when redirecting page 1', () => {
        const decision = resolvePaginationRoute({
            pageParam: '1',
            basePath: BASE,
            search: '?type=BAR&page=7'
        });
        expect(decision).toMatchObject({ kind: 'redirect', location: `${BASE}?type=BAR` });
    });

    it('rewrites page N to the listing with ?page=N', () => {
        const decision = resolvePaginationRoute({ pageParam: '3', basePath: BASE, search: '' });
        expect(decision).toEqual({ kind: 'rewrite', target: `${BASE}?page=3` });
    });

    it('lets the path win over a conflicting ?page and keeps filters', () => {
        const decision = resolvePaginationRoute({
            pageParam: '3',
            basePath: BASE,
            search: '?type=BAR&page=9'
        });
        expect(decision).toEqual({ kind: 'rewrite', target: `${BASE}?type=BAR&page=3` });
    });
});

describe('handlePaginationRoute', () => {
    const makeAstro = (page: string | undefined, search = '') => ({
        params: { page },
        url: new URL(`https://hospeda.test/es/comer-y-salir/page/${page}/${search}`),
        redirect: vi.fn(
            (path: string, status?: number) =>
                new Response(null, { status, headers: { location: path } })
        ),
        rewrite: vi.fn(async (path: string) => new Response(path, { status: 200 }))
    });

    it('returns a 404 response without touching redirect or rewrite', async () => {
        const astro = makeAstro('0');
        const res = await handlePaginationRoute({ astro, basePath: BASE });
        expect(res.status).toBe(404);
        expect(astro.redirect).not.toHaveBeenCalled();
        expect(astro.rewrite).not.toHaveBeenCalled();
    });

    it('redirects page 1 with the shared status', async () => {
        const astro = makeAstro('1');
        const res = await handlePaginationRoute({ astro, basePath: BASE });
        expect(astro.redirect).toHaveBeenCalledWith(BASE, PAGE_ONE_REDIRECT_STATUS);
        expect(res.status).toBe(PAGE_ONE_REDIRECT_STATUS);
    });

    it('rewrites page N', async () => {
        const astro = makeAstro('4', '?type=BAR');
        await handlePaginationRoute({ astro, basePath: BASE });
        expect(astro.rewrite).toHaveBeenCalledWith(`${BASE}?type=BAR&page=4`);
    });
});

describe('buildPaginatedPath', () => {
    it('is the listing root for page 1 and /page/N/ after', () => {
        expect(buildPaginatedPath({ basePath: BASE, page: 1 })).toBe(BASE);
        expect(buildPaginatedPath({ basePath: BASE, page: 2 })).toBe(`${BASE}page/2/`);
    });
});

describe('buildPaginationLinks', () => {
    it('has next only on the first page', () => {
        expect(buildPaginationLinks({ basePath: BASE, page: 1, totalPages: 3 })).toEqual({
            canonicalPath: BASE,
            prevPath: undefined,
            nextPath: `${BASE}page/2/`
        });
    });

    it('points prev of page 2 at the listing root, not /page/1/', () => {
        const links = buildPaginationLinks({ basePath: BASE, page: 2, totalPages: 3 });
        expect(links.prevPath).toBe(BASE);
        expect(links.nextPath).toBe(`${BASE}page/3/`);
        expect(links.canonicalPath).toBe(`${BASE}page/2/`);
    });

    it('has no next on the last page', () => {
        const links = buildPaginationLinks({ basePath: BASE, page: 3, totalPages: 3 });
        expect(links.nextPath).toBeUndefined();
        expect(links.prevPath).toBe(`${BASE}page/2/`);
    });

    it('has no neighbours for an empty result', () => {
        const links = buildPaginationLinks({ basePath: BASE, page: 1, totalPages: 0 });
        expect(links.prevPath).toBeUndefined();
        expect(links.nextPath).toBeUndefined();
    });
});

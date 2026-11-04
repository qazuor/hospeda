/**
 * @file middleware-nested-rewrite-404.test.ts
 * @description Regression coverage for nested Astro rewrites returning 404/410.
 *
 * Astro shares `locals` across rewrite rendering phases and runs middleware
 * again for each phase. A paginated shim can therefore return a listing 404
 * into an outer middleware pass; rewriting that nested 404 again creates a
 * rewrite loop and Astro responds with 508 instead of rendering the custom 404.
 */

import { describe, expect, it, vi } from 'vitest';

const { parseSessionUserMock } = vi.hoisted(() => ({
    parseSessionUserMock: vi.fn().mockResolvedValue(null)
}));

vi.mock('../src/lib/middleware-helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/lib/middleware-helpers')>();
    return { ...actual, parseSessionUser: parseSessionUserMock };
});

import { handlePaginationRoute } from '../src/lib/listing/listing-pagination';
import { onRequest } from '../src/middleware';

interface DispatchCounter {
    rewrites: string[];
}

/** Execute an Astro-like request pass, preserving locals across rewrites. */
async function dispatch({
    pathname,
    search = '',
    locals = {},
    counter,
    shim = 'hand-rolled'
}: {
    readonly pathname: string;
    readonly search?: string;
    readonly locals?: Record<string, unknown>;
    readonly counter: DispatchCounter;
    readonly shim?: 'hand-rolled' | 'pagination-helper';
}): Promise<Response> {
    const url = new URL(`https://hospeda.test${pathname}${search}`);
    const context = {
        url,
        locals,
        request: { headers: new Headers() },
        isPrerendered: false,
        redirect: (target: string, status = 302) =>
            new Response(null, { status, headers: { location: target } }),
        cookies: { get: vi.fn() },
        rewrite: async (target: string | URL) => {
            const targetString = String(target);
            counter.rewrites.push(targetString);
            if (counter.rewrites.length > 2) return new Response('Loop Detected', { status: 508 });
            const rewrittenUrl = new URL(targetString, 'https://hospeda.test');
            return dispatch({
                pathname: rewrittenUrl.pathname,
                search: rewrittenUrl.search,
                locals,
                counter,
                shim
            });
        }
    };

    const route = async (): Promise<Response> => {
        if (url.pathname === '/404') {
            return new Response('custom 404 page', {
                status: 404,
                headers: { 'content-type': 'text/html' }
            });
        }

        if (url.pathname === '/es/listado/') {
            const page = url.searchParams.get('page');
            if (page === 'gone') return new Response(null, { status: 410 });
            if (page !== null && Number(page) > 3) return new Response(null, { status: 404 });
            return new Response('list', { status: 200 });
        }

        if (url.pathname === '/es/listado/page/gone/') {
            return context.rewrite('/es/listado/?page=gone');
        }

        const pageMatch = /^\/es\/listado\/page\/(\d+)\/$/.exec(url.pathname);
        if (pageMatch) {
            if (shim === 'pagination-helper') {
                return handlePaginationRoute({
                    astro: {
                        params: { page: pageMatch[1] },
                        url,
                        redirect: context.redirect,
                        rewrite: context.rewrite
                    },
                    basePath: '/es/listado/'
                });
            }
            return context.rewrite(`/es/listado/?page=${pageMatch[1]}`);
        }

        return new Response('not found', { status: 404 });
    };

    return (await onRequest(context as Parameters<typeof onRequest>[0], route)) as Response;
}

describe('middleware nested rewrite error rendering (HOS-2015)', () => {
    it('renders the custom 404 once after a hand-rolled pagination shim rewrite', async () => {
        const counter = { rewrites: [] };
        const response = await dispatch({
            pathname: '/es/listado/page/99/',
            counter
        });

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('custom 404 page');
        expect(counter.rewrites.filter((target) => target === '/404')).toHaveLength(1);
        expect(response.status).not.toBe(508);
    });

    it('renders the custom 404 once through handlePaginationRoute', async () => {
        const counter = { rewrites: [] };
        const response = await dispatch({
            pathname: '/es/listado/page/99/',
            counter,
            shim: 'pagination-helper'
        });

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('custom 404 page');
        expect(counter.rewrites.filter((target) => target === '/404')).toHaveLength(1);
    });

    it('keeps an in-range pagination rewrite as a 200 without a 404 rewrite', async () => {
        const counter = { rewrites: [] };
        const response = await dispatch({ pathname: '/es/listado/page/2/', counter });

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('list');
        expect(counter.rewrites.filter((target) => target === '/404')).toHaveLength(0);
    });

    it('keeps direct query pagination behavior unchanged', async () => {
        const counter = { rewrites: [] };
        const response = await dispatch({
            pathname: '/es/listado/',
            search: '?page=99',
            counter
        });

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('custom 404 page');
        expect(counter.rewrites.filter((target) => target === '/404')).toHaveLength(1);
    });

    it('renders a nested 410 error page once and preserves its status', async () => {
        const counter = { rewrites: [] };
        const response = await dispatch({
            pathname: '/es/listado/page/gone/',
            counter
        });

        expect(response.status).toBe(410);
        expect(await response.text()).toBe('custom 404 page');
        expect(counter.rewrites.filter((target) => target === '/404')).toHaveLength(1);
    });
});

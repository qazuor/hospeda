/**
 * @file editor-not-found-resolution.test.ts
 * @description Regression tests (HOS-2556): a missing or foreign id on an account
 * editor must render the in-layout 404 (an `Astro.rewrite`), never redirect to
 * the listing. Missing and foreign ids must be indistinguishable.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadAccommodationEditorDataMock, fetchOwnerListingDetailMock } = vi.hoisted(() => ({
    loadAccommodationEditorDataMock: vi.fn(),
    fetchOwnerListingDetailMock: vi.fn()
}));

vi.mock('@/lib/api/accommodation-editor-data', () => ({
    loadAccommodationEditorData: loadAccommodationEditorDataMock
}));

vi.mock('@/lib/listing/owner-listings', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    fetchOwnerListingDetail: fetchOwnerListingDetailMock
}));

import { resolveAuthoredEditorItem } from '@/lib/editor/resolve-authored-editor-item';
import { resolveEditorPage } from '@/lib/editor/resolve-editor-page';
import { resolveListingEditorPage } from '@/lib/editor/resolve-listing-editor-page';

const NOT_FOUND_PROPERTIES = '/es/mi-cuenta/no-encontrado/?back=properties';
const NOT_FOUND_LISTINGS = '/es/mi-cuenta/no-encontrado/?back=listings';

function makeAstro({
    vertical,
    roles = ['HOST', 'VENUE_OWNER']
}: {
    vertical?: string;
    roles?: string[];
}) {
    return {
        locals: { locale: 'es', user: { id: 'u1', roles, permissions: [] } },
        params: { id: 'abc', ...(vertical ? { vertical } : {}) },
        url: new URL('https://hospeda.test/es/mi-cuenta/x/abc/editar/'),
        request: { headers: new Headers() },
        redirect: vi.fn(
            (url: string) => new Response(null, { status: 302, headers: { location: url } })
        ),
        rewrite: vi.fn(
            async (url: string) =>
                new Response(null, { status: 404, headers: { 'x-rewrite': url } })
        )
    };
}

describe('resolveEditorPage (property) answers the in-layout 404 (HOS-2556)', () => {
    beforeEach(() => loadAccommodationEditorDataMock.mockReset());

    it.each(['redirect', 'error', 'not-found'])('rewrites for a %s load result', async (status) => {
        loadAccommodationEditorDataMock.mockResolvedValue({ status });
        const astro = makeAstro({});

        const result = await resolveEditorPage({ astro: astro as never, sectionSlug: null });

        expect(astro.rewrite).toHaveBeenCalledWith(NOT_FOUND_PROPERTIES);
        expect(astro.redirect).not.toHaveBeenCalled();
        expect(result.redirect?.status).toBe(404);
    });
});

describe('resolveListingEditorPage (comercio / experiencia) answers the in-layout 404 (HOS-2556)', () => {
    beforeEach(() => fetchOwnerListingDetailMock.mockReset());

    it.each([
        ['a missing id', null],
        ['somebody else’s id', { ownerId: 'someone-else' }]
    ])('rewrites for %s, with the same target', async (_label, detail) => {
        fetchOwnerListingDetailMock.mockResolvedValue(detail);
        const astro = makeAstro({ vertical: 'venue' });

        const result = await resolveListingEditorPage({ astro: astro as never, sectionSlug: null });

        expect(astro.rewrite).toHaveBeenCalledWith(NOT_FOUND_LISTINGS);
        expect(astro.redirect).not.toHaveBeenCalled();
        expect(result.redirect?.status).toBe(404);
    });
});

describe('event and post editors answer the in-layout 404 (HOS-2556)', () => {
    const NOT_FOUND = {
        events: '/es/mi-cuenta/no-encontrado/?back=events',
        posts: '/es/mi-cuenta/no-encontrado/?back=posts'
    } as const;

    function makeEditorAstro(id: string | undefined) {
        const astro = makeAstro({});
        return { ...astro, params: { id } };
    }

    const notFoundError = { ok: false, error: { status: 404, message: 'Not found' } } as const;
    const foreignError = { ok: false, error: { status: 403, message: 'Forbidden' } } as const;

    describe.each(['events', 'posts'] as const)('%s editor', (back) => {
        it('rewrites a missing id, an unknown id and a foreign id to the same target', async () => {
            // Arrange
            const fetchById = vi
                .fn()
                .mockResolvedValueOnce(notFoundError)
                .mockResolvedValueOnce(foreignError);
            const cases = [undefined, 'unknown-id', 'foreign-id'].map(makeEditorAstro);

            // Act
            const results = [];
            for (const astro of cases) {
                results.push(
                    await resolveAuthoredEditorItem({
                        astro: astro as never,
                        back,
                        fetchById,
                        logTag: '[test]'
                    })
                );
            }

            // Assert
            for (const [index, astro] of cases.entries()) {
                expect(astro.rewrite).toHaveBeenCalledWith(NOT_FOUND[back]);
                expect(astro.redirect).not.toHaveBeenCalled();
                expect(results[index]?.notFound?.status).toBe(404);
                expect(results[index]?.notFound?.headers.get('x-rewrite')).toBe(NOT_FOUND[back]);
                expect(results[index]?.item).toBeUndefined();
            }
            // The missing id never reaches the API; the other two do, with their own id.
            expect(fetchById.mock.calls.map(([input]) => input.id)).toEqual([
                'unknown-id',
                'foreign-id'
            ]);
        });

        it('returns the item and no rewrite when the author owns it', async () => {
            // Arrange
            const fetchById = vi.fn().mockResolvedValue({ ok: true, data: { id: 'mine' } });
            const astro = makeEditorAstro('mine');

            // Act
            const result = await resolveAuthoredEditorItem({
                astro: astro as never,
                back,
                fetchById,
                logTag: '[test]'
            });

            // Assert
            expect(result.item).toEqual({ id: 'mine' });
            expect(result.notFound).toBeUndefined();
            expect(astro.rewrite).not.toHaveBeenCalled();
        });
    });

    it.each([
        ['eventos/[id]/editar.astro', "back: 'events'", 'eventEditApi.getById'],
        ['publicaciones/[id]/editar.astro', "back: 'posts'", 'postEditApi.getById']
    ])('%s delegates to the resolver with its own section and read', (page, backArg, read) => {
        const source = readFileSync(
            resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta', page),
            'utf8'
        );
        expect(source).toContain('await resolveAuthoredEditorItem({');
        expect(source).toContain(backArg);
        expect(source).toContain(`fetchById: ${read}`);
        expect(source).toMatch(/return loaded\.notFound;/);
        expect(source).not.toMatch(/Astro\.redirect\(listUrl\)/);
    });
});

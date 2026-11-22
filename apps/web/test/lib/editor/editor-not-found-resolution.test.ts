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

describe('event and post editors rewrite to the in-layout 404 (HOS-2556)', () => {
    const read = (rel: string): string => readFileSync(resolve(__dirname, '../../..', rel), 'utf8');
    const PAGES = 'src/pages/[lang]/mi-cuenta';

    it.each([
        [`${PAGES}/eventos/[id]/editar.astro`, "back: 'events'"],
        [`${PAGES}/publicaciones/[id]/editar.astro`, "back: 'posts'"]
    ])('%s rewrites on a missing id and on a failed fetch', (rel, backArg) => {
        const source = read(rel);
        expect(
            source.split(`Astro.rewrite(buildAccountNotFoundTarget({ locale, ${backArg} }))`)
        ).toHaveLength(3);
        expect(source).not.toMatch(/Astro\.redirect\(listUrl\)/);
    });
});

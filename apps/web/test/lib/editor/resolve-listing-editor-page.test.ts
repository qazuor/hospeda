/**
 * @file resolve-listing-editor-page.test.ts
 * @description The fail-closed wiring of the venue/experience editor resolver
 * (HOS-1787 leaf 5.1, decision 2).
 *
 * `listing-editor-error-page.test.ts` proves the `503` screen; it cannot prove
 * the resolver returns it. This test drives `resolveListingEditorPage` with a
 * failing section-state read and asserts the failure short-circuits BEFORE any
 * registry is built — the decision the API's 3.12 contract (never a degraded
 * map) depends on.
 *
 * The loaders are mocked, the same way `resolve-editor-page.test.ts` tests the
 * accommodation resolver, so the case proves the branch rather than the network.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getListingSectionStates = vi.fn();
const fetchOwnerListingDetail = vi.fn();
const buildListingEditorRegistry = vi.fn();
const buildEditorHubUrl = vi.fn();
const findEditorSectionBySlug = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    destinationsApi: { list: vi.fn() }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    listingAnalyticsApi: {
        getListingSectionStates: (args: unknown) => getListingSectionStates(args)
    }
}));

vi.mock('@/lib/listing/owner-listings', () => ({
    fetchOwnerListingDetail: (args: unknown) => fetchOwnerListingDetail(args)
}));

vi.mock('@/lib/editor/listing-editor-registry', () => ({
    buildListingEditorRegistry: (args: unknown) => buildListingEditorRegistry(args)
}));

vi.mock('@/lib/editor/editor-registry', () => ({
    buildEditorHubUrl: (args: unknown) => buildEditorHubUrl(args),
    findEditorSectionBySlug: (args: unknown) => findEditorSectionBySlug(args)
}));

vi.mock('@/lib/nav-gating', () => ({
    hasListingNavAccess: () => true
}));

vi.mock('@/lib/urls', () => ({
    buildUrl: ({ locale, path }: { locale: string; path: string }) => `/${locale}/${path}`
}));

const { resolveListingEditorPage } = await import('@/lib/editor/resolve-listing-editor-page');

const COOKIE = 'better-auth.session_token=abc123';

/** Hub at `…/editar/`; section routes append the slug. */
function editorUrl(sectionSlug: string | null): URL {
    const base = 'https://example.com/es/mi-cuenta/comercio/venue/listing-1/editar/';
    return new URL(sectionSlug === null ? base : `${base}${sectionSlug}/`);
}

function createAstro({ sectionSlug = null }: { readonly sectionSlug?: string | null } = {}) {
    return {
        locals: {
            locale: 'es',
            user: { id: 'user-1', roles: ['VENUE_OWNER'] }
        },
        url: editorUrl(sectionSlug),
        params: { vertical: 'venue', id: 'listing-1' },
        request: {
            headers: new Headers({ cookie: COOKIE })
        },
        redirect: (location: string) =>
            new Response(null, { status: 302, headers: { Location: location } })
    };
}

describe('resolveListingEditorPage — a failed section-state read fails closed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchOwnerListingDetail.mockResolvedValue({ id: 'listing-1', ownerId: 'user-1' });
        getListingSectionStates.mockResolvedValue({
            ok: false,
            error: { status: 503, message: 'Section states unavailable' }
        });
        buildListingEditorRegistry.mockReturnValue({ sections: [], buildHubPath: '/hub' });
        buildEditorHubUrl.mockReturnValue('/es/mi-cuenta/comercio/venue/listing-1/editar/');
        findEditorSectionBySlug.mockReturnValue({ id: 'datos' });
    });

    it('returns the 503 error on the hub and builds no registry', async () => {
        const result = await resolveListingEditorPage({
            astro: createAstro({ sectionSlug: null }) as never,
            sectionSlug: null
        });

        expect(result.error?.status).toBe(503);
        expect(result.registry).toBeUndefined();
        expect(buildListingEditorRegistry).not.toHaveBeenCalled();
    });

    it('returns the 503 error on a section route and builds no registry', async () => {
        const result = await resolveListingEditorPage({
            astro: createAstro({ sectionSlug: 'de-noche' }) as never,
            sectionSlug: 'de-noche'
        });

        expect(result.error?.status).toBe(503);
        expect(result.registry).toBeUndefined();
        expect(buildListingEditorRegistry).not.toHaveBeenCalled();
    });
});

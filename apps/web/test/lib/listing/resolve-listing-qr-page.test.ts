/**
 * @file resolve-listing-qr-page.test.ts
 * @description HOS-2688: the QR pages' front-door. Signed-out → login with the
 * page as the return path; a missing listing and somebody else's answer the
 * SAME in-layout 404; the owner (or staff with the edit-all permission) gets
 * the listing, published or not.
 *
 * The loaders are mocked, as in `resolve-listing-editor-page.test.ts`, so the
 * cases prove the branches rather than the network.
 */
import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import type { AstroGlobal } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAccommodationEditorData = vi.fn();
const fetchOwnerListingDetail = vi.fn();

vi.mock('@/lib/api/accommodation-editor-data', () => ({
    loadAccommodationEditorData: (args: unknown) => loadAccommodationEditorData(args)
}));
vi.mock('@/lib/listing/owner-listings', () => ({
    fetchOwnerListingDetail: (args: unknown) => fetchOwnerListingDetail(args)
}));

const { resolveAccommodationQrPage, resolveComercioQrPage } = await import(
    '@/lib/listing/resolve-listing-qr-page'
);

const COOKIE = 'better-auth.session_token=abc123';
const NOT_FOUND_RESPONSE = new Response('not found', { status: 404 });

function createAstro({
    path,
    params,
    user = { id: 'user-1', permissions: ['venue.editOwn'] }
}: {
    readonly path: string;
    readonly params: Record<string, string | undefined>;
    readonly user?: { readonly id: string; readonly permissions: readonly string[] } | null;
}) {
    const rewrite = vi.fn(async () => NOT_FOUND_RESPONSE);
    const redirect = vi.fn(
        (location: string) => new Response(null, { status: 302, headers: { Location: location } })
    );
    const astro = {
        locals: { locale: 'es', user },
        url: new URL(`https://example.com${path}`),
        params,
        request: { headers: new Headers({ cookie: COOKIE }) },
        redirect,
        rewrite
    } as unknown as AstroGlobal;
    return { astro, rewrite, redirect };
}

beforeEach(() => vi.clearAllMocks());

describe('resolveAccommodationQrPage', () => {
    const path = '/es/mi-cuenta/propiedades/acc-1/codigo-qr/';

    it('sends a signed-out visitor to login with this page as the return path', async () => {
        const { astro, redirect } = createAstro({ path, params: { id: 'acc-1' }, user: null });

        const result = await resolveAccommodationQrPage({ astro });

        expect(result.response?.status).toBe(302);
        expect(redirect.mock.calls[0]?.[0]).toContain(encodeURIComponent(path));
        expect(loadAccommodationEditorData).not.toHaveBeenCalled();
    });

    it.each([
        'redirect',
        'error'
    ])('answers the in-layout 404 when the loader says %s', async (status) => {
        loadAccommodationEditorData.mockResolvedValue({ status });
        const { astro, rewrite } = createAstro({ path, params: { id: 'acc-1' } });

        const result = await resolveAccommodationQrPage({ astro });

        expect(result.response).toBe(NOT_FOUND_RESPONSE);
        expect(rewrite).toHaveBeenCalledWith('/es/mi-cuenta/no-encontrado/?back=properties');
    });

    it("returns the owner's listing with the cookie forwarded", async () => {
        loadAccommodationEditorData.mockResolvedValue({
            status: 'ok',
            data: {
                accommodation: {
                    id: 'acc-1',
                    name: 'Casa del Río',
                    slug: 'casa-del-rio',
                    publicationStatus: PublicationStatusEnum.DRAFT
                }
            }
        });
        const { astro } = createAstro({ path, params: { id: 'acc-1' } });

        const result = await resolveAccommodationQrPage({ astro });

        expect(loadAccommodationEditorData).toHaveBeenCalledWith({
            accommodationId: 'acc-1',
            cookieHeader: COOKIE
        });
        expect(result.listing).toEqual({
            vertical: 'accommodation',
            id: 'acc-1',
            name: 'Casa del Río',
            slug: 'casa-del-rio',
            isPublished: false
        });
    });
});

describe('resolveComercioQrPage', () => {
    const path = '/es/mi-cuenta/comercio/venue/v-1/codigo-qr/';
    const detail = {
        id: 'v-1',
        ownerId: 'user-1',
        name: 'La Parrilla',
        slug: 'la-parrilla',
        publicationStatus: PublicationStatusEnum.PUBLISHED
    };

    it('answers 404 for a vertical that is not venue/experience, before any read', async () => {
        const { astro, rewrite } = createAstro({
            path,
            params: { vertical: 'accommodation', id: 'v-1' }
        });

        const result = await resolveComercioQrPage({ astro });

        expect(result.response).toBe(NOT_FOUND_RESPONSE);
        expect(rewrite).toHaveBeenCalledWith('/es/mi-cuenta/no-encontrado/?back=listings');
        expect(fetchOwnerListingDetail).not.toHaveBeenCalled();
    });

    it("answers the same 404 for a missing listing and for somebody else's", async () => {
        fetchOwnerListingDetail.mockResolvedValueOnce(null);
        const missing = createAstro({ path, params: { vertical: 'venue', id: 'v-1' } });
        const missingResult = await resolveComercioQrPage({ astro: missing.astro });

        fetchOwnerListingDetail.mockResolvedValueOnce({ ...detail, ownerId: 'someone-else' });
        const foreign = createAstro({ path, params: { vertical: 'venue', id: 'v-1' } });
        const foreignResult = await resolveComercioQrPage({ astro: foreign.astro });

        expect(missingResult.response).toBe(NOT_FOUND_RESPONSE);
        expect(foreignResult.response).toBe(NOT_FOUND_RESPONSE);
        expect(foreign.rewrite.mock.calls).toEqual(missing.rewrite.mock.calls);
        expect(foreignResult.listing).toBeUndefined();
    });

    it.each([
        ['venue', PermissionEnum.VENUE_EDIT_ALL],
        ['experience', PermissionEnum.EXPERIENCE_EDIT_ALL]
    ] as const)('lets staff holding the %s edit-all permission in', async (vertical, permission) => {
        fetchOwnerListingDetail.mockResolvedValue({ ...detail, ownerId: 'someone-else' });
        const { astro } = createAstro({
            path,
            params: { vertical, id: 'v-1' },
            user: { id: 'staff-1', permissions: [permission] }
        });

        const result = await resolveComercioQrPage({ astro });

        expect(result.listing?.vertical).toBe(vertical);
    });

    it("returns the owner's published listing", async () => {
        fetchOwnerListingDetail.mockResolvedValue(detail);
        const { astro } = createAstro({ path, params: { vertical: 'venue', id: 'v-1' } });

        const result = await resolveComercioQrPage({ astro });

        expect(fetchOwnerListingDetail).toHaveBeenCalledWith({
            vertical: 'venue',
            id: 'v-1',
            cookieHeader: COOKIE
        });
        expect(result.listing).toEqual({
            vertical: 'venue',
            id: 'v-1',
            name: 'La Parrilla',
            slug: 'la-parrilla',
            isPublished: true
        });
    });
});

/**
 * @file CommerceListingEditor.test.tsx
 * @description Tests for the commerce owner operational editor island
 * (SPEC-249 T-012). Verifies the save button stays disabled until a field
 * changes, and that submitting PATCHes the correct per-vertical endpoint with
 * only the dirty field group.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingEditor } from '../../../src/components/commerce/CommerceListingEditor.client';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

vi.mock('../../../src/components/commerce/CommerceListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// Stub out the TranslationPanel so its "Descripción ampliada" label does not
// collide with the same label on the standalone richDescription textarea inside
// the editor itself.  Integration between the two components is tested separately
// in CommerceTranslationPanel.test.tsx.
vi.mock('../../../src/components/commerce/CommerceTranslationPanel.client', () => ({
    CommerceTranslationPanel: () => null,
    parseCommerceI18nValues: () => ({
        nameI18n: { es: '', en: '', pt: '' },
        summaryI18n: { es: '', en: '', pt: '' },
        descriptionI18n: { es: '', en: '', pt: '' },
        richDescriptionI18n: { es: '', en: '', pt: '' }
    })
}));

vi.mock('../../../src/lib/i18n', () => ({
    // Mirror the real translator: a key with no translation resolves to
    // `[MISSING:<key>]` (not the bare key). `catalog-names` relies on that
    // sentinel to fall back to a humanized label, so the mock must reproduce it.
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { patch: vi.fn() }
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));

vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { apiClient } from '../../../src/lib/api/client';
import { protectedMediaApi } from '../../../src/lib/api/endpoints-protected';

const mockPatch = vi.mocked(apiClient.patch);
const mockDeleteMedia = vi.mocked(protectedMediaApi.deleteMedia);

/** A Cloudinary-shaped image (ImageSchema-compatible) for media tests. */
const galleryImage = {
    url: 'http://cdn.test/g1.jpg',
    publicId: 'commerce/g1',
    width: 800,
    height: 600,
    moderationState: 'APPROVED' as const
};

const baseData = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    richDescription: 'old text'
} as unknown as CommerceListingDetail;

function renderEditor(vertical: 'gastronomy' | 'experience') {
    return render(
        <CommerceListingEditor
            vertical={vertical}
            listingId="abc"
            locale="es"
            initialData={baseData}
        />
    );
}

describe('CommerceListingEditor', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        mockDeleteMedia.mockClear();
    });

    it('keeps the save button disabled until a field changes', () => {
        renderEditor('gastronomy');
        const save = screen.getByRole('button', { name: 'Guardar cambios' });
        expect(save).toBeDisabled();
    });

    it('PATCHes the gastronomy endpoint with only the dirty field on submit', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('gastronomy');

        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'new text' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
            body: { richDescription: 'new text' }
        });
        await screen.findByRole('status');
    });

    it('PATCHes the experience endpoint for the experience vertical', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('experience');

        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'changed' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/experiences/abc',
            body: { richDescription: 'changed' }
        });
    });

    it('shows an error message when the PATCH fails', async () => {
        mockPatch.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });
        renderEditor('gastronomy');

        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'x' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await screen.findByRole('alert');
    });

    it('PATCHes only the priceRange field group when the price tier changes (gastronomy)', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('gastronomy');

        fireEvent.change(screen.getByLabelText('Rango de precios'), { target: { value: 'MID' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
            body: { priceRange: 'MID' }
        });
    });

    it('PATCHes the contactInfo group when a contact field changes', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('gastronomy');

        fireEvent.change(screen.getByLabelText('Teléfono'), {
            target: { value: '+5491100000000' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
            body: {
                contactInfo: {
                    mobilePhone: '+5491100000000',
                    workEmail: undefined,
                    website: undefined
                }
            }
        });
    });

    it('shows the price-on-request toggle for the experience vertical (no price select)', () => {
        renderEditor('experience');
        expect(screen.queryByLabelText('Rango de precios')).toBeNull();
        expect(screen.getByLabelText('Precio a consultar')).toBeInTheDocument();
    });

    it('PATCHes the socialNetworks group when a social URL changes', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('gastronomy');

        fireEvent.change(screen.getByLabelText('facebook'), {
            target: { value: 'https://facebook.com/x' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
            body: {
                socialNetworks: {
                    facebook: 'https://facebook.com/x',
                    instagram: undefined,
                    twitter: undefined,
                    tiktok: undefined,
                    youtube: undefined
                }
            }
        });
    });

    it('PATCHes openingHours when a day is toggled closed', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('gastronomy');

        fireEvent.click(screen.getByLabelText('Lun cerrado'));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const call = mockPatch.mock.calls[0]?.[0] as {
            body: { openingHours?: { days?: Record<string, { closed: boolean }> } };
        };
        expect(call.body.openingHours?.days?.mon?.closed).toBe(true);
    });

    it('uploads a featured image and PATCHes the media group on save', async () => {
        const uploaded = {
            url: 'http://cdn.test/featured.jpg',
            publicId: 'commerce/featured',
            width: 1024,
            height: 768,
            moderationState: 'APPROVED'
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: uploaded })
        });
        vi.stubGlobal('fetch', fetchMock);
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });

        renderEditor('gastronomy');

        const file = new File(['x'], 'featured.png', { type: 'image/png' });
        fireEvent.change(screen.getByLabelText('Imagen principal'), {
            target: { files: [file] }
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'http://api.test/api/v1/protected/media/upload-entity'
        );

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
            body: { media: { featuredImage: uploaded, gallery: [] } }
        });

        vi.unstubAllGlobals();
    });

    it('seeds amenity selection and PATCHes amenityIds/featureIds when toggled', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });

        render(
            <CommerceListingEditor
                vertical="gastronomy"
                listingId="abc"
                locale="es"
                initialData={
                    {
                        id: 'abc',
                        ownerId: 'owner-1',
                        name: 'La Parrilla',
                        slug: 'la-parrilla',
                        amenityIds: ['a1']
                    } as unknown as CommerceListingDetail
                }
                // SPEC-266: catalog items carry `slug` (no `name`). The amenity
                // label resolves via translateAmenityName, which humanizes the
                // slug when no i18n key exists (`wifi` → `Wifi`, `terraza` →
                // `Terraza`). Features render `t(featureNames.<slug>, slug)`,
                // which falls back to the raw slug.
                amenities={[
                    { id: 'a1', slug: 'wifi', category: null },
                    { id: 'a2', slug: 'terraza', category: null }
                ]}
                features={[{ id: 'f1', slug: 'pet_friendly', category: null }]}
            />
        );

        // a1 starts checked (seeded from initialData.amenityIds).
        expect(screen.getByLabelText('Wifi')).toBeChecked();
        expect(screen.getByLabelText('Terraza')).not.toBeChecked();

        // Select a second amenity and a feature.
        fireEvent.click(screen.getByLabelText('Terraza'));
        fireEvent.click(screen.getByLabelText('pet_friendly'));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const body = mockPatch.mock.calls[0]?.[0]?.body as {
            amenityIds?: string[];
            featureIds?: string[];
        };
        expect(body.amenityIds).toEqual(['a1', 'a2']);
        expect(body.featureIds).toEqual(['f1']);
    });

    it('removes a gallery image (best-effort delete) and PATCHes the trimmed gallery', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });

        render(
            <CommerceListingEditor
                vertical="gastronomy"
                listingId="abc"
                locale="es"
                initialData={
                    {
                        id: 'abc',
                        ownerId: 'owner-1',
                        name: 'La Parrilla',
                        slug: 'la-parrilla',
                        media: { gallery: [galleryImage] }
                    } as unknown as CommerceListingDetail
                }
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

        await waitFor(() =>
            expect(mockDeleteMedia).toHaveBeenCalledWith({ publicId: 'commerce/g1' })
        );

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            path: '/api/v1/protected/gastronomies/abc',
            body: { media: { gallery: [] } }
        });
    });
});

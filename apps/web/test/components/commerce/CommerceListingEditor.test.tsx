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

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { patch: vi.fn() }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockPatch = vi.mocked(apiClient.patch);

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
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
});

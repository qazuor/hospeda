/**
 * @file ListingEditor.business-lines.test.tsx
 * @description Save gate for an invalid business-line selection after a type
 * change (HOS-1787 leaf 5.7, AC:5:4).
 *
 * The selector is not allowed to drop a line to make the selection valid:
 * removing a line hides the content it owns. The save must stop at the client,
 * with the catalog reason visible, and never reach the PATCH.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingEditor } from '@/components/listing/ListingEditor.client';
import type { ListingDetail } from '@/lib/listing/owner-listings';

const { mockPatch } = vi.hoisted(() => ({ mockPatch: vi.fn() }));

vi.mock('@/lib/api/client', () => ({
    apiClient: { patch: mockPatch, delete: vi.fn() }
}));

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('@/components/listing/ListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const INITIAL = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    publicationStatus: 'DRAFT',
    destinationId: '11111111-1111-4111-8111-111111111111',
    type: 'BAR',
    businessLines: ['food', 'nightlife'],
    description: 'Descripción original con suficiente longitud para pasar validación.'
} as unknown as ListingDetail;

beforeEach(() => {
    mockPatch.mockReset();
    mockPatch.mockResolvedValue({ ok: true, data: {} });
});

describe('ListingEditor — TEST:5.7:2 invalid business lines block the save', () => {
    it('shows the reason and sends no PATCH when the new type does not admit the selection', async () => {
        render(
            <ListingEditor
                vertical="venue"
                sectionId="basicInfo"
                listingId="abc"
                locale="es"
                initialData={INITIAL}
            />
        );

        fireEvent.change(screen.getByLabelText('Categoría'), {
            target: { value: 'HELADERIA' }
        });

        expect(
            screen.getAllByText('Este tipo de comercio no admite ese rubro').length
        ).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockPatch).not.toHaveBeenCalled());
    });
});

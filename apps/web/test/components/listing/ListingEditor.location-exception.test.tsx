/**
 * @file ListingEditor.location-exception.test.tsx
 * @description A location PATCH refused with 409 `DUPLICATE_LOCATION` offers
 * "Pedir una excepción" for the address the owner tried to save (HOS-2192, D-23).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import { ListingEditor } from '@/components/listing/ListingEditor.client';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { ListingDetail } from '@/lib/listing/owner-listings';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
    apiClient: { patch: vi.fn(), postProtected: vi.fn() }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    listingMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    protectedMediaApi: { deleteMedia: vi.fn() }
}));
vi.mock('@/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('@/components/listing/editor/BusinessLinesField.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { apiClient } from '@/lib/api/client';

const mockPatch = vi.mocked(apiClient.patch);

const INITIAL_DATA = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    destinationId: '11111111-1111-4111-8111-111111111111',
    type: 'PARRILLA',
    businessLines: ['food'],
    location: { street: 'Mitre', number: '100' }
} as unknown as ListingDetail;

beforeEach(() => {
    mockPatch.mockReset();
    vi.mocked(apiClient.postProtected).mockReset();
});

async function saveRefused() {
    mockPatch.mockResolvedValue({
        ok: false,
        error: { status: 409, code: 'ALREADY_EXISTS', reason: 'DUPLICATE_LOCATION', message: 'x' }
    });
    render(
        <ListingEditor
            vertical="venue"
            sectionId="location"
            listingId="abc"
            locale="es"
            initialData={INITIAL_DATA}
            destinations={[]}
        />
    );
    fireEvent.change(
        document.getElementById(
            buildFieldId({ prefix: LISTING_FIELD_PREFIX, name: 'location.street' })
        ) as HTMLElement,
        {
            target: { value: 'Av. San Martin' }
        }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('ListingEditor: location exception on a refused save (HOS-2192)', () => {
    it('offers the request button after the 409 and sends the submitted address, no key', async () => {
        await saveRefused();
        fireEvent.click(await screen.findByRole('button', { name: 'Pedir una excepción' }));
        vi.mocked(apiClient.postProtected).mockResolvedValue({
            ok: true,
            data: { id: 'r1', status: 'PENDING', requestedAt: 'x' }
        } as never);
        fireEvent.change(screen.getByTestId('location-exception-reason'), {
            target: { value: 'a'.repeat(12) }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
        await waitFor(() => expect(apiClient.postProtected).toHaveBeenCalledTimes(1));
        const call = vi.mocked(apiClient.postProtected).mock.calls[0]?.[0] as {
            path: string;
            body: Record<string, unknown>;
        };
        expect(call.path).toBe('/api/v1/protected/venues/abc/location-exception-request');
        expect(call.body.location).toMatchObject({ street: 'Av. San Martin', number: '100' });
        expect(JSON.stringify(call.body)).not.toMatch(/key/i);
    });

    it('does not offer the button for another 409', async () => {
        mockPatch.mockResolvedValue({
            ok: false,
            error: { status: 409, code: 'ALREADY_EXISTS', reason: 'SECTION_ABSENT', message: 'x' }
        });
        render(
            <ListingEditor
                vertical="venue"
                sectionId="location"
                listingId="abc"
                locale="es"
                initialData={INITIAL_DATA}
                destinations={[]}
            />
        );
        fireEvent.change(
            document.getElementById(
                buildFieldId({ prefix: LISTING_FIELD_PREFIX, name: 'location.street' })
            ) as HTMLElement,
            {
                target: { value: 'Otra' }
            }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await screen.findAllByRole('alert');
        expect(screen.queryByRole('button', { name: 'Pedir una excepción' })).toBeNull();
    });
});

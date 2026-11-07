/**
 * @file ListingEditor.section-absent.test.tsx
 * @description A 409 `SECTION_ABSENT` gets its own message (TEST:5.6:4).
 *
 * The generic save-failed banner hides the cause: the section stopped applying
 * because the listing's business lines changed. The editor must name it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingEditor } from '@/components/listing/ListingEditor.client';
import type { ListingDetail } from '@/lib/listing/owner-listings';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/lib/api/client', () => ({
    apiClient: { patch: vi.fn() }
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

vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({
        value,
        onChange,
        ariaLabel
    }: {
        value: string;
        onChange: (value: string) => void;
        ariaLabel?: string;
    }) => (
        <textarea
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));

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
    summary: 'Resumen original',
    description: 'Descripción original con suficiente longitud para pasar validación.'
} as unknown as ListingDetail;

beforeEach(() => {
    mockPatch.mockReset();
});

describe('ListingEditor — TEST:5.6:4', () => {
    it('shows the SECTION_ABSENT message instead of the generic save error', async () => {
        mockPatch.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'ALREADY_EXISTS',
                reason: 'SECTION_ABSENT',
                message: 'Section is absent'
            }
        });

        render(
            <ListingEditor
                vertical="venue"
                sectionId="basicInfo"
                listingId="abc"
                locale="es"
                initialData={INITIAL_DATA}
                destinations={[]}
            />
        );

        fireEvent.change(document.getElementById('ce-name') as HTMLElement, {
            target: { value: 'Nombre nuevo' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            const messages = screen
                .getAllByRole('alert')
                .map((element) => element.textContent ?? '');
            expect(messages).toContain('Esa sección ya no aplica a los rubros de tu local.');
        });
        expect(screen.queryByText('No se pudieron guardar los cambios.')).toBeNull();
    });
});

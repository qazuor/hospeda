/**
 * @file NightInfoSection.test.tsx
 * @description TEST:5.1:5 — nightInfo editor controls (HOS-1787 leaf 5.1).
 *
 * The component is owned by the venue editor, but its price field changes
 * visibility with `entryKind`, its empty number means "not informed" (never
 * `0`), and a note is capped at 200 characters per locale — three behaviours a
 * payload test alone cannot see.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NightInfoSection } from '@/components/listing/editor/NightInfoSection.client';
import { ListingEditor } from '@/components/listing/ListingEditor.client';
import { apiClient } from '@/lib/api/client';
import type { ListingDetail } from '@/lib/listing/owner-listings';
import { buildEditData } from './edit-data-fixture';

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
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) }
}));

vi.mock('@/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('@/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

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

function renderSection(entryKind: string, overrides: Record<string, unknown> = {}) {
    const onFieldChange = vi.fn();

    render(
        <NightInfoSection
            locale="es"
            data={buildEditData({ entryKind, ...overrides })}
            errors={{}}
            onFieldChange={onFieldChange}
        />
    );

    return onFieldChange;
}

function buildListing(overrides: Record<string, unknown> = {}): ListingDetail {
    return {
        id: 'abc',
        ownerId: 'owner-1',
        name: 'La Noche',
        slug: 'la-noche',
        publicationStatus: 'DRAFT',
        description: 'Descripción original con suficiente longitud para pasar validación.',
        ...overrides
    } as unknown as ListingDetail;
}

describe('NightInfoSection', () => {
    it('hides the price unless the entry is paid', () => {
        renderSection('');

        expect(screen.getByTestId('night-info-price-field')).toHaveAttribute('hidden');

        renderSection('paid');

        const fields = screen.getAllByTestId('night-info-price-field');
        expect(fields[1]).not.toHaveAttribute('hidden');
    });

    it('clears minAge to null, never to zero', () => {
        const onFieldChange = renderSection('', { minAge: 18 });

        fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '' } });

        expect(onFieldChange).toHaveBeenCalledWith('minAge', null);
    });

    it('sends a note over 200 characters to validation instead of the API', () => {
        render(
            <ListingEditor
                vertical="venue"
                sectionId="nightInfo"
                listingId="abc"
                locale="es"
                initialData={buildListing({
                    entryKind: 'free',
                    entryNoteI18n: { es: '', en: '', pt: '' }
                })}
            />
        );

        fireEvent.change(document.getElementById('ce-entryNoteI18n') as HTMLElement, {
            target: { value: 'a'.repeat(201) }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        expect(apiClient.patch).not.toHaveBeenCalled();
    });
});

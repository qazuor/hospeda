/**
 * @file NightInfoSection.test.tsx
 * @description TEST:5.1:5 — nightInfo editor controls (HOS-1787 leaf 5.1).
 *
 * The component is owned by the venue editor, but its price field changes
 * visibility with `entryKind`, its empty number means "not informed" (never
 * `0`), and a note is capped at 200 characters per locale — three behaviours a
 * payload test alone cannot see.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    const onPolicyChange = vi.fn();

    render(
        <NightInfoSection
            locale="es"
            data={buildEditData({ entryKind, ...overrides })}
            errors={{}}
            onFieldChange={onFieldChange}
            onPolicyChange={onPolicyChange}
        />
    );

    return { onFieldChange, onPolicyChange };
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

    it('removes policies.minAge when cleared, never sets it to zero (HOS-2060)', () => {
        const { onFieldChange, onPolicyChange } = renderSection('', { policies: { minAge: 18 } });

        fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '' } });

        expect(onPolicyChange).toHaveBeenCalledWith('minAge', undefined);
        expect(onFieldChange).not.toHaveBeenCalled();
    });

    it('writes the dress code into policies', () => {
        const { onPolicyChange } = renderSection('');

        fireEvent.change(screen.getByLabelText('Código de vestimenta'), {
            target: { value: 'elegant' }
        });

        expect(onPolicyChange).toHaveBeenCalledWith('dressCode', 'elegant');
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

    it('removes the age scope together with the age (HOS-2098)', () => {
        const { onPolicyChange } = renderSection('', {
            policies: { minAge: 18, minAgeScope: { kind: 'from_time', from: '00:00' } }
        });

        fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '' } });

        expect(onPolicyChange).toHaveBeenCalledWith('minAge', undefined);
        expect(onPolicyChange).toHaveBeenCalledWith('minAgeScope', undefined);
    });
});

describe('NightInfoSection — minimum-age scope (HOS-2098)', () => {
    it('has no scope selector while no age is set', () => {
        renderSection('');

        expect(screen.queryByTestId('night-info-age-scope')).toBeNull();
    });

    it('shows an unset scope as "all day", the default of existing venues', () => {
        renderSection('', { policies: { minAge: 18 } });

        expect(screen.getByLabelText('Alcance de la edad mínima')).toHaveValue('all_day');
        expect(screen.queryByLabelText('Rige desde las')).toBeNull();
    });

    it('announces the hint with the scope selector (aria-describedby)', () => {
        renderSection('', { policies: { minAge: 18 } });

        const select = screen.getByLabelText('Alcance de la edad mínima');
        expect(select.getAttribute('aria-describedby') ?? '').toContain(
            'night-info-age-scope-hint'
        );
        expect(document.getElementById('night-info-age-scope-hint')).not.toBeNull();
        expect(screen.getByTestId('night-info-age-scope').className).not.toMatch(/priceField/);
    });

    it('explains, under the time input, that "from a time" runs through closing after midnight', () => {
        renderSection('', {
            policies: { minAge: 18, minAgeScope: { kind: 'from_time', from: '20:00' } }
        });

        const input = screen.getByLabelText('Rige desde las');
        expect(input.getAttribute('aria-describedby') ?? '').toContain(
            'night-info-age-scope-from-hint'
        );
        const hint = document.getElementById('night-info-age-scope-from-hint');
        expect(hint?.textContent).toContain('hasta el cierre');
        expect(hint?.textContent).toContain('después de la medianoche');
        expect(hint?.textContent).toContain('antes de esa hora quedan afuera');
    });

    it('starts "from a time" with an empty time the owner must fill', () => {
        const { onPolicyChange } = renderSection('', { policies: { minAge: 18 } });

        fireEvent.change(screen.getByLabelText('Alcance de la edad mínima'), {
            target: { value: 'from_time' }
        });

        expect(onPolicyChange).toHaveBeenCalledWith('minAgeScope', {
            kind: 'from_time',
            from: ''
        });
    });

    it('writes the time of a "from a time" scope', () => {
        const { onPolicyChange } = renderSection('', {
            policies: { minAge: 18, minAgeScope: { kind: 'from_time', from: '' } }
        });

        fireEvent.change(screen.getByLabelText('Rige desde las'), { target: { value: '00:00' } });

        expect(onPolicyChange).toHaveBeenCalledWith('minAgeScope', {
            kind: 'from_time',
            from: '00:00'
        });
    });

    it('writes the localized text of an "area" scope, capped at 60 characters', () => {
        const { onPolicyChange } = renderSection('', {
            policies: {
                minAge: 18,
                minAgeScope: { kind: 'area', area: { es: '', en: '', pt: '' } }
            }
        });
        const es = within(screen.getByTestId('night-info-age-scope')).getByLabelText('Español');

        fireEvent.change(es, { target: { value: 'la pista' } });

        expect(es).toHaveAttribute('maxLength', '60');
        expect(onPolicyChange).toHaveBeenCalledWith('minAgeScope', {
            kind: 'area',
            area: { es: 'la pista', en: '', pt: '' }
        });
    });

    it('saves the scope through the policies PATCH', async () => {
        // Arrange
        vi.mocked(apiClient.patch).mockReset();
        vi.mocked(apiClient.patch).mockResolvedValue({ ok: true, data: {} } as never);
        render(
            <ListingEditor
                vertical="venue"
                sectionId="nightInfo"
                listingId="abc"
                locale="es"
                initialData={buildListing({ policies: { minAge: 18 } })}
            />
        );

        // Act
        fireEvent.change(screen.getByLabelText('Alcance de la edad mínima'), {
            target: { value: 'from_time' }
        });
        fireEvent.change(screen.getByLabelText('Rige desde las'), { target: { value: '00:00' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // Assert
        await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1));
        const body = JSON.parse(
            JSON.stringify(vi.mocked(apiClient.patch).mock.calls[0]?.[0]?.body)
        ) as Record<string, unknown>;
        expect(body).toEqual({
            policies: { minAgeScope: { kind: 'from_time', from: '00:00' } }
        });
    });

    it('blocks a "from a time" scope without a time before calling the API', () => {
        vi.mocked(apiClient.patch).mockReset();
        render(
            <ListingEditor
                vertical="venue"
                sectionId="nightInfo"
                listingId="abc"
                locale="es"
                initialData={buildListing({ policies: { minAge: 18 } })}
            />
        );

        fireEvent.change(screen.getByLabelText('Alcance de la edad mínima'), {
            target: { value: 'from_time' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        expect(apiClient.patch).not.toHaveBeenCalled();
    });
});

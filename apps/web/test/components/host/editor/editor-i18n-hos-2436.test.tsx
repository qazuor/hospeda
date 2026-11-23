/**
 * @file editor-i18n-hos-2436.test.tsx
 * @description Regression tests (HOS-2436): the accommodation editor's type
 * picker and rich-text toolbar render from `@repo/i18n` in the `en` locale, the
 * map's accessible name is a translated prop, and the account layout's
 * navigation aria-label is no longer hardcoded English. Uses the REAL
 * translation loader, so a hardcoded Spanish label would show up here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BasicInfoSectionProps } from '@/components/host/editor/BasicInfoSection.client';
import { BasicInfoSection } from '@/components/host/editor/BasicInfoSection.client';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';

vi.mock('@/components/host/editor/BasicInfoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/PlanEntitlementGate.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/host/editor/RichTextEditor.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: () => false,
        isLoading: false,
        error: null,
        limit: vi.fn(() => -1),
        plan: null
    })
}));

const DATA = {
    id: 'acc-1',
    slug: 'test-hotel',
    publicationStatus: 'DRAFT',
    name: 'Test Hotel',
    summary: 'Test summary for accommodation',
    description: 'Test description with content',
    type: 'HOTEL',
    destinationId: 'dest-1'
};

const props = (locale: 'en' | 'pt'): BasicInfoSectionProps =>
    ({
        locale,
        data: DATA,
        destinations: [{ id: 'dest-1', name: 'Concepción del Uruguay' }],
        errors: {},
        onFieldChange: vi.fn()
    }) as unknown as BasicInfoSectionProps;

describe('BasicInfoSection type picker (HOS-2436)', () => {
    it('renders English accommodation type labels', () => {
        render(<BasicInfoSection {...props('en')} />);
        const select = screen.getByRole('combobox', { name: /type/i });
        const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

        expect(labels).toContain('Apartment');
        expect(labels).toContain('Country house');
        expect(labels).not.toContain('Apartamento');
        expect(labels).not.toContain('Cabaña');
        expect(labels).toHaveLength(13);
    });

    it('renders Portuguese accommodation type labels', () => {
        render(<BasicInfoSection {...props('pt')} />);
        const select = screen.getByRole('combobox', { name: /tipo/i });
        const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

        expect(labels).not.toContain('Cabaña');
    });
});

describe('RichTextEditor toolbar (HOS-2436)', () => {
    it('renders English toolbar names', async () => {
        render(
            <RichTextEditor
                value="text"
                onChange={() => {}}
                locale="en"
            />
        );
        await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());

        expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
        for (const name of ['Bold', 'Italic', 'Underline', 'Quote', 'Link']) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: 'Negrita' })).toBeNull();
    });
});

describe('hardcoded aria-labels are gone (HOS-2436)', () => {
    const read = (rel: string): string =>
        readFileSync(resolve(__dirname, '../../../..', rel), 'utf8');

    it('AccountLayout navigation aria-label comes from i18n', () => {
        const source = read('src/layouts/AccountLayout.astro');
        expect(source).not.toContain('aria-label="Account navigation"');
        expect(source).toContain("aria-label={t('account.navigation')}");
    });

    it('LocationPickerMap takes its aria-label from a prop', () => {
        const source = read('src/components/host/editor/LocationPickerMap.client.tsx');
        expect(source).not.toContain('aria-label="Mapa de ubicación"');
        expect(source).toContain('aria-label={ariaLabel}');
    });

    it('LocationForm passes the translated map label; the shared pin translates its loading text', () => {
        // HOS-2496: the retired LocationPicker's map now renders through the
        // shared location section, whose pin owns the loading text.
        const form = read('src/components/host/editor/forms/LocationForm.client.tsx');
        expect(form).toContain('host.properties.editor.location.mapAriaLabel');
        const pin = read('src/components/account/editor-fields/EditorMapPin.tsx');
        expect(pin).toContain('account.editorFields.location.mapLoading');
        expect(pin).not.toContain('Loading map...\n');
    });
});

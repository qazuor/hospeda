/**
 * @file BasicInfoSection.kit-fields.test.tsx
 * @description HOS-2488: the accommodation basic-info section on the field kit.
 *
 * Every control has a visible label and keeps its `acc-*` id; the section is one
 * kit `Section` anchored to `section:accommodation.datos`; the accommodation
 * types come from `@repo/i18n` in es, en and pt (no Spanish literal in the
 * component); the premium rich-text notice names the field it is about.
 *
 * Runs against the REAL i18n catalog.
 *
 * @module test/components/host/editor/BasicInfoSection.kit-fields
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasicInfoSection } from '@/components/host/editor/BasicInfoSection.client';
import type { SupportedLocale } from '@/lib/i18n';

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
    name: 'Hotel Test',
    summary: 'Resumen del alojamiento de prueba',
    description: 'Descripción del alojamiento de prueba con contenido suficiente',
    type: 'CABIN',
    destinationId: 'dest-1'
} as never;

const DESTINATIONS = [{ id: 'dest-1', name: 'Colón' }] as never;

function renderSection({ locale = 'es' as SupportedLocale } = {}) {
    return render(
        <BasicInfoSection
            locale={locale}
            data={DATA}
            destinations={DESTINATIONS}
            errors={{}}
            onFieldChange={vi.fn()}
        />
    );
}

describe('accommodation BasicInfoSection on the kit (HOS-2488)', () => {
    it('labels every control and keeps the derived ids', () => {
        // Arrange + Act
        renderSection();

        // Assert
        expect(screen.getByLabelText(/^Nombre/)).toHaveAttribute('id', 'acc-name');
        expect(screen.getByLabelText(/^Tipo/)).toHaveAttribute('id', 'acc-type');
        expect(screen.getByLabelText(/^Destino/)).toHaveAttribute('id', 'acc-destinationId');
        expect(screen.getByLabelText(/^Descripción corta/)).toHaveAttribute('id', 'acc-summary');
        expect(screen.getByLabelText('Descripción')).toHaveAttribute('id', 'acc-description');
    });

    it('marks required fields through the kit, not with a typed asterisk', () => {
        // Arrange + Act
        renderSection();

        // Assert
        const name = screen.getByLabelText(/^Nombre/);
        expect(name).toHaveAttribute('aria-required', 'true');
        const label = document.querySelector('label[for="acc-name"]') as HTMLElement;
        expect(label.querySelector('[aria-hidden="true"]')).not.toBeNull();
        expect(label.textContent).not.toMatch(/\*\s*$/);
    });

    it('is one kit Section anchored to the accommodation datos page', () => {
        // Arrange + Act
        const { container } = renderSection();

        // Assert
        const sections = container.querySelectorAll('[data-kit-section]');
        expect(sections).toHaveLength(1);
        expect(sections[0]).toHaveAttribute('data-help', 'section:accommodation.datos');
    });

    it.each([
        ['es', 'Cabaña', 'Casa de campo'],
        ['en', 'Cabin', 'Country house'],
        ['pt', 'Cabana', 'Casa de campo']
    ] as const)('renders the accommodation types in %s from the catalog', (locale, cabin, country) => {
        // Arrange + Act
        renderSection({ locale });

        // Assert
        const type = document.getElementById('acc-type') as HTMLSelectElement;
        const labels = within(type)
            .getAllByRole('option')
            .map((option) => option.textContent);
        expect(labels).toContain(cabin);
        expect(labels).toContain(country);
        expect(labels).toHaveLength(13);
        if (locale === 'en') {
            expect(labels).not.toContain('Cabaña');
        }
    });

    it('names the field in the premium rich-text notice', () => {
        // Arrange + Act
        renderSection();

        // Assert
        const notice = document.getElementById('acc-description-hint') as HTMLElement;
        expect(notice.textContent).toContain('en la descripción');
    });
});

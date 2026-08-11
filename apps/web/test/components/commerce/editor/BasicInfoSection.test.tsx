/**
 * @file BasicInfoSection.test.tsx
 * @description Unit coverage for the commerce editor's identity + descriptive
 * section (HOS-258).
 *
 * @module test/components/commerce/editor/BasicInfoSection
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasicInfoSection } from '../../../../src/components/commerce/editor/BasicInfoSection.client';
import { buildEditData } from './edit-data-fixture';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            // `summaryHint` exists in the real catalog as the "{{count}}/300"
            // template, so the resolver ignores the fallback and interpolates
            // the param instead (BETA-124). Reproduce that here.
            const raw =
                key === 'commerce.owner.editor.validation.summaryHint'
                    ? '{{count}}/300'
                    : (fallback ?? `[MISSING:${key}]`);
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replaceAll(`{{${k}}}`, String(params[k])),
                raw
            );
        }
    })
}));

// HOS-371: `richDescription` is a TipTap editor now. These tests cover the
// section's wiring (seeding + `onFieldChange`), which the controlled-value
// contract fully expresses; the shim keeps the same accessible name so the
// assertions below still target the same field. That the field really IS a rich
// editor (toolbar, contenteditable, mount does not dirty the form) is asserted
// against the REAL component in
// `test/components/commerce/CommerceListingEditor.rich-description.test.tsx`.
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

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';
const DESTINATION_2 = '22222222-2222-4222-8222-222222222222';

const destinations = [
    { id: DESTINATION_1, name: 'Concepción del Uruguay' },
    { id: DESTINATION_2, name: 'Colón' }
];

function renderSection(overrides: Partial<React.ComponentProps<typeof BasicInfoSection>> = {}): {
    onFieldChange: ReturnType<typeof vi.fn>;
} {
    const onFieldChange = vi.fn();
    render(
        <BasicInfoSection
            locale="es"
            vertical="gastronomy"
            data={buildEditData()}
            destinations={destinations}
            destinationsLoadFailed={false}
            errors={{}}
            onFieldChange={onFieldChange}
            {...overrides}
        />
    );
    return { onFieldChange };
}

describe('BasicInfoSection', () => {
    it('seeds every field from the data object', () => {
        renderSection({
            data: buildEditData({
                name: 'La Parrilla',
                destinationId: DESTINATION_2,
                summary: 'Un resumen largo.',
                description: 'Una descripción.',
                richDescription: 'Texto ampliado.'
            })
        });

        expect(screen.getByLabelText('Nombre del comercio')).toHaveValue('La Parrilla');
        expect(screen.getByLabelText('Ciudad / Destino')).toHaveValue(DESTINATION_2);
        expect(screen.getByLabelText('Resumen')).toHaveValue('Un resumen largo.');
        expect(screen.getByLabelText('Descripción')).toHaveValue('Una descripción.');
        expect(screen.getByLabelText('Descripción ampliada')).toHaveValue('Texto ampliado.');
    });

    it.each([
        ['Nombre del comercio', 'name', 'Otro nombre'],
        ['Resumen', 'summary', 'Otro resumen'],
        ['Descripción', 'description', 'Otra descripción'],
        ['Descripción ampliada', 'richDescription', 'Otro texto']
    ])('reports a %s edit through onFieldChange', (label, field, value) => {
        const { onFieldChange } = renderSection();

        fireEvent.change(screen.getByLabelText(label), { target: { value } });

        expect(onFieldChange).toHaveBeenCalledWith(field, value);
    });

    it('reports a destination change through onFieldChange', () => {
        const { onFieldChange } = renderSection();

        fireEvent.change(screen.getByLabelText('Ciudad / Destino'), {
            target: { value: DESTINATION_2 }
        });

        expect(onFieldChange).toHaveBeenCalledWith('destinationId', DESTINATION_2);
    });

    it('reports a type change under the state key, not the payload key', () => {
        const { onFieldChange } = renderSection();
        const select = screen.getByLabelText('Categoría') as HTMLSelectElement;
        const firstReal = Array.from(select.options).find((o) => o.value !== '')?.value as string;

        fireEvent.change(select, { target: { value: firstReal } });

        // The form state calls it `listingType`; only the PATCH body renames it
        // to `type`. Passing 'type' here would silently write an unknown key.
        expect(onFieldChange).toHaveBeenCalledWith('listingType', firstReal);
    });

    it('offers a different type catalog per vertical', () => {
        const { unmount } = render(
            <BasicInfoSection
                locale="es"
                vertical="gastronomy"
                data={buildEditData()}
                destinations={destinations}
                destinationsLoadFailed={false}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );
        const gastronomyOptions = Array.from(
            (screen.getByLabelText('Categoría') as HTMLSelectElement).options
        ).map((o) => o.value);
        unmount();

        render(
            <BasicInfoSection
                locale="es"
                vertical="experience"
                data={buildEditData()}
                destinations={destinations}
                destinationsLoadFailed={false}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );
        const experienceOptions = Array.from(
            (screen.getByLabelText('Categoría') as HTMLSelectElement).options
        ).map((o) => o.value);

        expect(gastronomyOptions.length).toBeGreaterThan(1);
        expect(experienceOptions.length).toBeGreaterThan(1);
        expect(gastronomyOptions).not.toEqual(experienceOptions);
    });

    it('interpolates the summary counter instead of printing the template (BETA-124)', () => {
        renderSection({ data: buildEditData({ summary: 'hello world!' }) });

        const hint = screen.getByText('12/300');
        expect(hint).toBeInTheDocument();
        expect(hint.textContent).not.toContain('{{count}}');
    });

    describe('destination branches (HOS-260)', () => {
        it('shows a load-failure alert and hides the select when the fetch failed', () => {
            renderSection({ destinations: [], destinationsLoadFailed: true });

            expect(screen.getByRole('alert')).toHaveTextContent(
                'No pudimos cargar el listado de ciudades / destinos.'
            );
            expect(screen.queryByLabelText('Ciudad / Destino')).toBeNull();
        });

        it('shows an empty-catalog alert, distinct from the load failure', () => {
            renderSection({ destinations: [], destinationsLoadFailed: false });

            expect(screen.getByRole('alert')).toHaveTextContent(
                'Todavía no hay ciudades / destinos cargados.'
            );
            expect(screen.queryByLabelText('Ciudad / Destino')).toBeNull();
        });

        it('renders the select with no alert when the catalog has rows', () => {
            renderSection();

            expect(screen.getByLabelText('Ciudad / Destino')).toBeInTheDocument();
            expect(screen.queryByRole('alert')).toBeNull();
        });
    });

    it('surfaces per-field errors and marks the field invalid', () => {
        renderSection({ errors: { name: 'Nombre requerido', summary: 'Muy corto' } });

        expect(screen.getByText('Nombre requerido')).toBeInTheDocument();
        expect(screen.getByText('Muy corto')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre del comercio')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
        expect(screen.getByLabelText('Descripción')).toHaveAttribute('aria-invalid', 'false');
    });

    it('points the summary field at the counter when there is no error', () => {
        renderSection();

        // The hint doubles as the described-by target while the field is valid,
        // so the character count is announced to screen readers.
        expect(screen.getByLabelText('Resumen')).toHaveAttribute(
            'aria-describedby',
            'ce-summary-hint'
        );
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-basicInfo')).not.toBeNull();
    });
});

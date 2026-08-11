/**
 * @file PriceSection.test.tsx
 * @description Unit coverage for the commerce editor's price section (HOS-258).
 *
 * The only section whose shape depends on the vertical, so most of the value
 * here is asserting that each branch renders ONLY its own fields.
 *
 * @module test/components/commerce/editor/PriceSection
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PriceSection } from '../../../../src/components/commerce/editor/PriceSection.client';
import { buildEditData } from './edit-data-fixture';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

function renderSection(overrides: Partial<React.ComponentProps<typeof PriceSection>> = {}): {
    onFieldChange: ReturnType<typeof vi.fn>;
} {
    const onFieldChange = vi.fn();
    render(
        <PriceSection
            locale="es"
            vertical="gastronomy"
            data={buildEditData()}
            errors={{}}
            onFieldChange={onFieldChange}
            {...overrides}
        />
    );
    return { onFieldChange };
}

describe('PriceSection', () => {
    describe('gastronomy branch', () => {
        it('renders the tier and menu fields, and none of the experience ones', () => {
            renderSection();

            expect(screen.getByLabelText('Rango de precios')).toBeInTheDocument();
            expect(screen.getByLabelText('Enlace al menú')).toBeInTheDocument();
            expect(screen.queryByLabelText('Precio a consultar')).toBeNull();
            expect(screen.queryByLabelText(/Precio desde/)).toBeNull();
            expect(screen.queryByLabelText('Unidad de precio')).toBeNull();
        });

        it('reports a tier change through onFieldChange', () => {
            const { onFieldChange } = renderSection();
            const select = screen.getByLabelText('Rango de precios') as HTMLSelectElement;
            const tier = Array.from(select.options).find((o) => o.value !== '')?.value as string;

            fireEvent.change(select, { target: { value: tier } });

            expect(onFieldChange).toHaveBeenCalledWith('priceRange', tier);
        });

        it('reports a menu link change through onFieldChange', () => {
            const { onFieldChange } = renderSection();

            fireEvent.change(screen.getByLabelText('Enlace al menú'), {
                target: { value: 'https://menu.test/carta' }
            });

            expect(onFieldChange).toHaveBeenCalledWith('menuUrl', 'https://menu.test/carta');
        });

        it('surfaces the menuUrl error', () => {
            renderSection({ errors: { menuUrl: 'URL inválida' } });

            expect(screen.getByText('URL inválida')).toBeInTheDocument();
            expect(screen.getByLabelText('Enlace al menú')).toHaveAttribute('aria-invalid', 'true');
        });
    });

    describe('experience branch', () => {
        const experienceProps = { vertical: 'experience' as const };

        it('renders the on-request toggle and price fields, and no tier select', () => {
            renderSection(experienceProps);

            expect(screen.getByLabelText('Precio a consultar')).toBeInTheDocument();
            expect(screen.getByLabelText(/Precio desde/)).toBeInTheDocument();
            expect(screen.getByLabelText('Unidad de precio')).toBeInTheDocument();
            expect(screen.queryByLabelText('Rango de precios')).toBeNull();
            expect(screen.queryByLabelText('Enlace al menú')).toBeNull();
        });

        it('reports the on-request toggle as a boolean', () => {
            const { onFieldChange } = renderSection(experienceProps);

            fireEvent.click(screen.getByLabelText('Precio a consultar'));

            expect(onFieldChange).toHaveBeenCalledWith('isPriceOnRequest', true);
        });

        it('parses a typed price into an integer', () => {
            const { onFieldChange } = renderSection(experienceProps);

            fireEvent.change(screen.getByLabelText(/Precio desde/), { target: { value: '750' } });

            expect(onFieldChange).toHaveBeenCalledWith('priceFrom', 750);
        });

        it('floors a fractional price rather than sending a decimal', () => {
            const { onFieldChange } = renderSection(experienceProps);

            // `ExperienceSchema.priceFrom` is `z.number().int()` — a decimal
            // would fail validation at submit with no field-level hint.
            fireEvent.change(screen.getByLabelText(/Precio desde/), { target: { value: '750.9' } });

            expect(onFieldChange).toHaveBeenCalledWith('priceFrom', 750);
        });

        it('maps a cleared price to null, not to zero or NaN', () => {
            const { onFieldChange } = renderSection({
                ...experienceProps,
                data: buildEditData({ priceFrom: 500 })
            });

            fireEvent.change(screen.getByLabelText(/Precio desde/), { target: { value: '' } });

            // `Number('')` is 0 and `Math.floor(Number(''))` is 0 — an empty
            // field must not read as a free experience.
            expect(onFieldChange).toHaveBeenCalledWith('priceFrom', null);
        });

        it('reports a unit change through onFieldChange', () => {
            const { onFieldChange } = renderSection(experienceProps);
            const select = screen.getByLabelText('Unidad de precio') as HTMLSelectElement;
            const unit = Array.from(select.options).find((o) => o.value !== '')?.value as string;

            fireEvent.change(select, { target: { value: unit } });

            expect(onFieldChange).toHaveBeenCalledWith('priceUnit', unit);
        });

        it('disables the price fields while the listing is price-on-request', () => {
            renderSection({
                ...experienceProps,
                data: buildEditData({ isPriceOnRequest: true })
            });

            expect(screen.getByLabelText(/Precio desde/)).toBeDisabled();
            expect(screen.getByLabelText('Unidad de precio')).toBeDisabled();
        });

        it('leaves the price fields enabled otherwise', () => {
            renderSection(experienceProps);

            expect(screen.getByLabelText(/Precio desde/)).toBeEnabled();
            expect(screen.getByLabelText('Unidad de precio')).toBeEnabled();
        });
    });

    it('renders the same scrollspy anchor for both verticals', () => {
        const { unmount } = render(
            <PriceSection
                locale="es"
                vertical="gastronomy"
                data={buildEditData()}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );
        expect(document.getElementById('editor-price')).not.toBeNull();
        unmount();

        render(
            <PriceSection
                locale="es"
                vertical="experience"
                data={buildEditData()}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );
        expect(document.getElementById('editor-price')).not.toBeNull();
    });
});

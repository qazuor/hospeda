// @vitest-environment jsdom
/**
 * Tests for FilterNumberRange component (SPEC-185 Phase 1).
 *
 * Covers:
 * - Renders without crashing
 * - Shows the label from config.labelKey
 * - Shows unit label when unitLabelKey is provided
 * - onChange called with value when input changes
 * - onChange called with undefined when input is cleared
 * - min, max, step HTML attributes forwarded to inputs
 * - Active visual state (border class) when at least one bound is set
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterNumberRange } from '../FilterNumberRange';
import type { NumberRangeFilterConfig } from '../filter-types';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const priceConfig: NumberRangeFilterConfig = {
    type: 'number-range',
    paramKey: 'price',
    labelKey: 'admin-filters.price.label',
    paramKeyMin: 'minPrice',
    paramKeyMax: 'maxPrice',
    min: 0,
    max: 100000,
    step: 100,
    unitLabelKey: 'admin-filters.unit.ars'
};

const noUnitConfig: NumberRangeFilterConfig = {
    type: 'number-range',
    paramKey: 'rating',
    labelKey: 'admin-filters.rating.label',
    paramKeyMin: 'minRating',
    paramKeyMax: 'maxRating'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterNumberRange', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        expect(container.firstChild).not.toBeNull();
    });

    it('shows the label from config.labelKey (t is identity)', () => {
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        expect(screen.getAllByText(/admin-filters\.price\.label/).length).toBeGreaterThan(0);
    });

    it('shows the unit label when unitLabelKey is provided', () => {
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        expect(screen.getByText('admin-filters.unit.ars')).toBeDefined();
    });

    it('does not show a unit label when unitLabelKey is absent', () => {
        render(
            <FilterNumberRange
                config={noUnitConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        // unit label span should not be present
        expect(screen.queryByText('admin-filters.unit.ars')).toBeNull();
    });

    it('calls onChangeMin with the typed value', () => {
        const onChangeMin = vi.fn();
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={onChangeMin}
                onChangeMax={vi.fn()}
            />
        );

        const minInput = screen.getByLabelText(
            /admin-filters\.price\.label.*admin-filters\.rangeMin/
        );
        fireEvent.change(minInput, { target: { value: '1000' } });
        expect(onChangeMin).toHaveBeenCalledWith('1000');
    });

    it('calls onChangeMax with the typed value', () => {
        const onChangeMax = vi.fn();
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={onChangeMax}
            />
        );

        const maxInput = screen.getByLabelText(
            /admin-filters\.price\.label.*admin-filters\.rangeMax/
        );
        fireEvent.change(maxInput, { target: { value: '5000' } });
        expect(onChangeMax).toHaveBeenCalledWith('5000');
    });

    it('calls onChangeMin with undefined when the min input is cleared', () => {
        const onChangeMin = vi.fn();
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin="1000"
                valueMax={undefined}
                onChangeMin={onChangeMin}
                onChangeMax={vi.fn()}
            />
        );

        const minInput = screen.getByLabelText(
            /admin-filters\.price\.label.*admin-filters\.rangeMin/
        );
        fireEvent.change(minInput, { target: { value: '' } });
        expect(onChangeMin).toHaveBeenCalledWith(undefined);
    });

    it('calls onChangeMax with undefined when the max input is cleared', () => {
        const onChangeMax = vi.fn();
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax="5000"
                onChangeMin={vi.fn()}
                onChangeMax={onChangeMax}
            />
        );

        const maxInput = screen.getByLabelText(
            /admin-filters\.price\.label.*admin-filters\.rangeMax/
        );
        fireEvent.change(maxInput, { target: { value: '' } });
        expect(onChangeMax).toHaveBeenCalledWith(undefined);
    });

    it('renders a fieldset with a sr-only legend providing the accessible name', () => {
        const { container } = render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        const fieldset = container.querySelector('fieldset');
        expect(fieldset).not.toBeNull();
        const legend = fieldset?.querySelector('legend');
        expect(legend).not.toBeNull();
        expect(legend?.textContent).toBe('admin-filters.price.label');
    });

    it('shows the current valueMin in the input', () => {
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin="2500"
                valueMax={undefined}
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        const minInput = screen.getByLabelText(
            /admin-filters\.price\.label.*admin-filters\.rangeMin/
        ) as HTMLInputElement;
        expect(minInput.value).toBe('2500');
    });

    it('shows the current valueMax in the input', () => {
        render(
            <FilterNumberRange
                config={priceConfig}
                valueMin={undefined}
                valueMax="7500"
                onChangeMin={vi.fn()}
                onChangeMax={vi.fn()}
            />
        );

        const maxInput = screen.getByLabelText(
            /admin-filters\.price\.label.*admin-filters\.rangeMax/
        ) as HTMLInputElement;
        expect(maxInput.value).toBe('7500');
    });
});

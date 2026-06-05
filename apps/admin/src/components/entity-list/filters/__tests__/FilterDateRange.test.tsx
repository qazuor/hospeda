// @vitest-environment jsdom
/**
 * Tests for FilterDateRange component (SPEC-185 Phase 1).
 *
 * Covers:
 * - Renders without crashing
 * - Shows the label from config.labelKey
 * - onChange called with ISO date string when input changes
 * - onChange called with undefined when input is cleared
 * - Current values reflected in the date inputs
 * - group role and aria-label present
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterDateRange } from '../FilterDateRange';
import type { DateRangeFilterConfig } from '../filter-types';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const createdAtConfig: DateRangeFilterConfig = {
    type: 'date-range',
    paramKey: 'createdAt',
    labelKey: 'admin-filters.createdAt.label',
    paramKeyFrom: 'createdAfter',
    paramKeyTo: 'createdBefore'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterDateRange', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo={undefined}
                onChangeFrom={vi.fn()}
                onChangeTo={vi.fn()}
            />
        );

        expect(container.firstChild).not.toBeNull();
    });

    it('shows the label from config.labelKey (t is identity)', () => {
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo={undefined}
                onChangeFrom={vi.fn()}
                onChangeTo={vi.fn()}
            />
        );

        expect(screen.getAllByText(/admin-filters\.createdAt\.label/).length).toBeGreaterThan(0);
    });

    it('renders a fieldset with a sr-only legend providing the accessible name', () => {
        const { container } = render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo={undefined}
                onChangeFrom={vi.fn()}
                onChangeTo={vi.fn()}
            />
        );

        const fieldset = container.querySelector('fieldset');
        expect(fieldset).not.toBeNull();
        const legend = fieldset?.querySelector('legend');
        expect(legend).not.toBeNull();
        expect(legend?.textContent).toBe('admin-filters.createdAt.label');
    });

    it('calls onChangeFrom with the selected date string', () => {
        const onChangeFrom = vi.fn();
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo={undefined}
                onChangeFrom={onChangeFrom}
                onChangeTo={vi.fn()}
            />
        );

        // date inputs are found by their aria-label containing 'rangeFrom'
        const fromInput = screen.getByLabelText(
            /admin-filters\.createdAt\.label.*admin-filters\.rangeFrom/
        );
        fireEvent.change(fromInput, { target: { value: '2026-01-01' } });
        expect(onChangeFrom).toHaveBeenCalledWith('2026-01-01');
    });

    it('calls onChangeTo with the selected date string', () => {
        const onChangeTo = vi.fn();
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo={undefined}
                onChangeFrom={vi.fn()}
                onChangeTo={onChangeTo}
            />
        );

        const toInput = screen.getByLabelText(
            /admin-filters\.createdAt\.label.*admin-filters\.rangeTo/
        );
        fireEvent.change(toInput, { target: { value: '2026-03-31' } });
        expect(onChangeTo).toHaveBeenCalledWith('2026-03-31');
    });

    it('calls onChangeFrom with undefined when the from input is cleared', () => {
        const onChangeFrom = vi.fn();
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom="2026-01-01"
                valueTo={undefined}
                onChangeFrom={onChangeFrom}
                onChangeTo={vi.fn()}
            />
        );

        const fromInput = screen.getByLabelText(
            /admin-filters\.createdAt\.label.*admin-filters\.rangeFrom/
        );
        fireEvent.change(fromInput, { target: { value: '' } });
        expect(onChangeFrom).toHaveBeenCalledWith(undefined);
    });

    it('calls onChangeTo with undefined when the to input is cleared', () => {
        const onChangeTo = vi.fn();
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo="2026-03-31"
                onChangeFrom={vi.fn()}
                onChangeTo={onChangeTo}
            />
        );

        const toInput = screen.getByLabelText(
            /admin-filters\.createdAt\.label.*admin-filters\.rangeTo/
        );
        fireEvent.change(toInput, { target: { value: '' } });
        expect(onChangeTo).toHaveBeenCalledWith(undefined);
    });

    it('reflects the current valueFrom in the input', () => {
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom="2026-02-15"
                valueTo={undefined}
                onChangeFrom={vi.fn()}
                onChangeTo={vi.fn()}
            />
        );

        const fromInput = screen.getByLabelText(
            /admin-filters\.createdAt\.label.*admin-filters\.rangeFrom/
        ) as HTMLInputElement;
        expect(fromInput.value).toBe('2026-02-15');
    });

    it('reflects the current valueTo in the input', () => {
        render(
            <FilterDateRange
                config={createdAtConfig}
                valueFrom={undefined}
                valueTo="2026-04-30"
                onChangeFrom={vi.fn()}
                onChangeTo={vi.fn()}
            />
        );

        const toInput = screen.getByLabelText(
            /admin-filters\.createdAt\.label.*admin-filters\.rangeTo/
        ) as HTMLInputElement;
        expect(toInput.value).toBe('2026-04-30');
    });
});

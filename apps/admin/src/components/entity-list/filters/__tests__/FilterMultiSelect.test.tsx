// @vitest-environment jsdom
/**
 * Tests for FilterMultiSelect (HOS-919 T-046): any-of filter whose options are
 * loaded at runtime and whose value is a comma-separated string in the URL.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterMultiSelect } from '../FilterMultiSelect';
import type { MultiSelectFilterConfig } from '../filter-types';
import { buildFilterChips } from '../filter-utils';

const OPTIONS = [
    { value: 'plomeria', label: 'Plomería' },
    { value: 'gas', label: 'Gas' }
];

const config: MultiSelectFilterConfig = {
    paramKey: 'categories',
    labelKey: 'admin-filters.hostTradeCategories.label',
    type: 'multi-select',
    optionsQueryKey: ['test-options'],
    loadOptions: async () => OPTIONS
};

async function openMenu() {
    fireEvent.click(await screen.findByTestId('filter-multi-select-categories'));
    await screen.findByText('Plomería');
}

describe('FilterMultiSelect', () => {
    it('lists the loaded options as checkboxes', async () => {
        render(
            <FilterMultiSelect
                config={config}
                value={undefined}
                onChange={vi.fn()}
            />
        );
        await openMenu();

        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    });

    it('emits a comma-separated list when a second option is added', async () => {
        const onChange = vi.fn();
        render(
            <FilterMultiSelect
                config={config}
                value="plomeria"
                onChange={onChange}
            />
        );
        await openMenu();

        fireEvent.click(screen.getByLabelText('Gas'));

        expect(onChange).toHaveBeenCalledWith('plomeria,gas');
    });

    it('emits undefined when the last selected option is removed', async () => {
        const onChange = vi.fn();
        render(
            <FilterMultiSelect
                config={config}
                value="gas"
                onChange={onChange}
            />
        );
        await openMenu();

        fireEvent.click(screen.getByLabelText('Gas'));

        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('shows how many options are selected on the trigger', async () => {
        render(
            <FilterMultiSelect
                config={config}
                value="plomeria,gas"
                onChange={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('filter-multi-select-categories').textContent).toContain('2');
        });
    });
});

describe('buildFilterChips with a multi-select filter', () => {
    it('shows the selected values joined in one chip', () => {
        const chips = buildFilterChips({
            activeFilters: { categories: 'plomeria,gas' },
            filterBarConfig: { filters: [config] },
            defaultFilters: {},
            t: (key) => key
        });

        expect(chips).toHaveLength(1);
        expect(chips[0]?.displayValue).toBe('plomeria, gas');
    });
});

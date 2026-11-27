import { expect, it } from 'vitest';
import {
    computeInitialCollapsed,
    initStateFromParams
} from '@/components/shared/filters/filter-reducer';
import type { FilterGroup } from '@/components/shared/filters/filter-types/filter.types';

it('expands the first collapsible group and opt-in groups, but not other inactive groups', () => {
    const filters: FilterGroup[] = [
        { id: 'header', type: 'section-header', label: 'Filters' },
        { id: 'featured', type: 'toggle', label: 'Featured' },
        { id: 'q', type: 'search', label: 'Search' },
        { id: 'inactive', type: 'checkbox', label: 'Category', options: [] },
        { id: 'price', type: 'search', label: 'Price', defaultExpanded: true },
        {
            id: 'date',
            type: 'date-range',
            label: 'Date',
            fromKey: 'from',
            toKey: 'to',
            defaultExpanded: true
        }
    ];
    const state = initStateFromParams({ filters, defaultSort: '', params: {} });

    const collapsed = computeInitialCollapsed({ filters, state });

    expect(collapsed).toEqual({ q: false, inactive: true, price: false, date: false });
});

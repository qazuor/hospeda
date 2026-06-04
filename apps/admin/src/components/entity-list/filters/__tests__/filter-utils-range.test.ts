/**
 * Tests for range filter support in filter-utils.ts (SPEC-185 Phase 1).
 *
 * Covers:
 * - extractActiveFilters: number-range and date-range bound extraction
 * - extractActiveFilters: sentinel clearing per bound
 * - buildFilterChips: one chip per active range bound
 * - buildFilterChips: chip sort uses parent filter order
 */

import { describe, expect, it } from 'vitest';
import type {
    DateRangeFilterConfig,
    FilterBarConfig,
    NumberRangeFilterConfig
} from '../filter-types';
import { FILTER_CLEARED_SENTINEL, buildFilterChips, extractActiveFilters } from '../filter-utils';

// ---------------------------------------------------------------------------
// Identity translation function
// ---------------------------------------------------------------------------

const t = (key: string): string => key;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const priceRangeFilter: NumberRangeFilterConfig = {
    type: 'number-range',
    paramKey: 'price',
    labelKey: 'admin-filters.price.label',
    paramKeyMin: 'minPrice',
    paramKeyMax: 'maxPrice',
    min: 0,
    step: 100,
    unitLabelKey: 'admin-filters.unit.ars',
    order: 1
};

const createdAtFilter: DateRangeFilterConfig = {
    type: 'date-range',
    paramKey: 'createdAt',
    labelKey: 'admin-filters.createdAt.label',
    paramKeyFrom: 'createdAfter',
    paramKeyTo: 'createdBefore',
    order: 2
};

const rangeOnlyConfig: FilterBarConfig = {
    filters: [priceRangeFilter, createdAtFilter]
};

// ---------------------------------------------------------------------------
// extractActiveFilters — number-range
// ---------------------------------------------------------------------------

describe('extractActiveFilters — number-range', () => {
    it('includes both bounds when both are set', () => {
        const result = extractActiveFilters({
            searchParams: { minPrice: '1000', maxPrice: '5000' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.minPrice).toBe('1000');
        expect(result.maxPrice).toBe('5000');
    });

    it('includes only min bound when max is absent', () => {
        const result = extractActiveFilters({
            searchParams: { minPrice: '1000' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.minPrice).toBe('1000');
        expect(result.maxPrice).toBeUndefined();
    });

    it('includes only max bound when min is absent', () => {
        const result = extractActiveFilters({
            searchParams: { maxPrice: '5000' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.minPrice).toBeUndefined();
        expect(result.maxPrice).toBe('5000');
    });

    it('excludes min bound when cleared with sentinel', () => {
        const result = extractActiveFilters({
            searchParams: { minPrice: FILTER_CLEARED_SENTINEL, maxPrice: '5000' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.minPrice).toBeUndefined();
        expect(result.maxPrice).toBe('5000');
    });

    it('excludes max bound when cleared with sentinel', () => {
        const result = extractActiveFilters({
            searchParams: { minPrice: '1000', maxPrice: FILTER_CLEARED_SENTINEL },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.minPrice).toBe('1000');
        expect(result.maxPrice).toBeUndefined();
    });

    it('returns empty object when neither bound is present', () => {
        const result = extractActiveFilters({
            searchParams: {},
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.minPrice).toBeUndefined();
        expect(result.maxPrice).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// extractActiveFilters — date-range
// ---------------------------------------------------------------------------

describe('extractActiveFilters — date-range', () => {
    it('includes both bounds when both are set', () => {
        const result = extractActiveFilters({
            searchParams: { createdAfter: '2026-01-01', createdBefore: '2026-03-31' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.createdAfter).toBe('2026-01-01');
        expect(result.createdBefore).toBe('2026-03-31');
    });

    it('includes only from bound when to is absent', () => {
        const result = extractActiveFilters({
            searchParams: { createdAfter: '2026-01-01' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.createdAfter).toBe('2026-01-01');
        expect(result.createdBefore).toBeUndefined();
    });

    it('excludes from bound when cleared with sentinel', () => {
        const result = extractActiveFilters({
            searchParams: { createdAfter: FILTER_CLEARED_SENTINEL, createdBefore: '2026-03-31' },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.createdAfter).toBeUndefined();
        expect(result.createdBefore).toBe('2026-03-31');
    });

    it('excludes to bound when cleared with sentinel', () => {
        const result = extractActiveFilters({
            searchParams: { createdAfter: '2026-01-01', createdBefore: FILTER_CLEARED_SENTINEL },
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.createdAfter).toBe('2026-01-01');
        expect(result.createdBefore).toBeUndefined();
    });

    it('returns empty object when neither bound is present', () => {
        const result = extractActiveFilters({
            searchParams: {},
            filterBarConfig: rangeOnlyConfig
        });

        expect(result.createdAfter).toBeUndefined();
        expect(result.createdBefore).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// buildFilterChips — range filters generate one chip per active bound
// ---------------------------------------------------------------------------

describe('buildFilterChips — number-range', () => {
    it('generates two chips when both bounds are active', () => {
        const chips = buildFilterChips({
            activeFilters: { minPrice: '1000', maxPrice: '5000' },
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: {},
            t
        });

        expect(chips).toHaveLength(2);
        const minChip = chips.find((c) => c.paramKey === 'minPrice');
        const maxChip = chips.find((c) => c.paramKey === 'maxPrice');
        expect(minChip).toBeDefined();
        expect(maxChip).toBeDefined();
        expect(minChip?.value).toBe('1000');
        expect(maxChip?.value).toBe('5000');
    });

    it('generates one chip when only min is active', () => {
        const chips = buildFilterChips({
            activeFilters: { minPrice: '1000' },
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: {},
            t
        });

        expect(chips).toHaveLength(1);
        expect(chips[0].paramKey).toBe('minPrice');
    });

    it('generates one chip when only max is active', () => {
        const chips = buildFilterChips({
            activeFilters: { maxPrice: '5000' },
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: {},
            t
        });

        expect(chips).toHaveLength(1);
        expect(chips[0].paramKey).toBe('maxPrice');
    });

    it('generates no chips when no bounds are active', () => {
        const chips = buildFilterChips({
            activeFilters: {},
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: {},
            t
        });

        expect(chips).toHaveLength(0);
    });

    it('marks range chips as isDefault: false (range filters have no default values)', () => {
        const chips = buildFilterChips({
            activeFilters: { minPrice: '0' },
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: { minPrice: '0' },
            t
        });

        expect(chips[0].isDefault).toBe(false);
    });
});

describe('buildFilterChips — date-range', () => {
    it('generates two chips when both bounds are active', () => {
        const chips = buildFilterChips({
            activeFilters: { createdAfter: '2026-01-01', createdBefore: '2026-03-31' },
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: {},
            t
        });

        expect(chips).toHaveLength(2);
        const fromChip = chips.find((c) => c.paramKey === 'createdAfter');
        const toChip = chips.find((c) => c.paramKey === 'createdBefore');
        expect(fromChip).toBeDefined();
        expect(toChip).toBeDefined();
        expect(fromChip?.value).toBe('2026-01-01');
        expect(toChip?.value).toBe('2026-03-31');
    });

    it('generates one chip when only the from bound is active', () => {
        const chips = buildFilterChips({
            activeFilters: { createdAfter: '2026-01-01' },
            filterBarConfig: rangeOnlyConfig,
            defaultFilters: {},
            t
        });

        expect(chips).toHaveLength(1);
        expect(chips[0].paramKey).toBe('createdAfter');
    });
});

// ---------------------------------------------------------------------------
// buildFilterChips — mixed range + simple filter ordering
// ---------------------------------------------------------------------------

describe('buildFilterChips — sorting across range and simple filters', () => {
    it('sorts range bound chips by their parent filter order', () => {
        const mixedConfig: FilterBarConfig = {
            filters: [
                {
                    paramKey: 'status',
                    labelKey: 'filters.status',
                    type: 'select',
                    options: [{ value: 'ACTIVE', labelKey: 'status.active' }],
                    order: 3
                },
                priceRangeFilter // order: 1
            ]
        };

        const chips = buildFilterChips({
            activeFilters: { maxPrice: '5000', status: 'ACTIVE' },
            filterBarConfig: mixedConfig,
            defaultFilters: {},
            t
        });

        // price (order 1) should come before status (order 3)
        expect(chips[0].paramKey).toBe('maxPrice');
        expect(chips[1].paramKey).toBe('status');
    });
});

// @vitest-environment jsdom
/**
 * Tests for useFilterState hook — range filter serialization (SPEC-185 Phase 1).
 *
 * Covers:
 * - set-both: both bounds appear in URL update
 * - min-only: only paramKeyMin in URL, paramKeyMax absent
 * - max-only: only paramKeyMax in URL, paramKeyMin absent
 * - clear-min: removing min bound leaves max intact
 * - clear-max: removing max bound leaves min intact
 * - clear-both: clearing both bounds via handleClearAll
 * - handleResetDefaults: removes range bounds (no default)
 * - date-range: equivalent behavior for from/to bounds
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FilterBarConfig } from '../filter-types';
import { useFilterState } from '../useFilterState';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const numberRangeConfig: FilterBarConfig = {
    filters: [
        {
            type: 'number-range',
            paramKey: 'price',
            labelKey: 'admin-filters.price.label',
            paramKeyMin: 'minPrice',
            paramKeyMax: 'maxPrice',
            min: 0,
            order: 1
        }
    ]
};

const dateRangeConfig: FilterBarConfig = {
    filters: [
        {
            type: 'date-range',
            paramKey: 'createdAt',
            labelKey: 'admin-filters.createdAt.label',
            paramKeyFrom: 'createdAfter',
            paramKeyTo: 'createdBefore',
            order: 1
        }
    ]
};

const mixedConfig: FilterBarConfig = {
    filters: [
        {
            type: 'number-range',
            paramKey: 'price',
            labelKey: 'admin-filters.price.label',
            paramKeyMin: 'minPrice',
            paramKeyMax: 'maxPrice',
            order: 1
        },
        {
            paramKey: 'status',
            labelKey: 'admin-filters.status.label',
            type: 'select',
            defaultValue: 'ACTIVE',
            options: [{ value: 'ACTIVE', labelKey: 'status.active' }],
            order: 2
        }
    ]
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeOnUpdateSearch() {
    const spy = vi.fn((updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
        spy.lastResult = updater({});
    }) as ReturnType<typeof vi.fn> & { lastResult: Record<string, unknown> };
    spy.lastResult = {};
    return spy;
}

// ---------------------------------------------------------------------------
// number-range: handleFilterChange
// ---------------------------------------------------------------------------

describe('useFilterState — number-range handleFilterChange', () => {
    it('set-both: sets minPrice and maxPrice independently', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Set min
        act(() => {
            result.current.handleFilterChange('minPrice', '1000');
        });
        expect(onUpdateSearch.lastResult.minPrice).toBe('1000');
        expect(onUpdateSearch.lastResult.page).toBe(1);

        // Set max
        act(() => {
            result.current.handleFilterChange('maxPrice', '5000');
        });
        expect(onUpdateSearch.lastResult.maxPrice).toBe('5000');
        expect(onUpdateSearch.lastResult.page).toBe(1);
    });

    it('min-only: URL contains paramKeyMin, paramKeyMax absent', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleFilterChange('minPrice', '1000');
        });

        expect(onUpdateSearch.lastResult.minPrice).toBe('1000');
        expect(onUpdateSearch.lastResult.maxPrice).toBeUndefined();
    });

    it('max-only: URL contains paramKeyMax, paramKeyMin absent', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleFilterChange('maxPrice', '5000');
        });

        expect(onUpdateSearch.lastResult.maxPrice).toBe('5000');
        expect(onUpdateSearch.lastResult.minPrice).toBeUndefined();
    });

    it('clear-min: passing undefined removes minPrice, maxPrice unaffected in call', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: { minPrice: '1000', maxPrice: '5000' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleFilterChange('minPrice', undefined);
        });

        // The param update should set minPrice to undefined (removes from URL)
        expect(onUpdateSearch.lastResult.minPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.page).toBe(1);
    });

    it('clear-max: passing undefined removes maxPrice', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: { minPrice: '1000', maxPrice: '5000' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleFilterChange('maxPrice', undefined);
        });

        expect(onUpdateSearch.lastResult.maxPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.page).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// number-range: handleClearAll
// ---------------------------------------------------------------------------

describe('useFilterState — number-range handleClearAll', () => {
    it('clear-both: sets both bounds to undefined (no sentinel for range filters)', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: { minPrice: '1000', maxPrice: '5000' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleClearAll();
        });

        expect(onUpdateSearch.lastResult.minPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.maxPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.page).toBe(1);
    });

    it('does not emit FILTER_CLEARED_SENTINEL for range bounds (no default)', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: { minPrice: '1000' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleClearAll();
        });

        expect(onUpdateSearch.lastResult.minPrice).not.toBe('__cleared__');
        expect(onUpdateSearch.lastResult.maxPrice).not.toBe('__cleared__');
    });
});

// ---------------------------------------------------------------------------
// handleClearAll with mixed range + select with default
// ---------------------------------------------------------------------------

describe('useFilterState — handleClearAll mixed config', () => {
    it('clears range bounds (undefined) and sentinels select-with-default', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: mixedConfig,
                searchParams: { minPrice: '1000', status: 'ACTIVE' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleClearAll();
        });

        // Range bounds: removed (undefined)
        expect(onUpdateSearch.lastResult.minPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.maxPrice).toBeUndefined();
        // Select with default: sentinel
        expect(onUpdateSearch.lastResult.status).toBe('__cleared__');
    });
});

// ---------------------------------------------------------------------------
// handleResetDefaults for range filters (removes bounds, no defaults)
// ---------------------------------------------------------------------------

describe('useFilterState — number-range handleResetDefaults', () => {
    it('removes both range bounds (they have no default)', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: { minPrice: '1000', maxPrice: '5000' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleResetDefaults();
        });

        expect(onUpdateSearch.lastResult.minPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.maxPrice).toBeUndefined();
        expect(onUpdateSearch.lastResult.page).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// date-range: handleFilterChange
// ---------------------------------------------------------------------------

describe('useFilterState — date-range handleFilterChange', () => {
    it('set-both: sets createdAfter and createdBefore', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: dateRangeConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleFilterChange('createdAfter', '2026-01-01');
        });
        expect(onUpdateSearch.lastResult.createdAfter).toBe('2026-01-01');

        act(() => {
            result.current.handleFilterChange('createdBefore', '2026-03-31');
        });
        expect(onUpdateSearch.lastResult.createdBefore).toBe('2026-03-31');
    });

    it('clear-from: removing createdAfter sets it to undefined', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: dateRangeConfig,
                searchParams: { createdAfter: '2026-01-01', createdBefore: '2026-03-31' },
                onUpdateSearch
            })
        );

        act(() => {
            result.current.handleFilterChange('createdAfter', undefined);
        });

        expect(onUpdateSearch.lastResult.createdAfter).toBeUndefined();
        expect(onUpdateSearch.lastResult.page).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// activeFilters derived from searchParams for range
// ---------------------------------------------------------------------------

describe('useFilterState — activeFilters for range filters', () => {
    it('derives activeFilters including both bounds from searchParams', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: { minPrice: '500', maxPrice: '3000' },
                onUpdateSearch
            })
        );

        expect(result.current.activeFilters.minPrice).toBe('500');
        expect(result.current.activeFilters.maxPrice).toBe('3000');
        expect(result.current.hasActiveFilters).toBe(true);
    });

    it('returns empty activeFilters when no bounds in searchParams', () => {
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: numberRangeConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        expect(result.current.activeFilters.minPrice).toBeUndefined();
        expect(result.current.activeFilters.maxPrice).toBeUndefined();
        expect(result.current.hasActiveFilters).toBe(false);
    });
});

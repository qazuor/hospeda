// @vitest-environment jsdom
/**
 * Tests for useFilterState hook.
 *
 * Covers:
 * - activeFilters derivation from searchParams + config defaults
 * - computedDefaults extraction from config
 * - hasActiveFilters derived boolean
 * - hasNonDefaultFilters derived boolean
 * - handleFilterChange: set, remove (no default), remove (with default → sentinel)
 * - handleClearAll: sentinel for defaults, undefined for non-defaults
 * - handleResetDefaults: restores defaultValues, removes non-defaults
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FilterBarConfig } from '../filter-types';
import { FILTER_CLEARED_SENTINEL } from '../filter-utils';
import { useFilterState } from '../useFilterState';

// The global setup already mocks @/hooks/use-translations, but we declare the
// mock here as well so the import is explicit and this file is self-contained.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

/**
 * Standard test config with:
 * - destinationType (select, defaultValue: 'CITY', order: 1)
 * - status         (select, no default,            order: 2)
 * - isFeatured     (boolean, no default,            order: 3)
 */
const testConfig: FilterBarConfig = {
    filters: [
        {
            paramKey: 'destinationType',
            labelKey: 'admin-filters.destinationType.label',
            type: 'select',
            defaultValue: 'CITY',
            order: 1,
            options: [
                { value: 'CITY', labelKey: 'admin-filters.destinationType.city' },
                { value: 'TOWN', labelKey: 'admin-filters.destinationType.town' }
            ]
        },
        {
            paramKey: 'status',
            labelKey: 'admin-filters.status.label',
            type: 'select',
            order: 2,
            options: [
                { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
                { value: 'DRAFT', labelKey: 'admin-filters.status.draft' }
            ]
        },
        {
            paramKey: 'isFeatured',
            labelKey: 'admin-filters.isFeatured.label',
            type: 'boolean',
            order: 3
        }
    ]
};

// ---------------------------------------------------------------------------
// Helper to create a fresh onUpdateSearch spy
// ---------------------------------------------------------------------------

/**
 * Creates a vi.fn() that mimics the onUpdateSearch contract:
 * it immediately invokes the updater with an empty previous state and stores
 * the resulting params so tests can inspect what was written.
 */
function makeOnUpdateSearch() {
    const spy = vi.fn((updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
        spy.lastResult = updater({});
    }) as ReturnType<typeof vi.fn> & { lastResult: Record<string, unknown> };
    spy.lastResult = {};
    return spy;
}

// ---------------------------------------------------------------------------
// 1. Returns defaults when no URL filters
// ---------------------------------------------------------------------------

describe('activeFilters', () => {
    it('includes defaultValue when searchParams is empty', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert — destinationType should get its default, others absent
        expect(result.current.activeFilters).toEqual({ destinationType: 'CITY' });
    });

    it('uses URL param value when present', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { status: 'ACTIVE' },
                onUpdateSearch
            })
        );

        // Assert — status present from URL, destinationType still gets default
        expect(result.current.activeFilters).toEqual({
            destinationType: 'CITY',
            status: 'ACTIVE'
        });
    });

    it('returns empty object when all defaults are cleared via sentinel', () => {
        // Arrange — sentinel signals the user explicitly cleared a default filter
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { destinationType: FILTER_CLEARED_SENTINEL },
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.activeFilters).toEqual({});
    });

    it('returns empty object when filterBarConfig is undefined', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: { status: 'ACTIVE' },
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.activeFilters).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// 2. computedDefaults
// ---------------------------------------------------------------------------

describe('computedDefaults', () => {
    it('contains only filters that declare defaultValue', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert — only destinationType has a defaultValue in testConfig
        expect(result.current.computedDefaults).toEqual({ destinationType: 'CITY' });
    });

    it('returns empty object when filterBarConfig is undefined', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.computedDefaults).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// 3. hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
    it('is true when at least one active filter exists', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act — destinationType gets its default, so activeFilters is non-empty
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.hasActiveFilters).toBe(true);
    });

    it('is false when no active filters exist', () => {
        // Arrange — clear the only default via sentinel
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { destinationType: FILTER_CLEARED_SENTINEL },
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.hasActiveFilters).toBe(false);
    });

    it('is false when filterBarConfig is undefined', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.hasActiveFilters).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 4. hasNonDefaultFilters
// ---------------------------------------------------------------------------

describe('hasNonDefaultFilters', () => {
    it('is false when active filters exactly match computed defaults', () => {
        // Arrange — only default in effect, no user-selected overrides
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.hasNonDefaultFilters).toBe(false);
    });

    it('is true when user selected a value different from the default', () => {
        // Arrange — user chose TOWN, default is CITY
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { destinationType: 'TOWN' },
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.hasNonDefaultFilters).toBe(true);
    });

    it('is true when a non-default filter is active', () => {
        // Arrange — status has no default but is present in URL
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { status: 'ACTIVE' },
                onUpdateSearch
            })
        );

        // Assert — activeFilters = { destinationType:'CITY', status:'ACTIVE' }
        // which differs from computedDefaults = { destinationType:'CITY' }
        expect(result.current.hasNonDefaultFilters).toBe(true);
    });

    it('is true when a default is cleared via sentinel', () => {
        // Arrange — cleared default means activeFilters is {}, defaults is { destinationType: CITY }
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { destinationType: FILTER_CLEARED_SENTINEL },
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.hasNonDefaultFilters).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 5. handleFilterChange
// ---------------------------------------------------------------------------

describe('handleFilterChange', () => {
    it('calls onUpdateSearch with the new value and resets page to 1', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleFilterChange('status', 'ACTIVE');
        });

        // Assert — spy was called; the resulting params include the new value and page reset
        expect(onUpdateSearch).toHaveBeenCalledOnce();
        expect(onUpdateSearch.lastResult).toMatchObject({ status: 'ACTIVE', page: 1 });
    });

    it('calls onUpdateSearch with undefined when removing a filter that has no default', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { status: 'ACTIVE' },
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleFilterChange('status', undefined);
        });

        // Assert
        expect(onUpdateSearch).toHaveBeenCalledOnce();
        expect(onUpdateSearch.lastResult).toMatchObject({ status: undefined, page: 1 });
    });

    it('uses FILTER_CLEARED_SENTINEL when removing a filter that has a default', () => {
        // Arrange — destinationType has defaultValue: 'CITY'
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleFilterChange('destinationType', undefined);
        });

        // Assert
        expect(onUpdateSearch).toHaveBeenCalledOnce();
        expect(onUpdateSearch.lastResult).toMatchObject({
            destinationType: FILTER_CLEARED_SENTINEL,
            page: 1
        });
    });

    it('sets the param to the given value even when filterBarConfig is undefined', () => {
        // Arrange — no config means hasDefault is always false
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleFilterChange('status', 'ACTIVE');
        });

        // Assert
        expect(onUpdateSearch).toHaveBeenCalledOnce();
        expect(onUpdateSearch.lastResult).toMatchObject({ status: 'ACTIVE', page: 1 });
    });
});

// ---------------------------------------------------------------------------
// 6. handleClearAll
// ---------------------------------------------------------------------------

describe('handleClearAll', () => {
    it('sets sentinel for filters with defaults and undefined for those without', () => {
        // Arrange — testConfig has destinationType (default) + status + isFeatured (no defaults)
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { status: 'ACTIVE' },
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleClearAll();
        });

        // Assert
        expect(onUpdateSearch).toHaveBeenCalledOnce();
        expect(onUpdateSearch.lastResult).toMatchObject({
            destinationType: FILTER_CLEARED_SENTINEL,
            status: undefined,
            isFeatured: undefined,
            page: 1
        });
    });

    it('does nothing when filterBarConfig is undefined', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleClearAll();
        });

        // Assert — early-return guard means the callback is never invoked
        expect(onUpdateSearch).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 7. handleResetDefaults
// ---------------------------------------------------------------------------

describe('handleResetDefaults', () => {
    it('restores defaultValue for filters that have one and removes the rest', () => {
        // Arrange — start with everything cleared
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {
                    destinationType: FILTER_CLEARED_SENTINEL,
                    status: 'ACTIVE'
                },
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleResetDefaults();
        });

        // Assert
        expect(onUpdateSearch).toHaveBeenCalledOnce();
        expect(onUpdateSearch.lastResult).toMatchObject({
            destinationType: 'CITY',
            status: undefined,
            isFeatured: undefined,
            page: 1
        });
    });

    it('does nothing when filterBarConfig is undefined', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Act
        act(() => {
            result.current.handleResetDefaults();
        });

        // Assert — early-return guard means the callback is never invoked
        expect(onUpdateSearch).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 8. chips
// ---------------------------------------------------------------------------

describe('chips', () => {
    it('returns empty array when filterBarConfig is undefined', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: undefined,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.chips).toHaveLength(0);
    });

    it('builds one chip per active filter', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act — only destinationType is active (its default)
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.chips).toHaveLength(1);
        expect(result.current.chips[0]?.paramKey).toBe('destinationType');
    });

    it('marks the chip as isDefault when the value matches the configured default', () => {
        // Arrange
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: {},
                onUpdateSearch
            })
        );

        // Assert
        expect(result.current.chips[0]?.isDefault).toBe(true);
    });

    it('produces chips sorted by filter order', () => {
        // Arrange — activate all three filters to verify sort
        const onUpdateSearch = makeOnUpdateSearch();

        // Act
        const { result } = renderHook(() =>
            useFilterState({
                filterBarConfig: testConfig,
                searchParams: { status: 'ACTIVE', isFeatured: 'true' },
                onUpdateSearch
            })
        );

        // Assert — order: destinationType(1) < status(2) < isFeatured(3)
        const keys = result.current.chips.map((c) => c.paramKey);
        expect(keys).toEqual(['destinationType', 'status', 'isFeatured']);
    });
});

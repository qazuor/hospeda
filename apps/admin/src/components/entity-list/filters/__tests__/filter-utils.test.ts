/**
 * Tests for filter-utils.ts
 *
 * Covers:
 * - extractActiveFilters: URL param parsing with defaults and sentinel clearing
 * - computeDefaultFilters: default value extraction from config
 * - filtersEqual: shallow equality comparison
 * - buildFilterChips: chip data construction, ordering, and isDefault flag
 * - buildFilterParamUpdate: param update generation (set / sentinel / remove)
 */

import { describe, expect, it } from 'vitest';
import type { FilterBarConfig, FilterControlConfig } from '../filter-types';
import {
    FILTER_CLEARED_SENTINEL,
    buildFilterChips,
    buildFilterParamUpdate,
    computeDefaultFilters,
    extractActiveFilters,
    filtersEqual
} from '../filter-utils';

// ---------------------------------------------------------------------------
// Shared helpers / fixtures
// ---------------------------------------------------------------------------

/** Identity translation function — returns the key unchanged */
const t = (key: string): string => key;

/** Minimal FilterBarConfig with no defaults */
const minimalConfig: FilterBarConfig = {
    filters: [
        {
            paramKey: 'status',
            labelKey: 'filters.status',
            type: 'select',
            options: [
                { value: 'ACTIVE', labelKey: 'status.active' },
                { value: 'INACTIVE', labelKey: 'status.inactive' }
            ]
        }
    ]
};

/** Config that includes a filter with a defaultValue */
const configWithDefault: FilterBarConfig = {
    filters: [
        {
            paramKey: 'destinationType',
            labelKey: 'filters.destinationType',
            type: 'select',
            defaultValue: 'CITY',
            options: [
                { value: 'CITY', labelKey: 'destinationType.city' },
                { value: 'TOWN', labelKey: 'destinationType.town' }
            ]
        }
    ]
};

/** Config with multiple filters, one with default */
const multiFilterConfig: FilterBarConfig = {
    filters: [
        {
            paramKey: 'status',
            labelKey: 'filters.status',
            type: 'select',
            options: [{ value: 'ACTIVE', labelKey: 'status.active' }]
        },
        {
            paramKey: 'isFeatured',
            labelKey: 'filters.isFeatured',
            type: 'boolean'
        },
        {
            paramKey: 'destinationType',
            labelKey: 'filters.destinationType',
            type: 'select',
            defaultValue: 'CITY',
            options: [{ value: 'CITY', labelKey: 'destinationType.city' }]
        }
    ]
};

// ---------------------------------------------------------------------------
// extractActiveFilters
// ---------------------------------------------------------------------------

describe('extractActiveFilters', () => {
    it('returns {} when there are no URL params and no config defaults', () => {
        // Arrange
        const searchParams = {};

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: minimalConfig
        });

        // Assert
        expect(result).toEqual({});
    });

    it('applies defaultValue when URL param is absent', () => {
        // Arrange
        const searchParams = {};

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: configWithDefault
        });

        // Assert
        expect(result).toEqual({ destinationType: 'CITY' });
    });

    it('uses URL param value when it overrides the default', () => {
        // Arrange
        const searchParams = { destinationType: 'TOWN' };

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: configWithDefault
        });

        // Assert
        expect(result).toEqual({ destinationType: 'TOWN' });
    });

    it('skips a filter when the sentinel clears its default', () => {
        // Arrange
        const searchParams = { destinationType: FILTER_CLEARED_SENTINEL };

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: configWithDefault
        });

        // Assert
        expect(result).toEqual({});
    });

    it('ignores params that are not declared in filterBarConfig', () => {
        // Arrange
        const searchParams = { unknownParam: 'foo', anotherRogue: 'bar' };

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: minimalConfig
        });

        // Assert
        expect(result).toEqual({});
    });

    it('handles multiple filters and returns all active ones', () => {
        // Arrange
        const searchParams = { status: 'ACTIVE', isFeatured: 'true' };

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: multiFilterConfig
        });

        // Assert
        expect(result).toEqual({ status: 'ACTIVE', isFeatured: 'true', destinationType: 'CITY' });
    });

    it('applies defaultValue when URL param is null', () => {
        // Arrange — null triggers the same "no value" branch as undefined
        const searchParams = { destinationType: null };

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: configWithDefault
        });

        // Assert
        expect(result).toEqual({ destinationType: 'CITY' });
    });

    it('applies defaultValue when URL param is an empty string', () => {
        // Arrange — empty string triggers the same "no value" branch
        const searchParams = { destinationType: '' };

        // Act
        const result = extractActiveFilters({
            searchParams,
            filterBarConfig: configWithDefault
        });

        // Assert
        expect(result).toEqual({ destinationType: 'CITY' });
    });
});

// ---------------------------------------------------------------------------
// computeDefaultFilters
// ---------------------------------------------------------------------------

describe('computeDefaultFilters', () => {
    it('returns {} when filterBarConfig is undefined', () => {
        // Act
        const result = computeDefaultFilters({ filterBarConfig: undefined });

        // Assert
        expect(result).toEqual({});
    });

    it('returns only filters that declare a defaultValue', () => {
        // Arrange — multiFilterConfig has 3 filters, only destinationType has a default
        // Act
        const result = computeDefaultFilters({ filterBarConfig: multiFilterConfig });

        // Assert
        expect(result).toEqual({ destinationType: 'CITY' });
        expect(Object.keys(result)).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// filtersEqual
// ---------------------------------------------------------------------------

describe('filtersEqual', () => {
    it('returns true when both objects have identical key-value pairs', () => {
        // Arrange
        const a = { status: 'ACTIVE', destinationType: 'CITY' };
        const b = { status: 'ACTIVE', destinationType: 'CITY' };

        // Act + Assert
        expect(filtersEqual(a, b)).toBe(true);
    });

    it('returns false when a value differs', () => {
        // Arrange
        const a = { status: 'ACTIVE' };
        const b = { status: 'INACTIVE' };

        // Act + Assert
        expect(filtersEqual(a, b)).toBe(false);
    });

    it('returns false when key sets differ', () => {
        // Arrange
        const a = { status: 'ACTIVE' };
        const b = { destinationType: 'CITY' };

        // Act + Assert
        expect(filtersEqual(a, b)).toBe(false);
    });

    it('returns true when both objects are empty', () => {
        // Act + Assert
        expect(filtersEqual({}, {})).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// buildFilterChips
// ---------------------------------------------------------------------------

describe('buildFilterChips', () => {
    const chipConfig: FilterBarConfig = {
        filters: [
            {
                paramKey: 'destinationType',
                labelKey: 'filters.destinationType',
                type: 'select',
                defaultValue: 'CITY',
                order: 2,
                options: [
                    { value: 'CITY', labelKey: 'destinationType.city' },
                    { value: 'TOWN', labelKey: 'destinationType.town' }
                ]
            },
            {
                paramKey: 'status',
                labelKey: 'filters.status',
                type: 'select',
                order: 1,
                options: [{ value: 'ACTIVE', labelKey: 'status.active' }]
            },
            {
                paramKey: 'isFeatured',
                labelKey: 'filters.isFeatured',
                type: 'boolean',
                order: 3
            }
        ]
    };

    const defaultFilters = { destinationType: 'CITY' };

    it('marks chips originating from a default value with isDefault: true', () => {
        // Arrange
        const activeFilters = { destinationType: 'CITY' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        expect(chips).toHaveLength(1);
        expect(chips[0]?.isDefault).toBe(true);
        expect(chips[0]?.paramKey).toBe('destinationType');
    });

    it('marks chips applied by the user (non-default value) with isDefault: false', () => {
        // Arrange — user picked TOWN, while default is CITY
        const activeFilters = { destinationType: 'TOWN' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        expect(chips).toHaveLength(1);
        expect(chips[0]?.isDefault).toBe(false);
    });

    it('sorts chips ascending by their filter order field', () => {
        // Arrange — status(order=1), destinationType(order=2), isFeatured(order=3)
        const activeFilters = { isFeatured: 'true', destinationType: 'CITY', status: 'ACTIVE' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        const keys = chips.map((c) => c.paramKey);
        expect(keys).toEqual(['status', 'destinationType', 'isFeatured']);
    });

    it('sorts correctly when filters have no order defined (defaults to 0)', () => {
        // Arrange — neither filter declares an order, so both default to 0 via ??
        const noOrderConfig: FilterBarConfig = {
            filters: [
                {
                    paramKey: 'alpha',
                    labelKey: 'filters.alpha',
                    type: 'select',
                    options: [{ value: 'A', labelKey: 'alpha.a' }]
                },
                {
                    paramKey: 'beta',
                    labelKey: 'filters.beta',
                    type: 'select',
                    options: [{ value: 'B', labelKey: 'beta.b' }]
                }
            ]
        };
        const activeFilters = { alpha: 'A', beta: 'B' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: noOrderConfig,
            defaultFilters: {},
            t
        });

        // Assert — both have order 0, result should contain both chips
        expect(chips).toHaveLength(2);
    });

    it('silently skips active filters whose paramKey is not in filterBarConfig', () => {
        // Arrange — 'ghost' param is not in chipConfig
        const activeFilters = { ghost: 'value', status: 'ACTIVE' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        expect(chips).toHaveLength(1);
        expect(chips[0]?.paramKey).toBe('status');
    });

    it('translates select option labelKey via t function', () => {
        // Arrange
        const activeFilters = { status: 'ACTIVE' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert — t is identity so displayValue equals the labelKey
        expect(chips[0]?.displayValue).toBe('status.active');
    });

    it('falls back to raw value for select when option is not found', () => {
        // Arrange — 'UNKNOWN' is not in the options list
        const activeFilters = { status: 'UNKNOWN' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        expect(chips[0]?.displayValue).toBe('UNKNOWN');
    });

    it('produces correct displayValue for boolean true via t function', () => {
        // Arrange
        const activeFilters = { isFeatured: 'true' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        expect(chips[0]?.displayValue).toBe('admin-filters.booleanYes');
    });

    it('produces correct displayValue for boolean false via t function', () => {
        // Arrange
        const activeFilters = { isFeatured: 'false' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: chipConfig,
            defaultFilters,
            t
        });

        // Assert
        expect(chips[0]?.displayValue).toBe('admin-filters.booleanNo');
    });

    it('uses raw value as displayValue for unknown filter types (else branch)', () => {
        // Arrange — cast to bypass TypeScript's union type so we can hit the else branch
        const unknownTypeConfig: FilterBarConfig = {
            filters: [
                {
                    paramKey: 'custom',
                    labelKey: 'filters.custom',
                    type: 'unknown-type',
                    order: 1
                } as unknown as FilterControlConfig
            ]
        };
        const activeFilters = { custom: 'raw-value' };

        // Act
        const chips = buildFilterChips({
            activeFilters,
            filterBarConfig: unknownTypeConfig,
            defaultFilters: {},
            t
        });

        // Assert
        expect(chips[0]?.displayValue).toBe('raw-value');
    });

    // GAP-054-035: Select fallback to raw value when option not found
    it('falls back to raw value when select option value is not found in config', () => {
        // Arrange
        const selectConfig: FilterBarConfig = {
            filters: [
                {
                    paramKey: 'status',
                    labelKey: 'filters.status',
                    type: 'select',
                    options: [{ value: 'ACTIVE', labelKey: 'status.active' }],
                    order: 1
                }
            ]
        };

        // Act — 'UNKNOWN_VALUE' is not in the options array
        const chips = buildFilterChips({
            activeFilters: { status: 'UNKNOWN_VALUE' },
            filterBarConfig: selectConfig,
            defaultFilters: {},
            t
        });

        // Assert — raw value used as displayValue
        expect(chips[0]?.displayValue).toBe('UNKNOWN_VALUE');
    });
});

// ---------------------------------------------------------------------------
// buildFilterParamUpdate
// ---------------------------------------------------------------------------

describe('buildFilterParamUpdate', () => {
    it('returns the paramKey mapped to value when value is provided', () => {
        // Act
        const result = buildFilterParamUpdate({
            paramKey: 'status',
            value: 'ACTIVE',
            hasDefault: false
        });

        // Assert
        expect(result).toEqual({ status: 'ACTIVE' });
    });

    it('returns paramKey mapped to sentinel when value is undefined and filter has a default', () => {
        // Act
        const result = buildFilterParamUpdate({
            paramKey: 'destinationType',
            value: undefined,
            hasDefault: true
        });

        // Assert
        expect(result).toEqual({ destinationType: FILTER_CLEARED_SENTINEL });
    });

    it('returns paramKey mapped to undefined when value is undefined and filter has no default', () => {
        // Act
        const result = buildFilterParamUpdate({
            paramKey: 'status',
            value: undefined,
            hasDefault: false
        });

        // Assert
        expect(result).toEqual({ status: undefined });
    });
});

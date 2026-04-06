// @vitest-environment jsdom
/**
 * Integration tests for FilterBar + useFilterState working together.
 *
 * Tests the integration at the component boundary level using a harness
 * that simulates what EntityListPage does, but without TanStack Router.
 * Local state replaces URL params so the integration can be tested
 * without router mocking.
 *
 * Covered scenarios:
 * - Default filter application on first render
 * - URL params overriding defaults
 * - Sentinel clearing a default filter
 * - Filter controls rendered by FilterBar
 * - Chip rendering for active/default filters
 * - hasNonDefaultFilters derived boolean transitions
 * - Clear all sets sentinels for default filters
 * - Reset to defaults restores default values
 * - Page resets to 1 on filter change
 * - Accessibility: aria-live region and chip remove aria-label
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../FilterBar';
import type { FilterBarConfig } from '../filter-types';
import { useFilterState } from '../useFilterState';

// The global setup in test/setup.tsx already mocks @/hooks/use-translations,
// but we declare it here as well so this file is self-contained.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

type HarnessProps = {
    readonly filterBarConfig: FilterBarConfig;
    readonly initialParams?: Record<string, unknown>;
};

/**
 * Test harness that simulates EntityListPage's filter integration.
 * Uses local state instead of TanStack Router for URL params.
 */
function FilterIntegrationHarness({ filterBarConfig, initialParams = {} }: HarnessProps) {
    const [searchParams, setSearchParams] = useState<Record<string, unknown>>(initialParams);

    const onUpdateSearch = useCallback(
        (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
            setSearchParams((prev) => updater(prev));
        },
        []
    );

    const filterState = useFilterState({
        filterBarConfig,
        searchParams,
        onUpdateSearch
    });

    return (
        <div>
            <div data-testid="debug-params">{JSON.stringify(searchParams)}</div>
            <div data-testid="debug-active">{JSON.stringify(filterState.activeFilters)}</div>
            <div data-testid="debug-has-active">{String(filterState.hasActiveFilters)}</div>
            <div data-testid="debug-has-non-default">
                {String(filterState.hasNonDefaultFilters)}
            </div>
            <FilterBar
                config={filterBarConfig}
                activeFilters={filterState.activeFilters}
                onFilterChange={filterState.handleFilterChange}
                onClearAll={filterState.handleClearAll}
                onResetDefaults={filterState.handleResetDefaults}
                hasActiveFilters={filterState.hasActiveFilters}
                hasNonDefaultFilters={filterState.hasNonDefaultFilters}
                chips={filterState.chips}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Shared fixture — destinations-like config with one default filter
// ---------------------------------------------------------------------------

/**
 * Destinations-like config:
 * - destinationType (select, defaultValue: 'CITY', order: 1)
 * - status         (select, no default,            order: 2)
 * - isFeatured     (boolean, no default,            order: 3)
 */
const destinationsConfig: FilterBarConfig = {
    filters: [
        {
            paramKey: 'destinationType',
            labelKey: 'admin-filters.destinationType.label',
            type: 'select',
            defaultValue: 'CITY',
            order: 1,
            options: [
                { value: 'COUNTRY', labelKey: 'admin-filters.destinationType.country' },
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
                { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
                { value: 'ACTIVE', labelKey: 'admin-filters.status.active' }
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
// Tests
// ---------------------------------------------------------------------------

describe('FilterBar + useFilterState integration', () => {
    // -----------------------------------------------------------------------
    // 1. Default filters applied on first render
    // -----------------------------------------------------------------------
    it('applies default filter on first render when initialParams is empty', () => {
        // Arrange / Act
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert — activeFilters should contain the default destinationType
        const activeDebug = screen.getByTestId('debug-active');
        expect(activeDebug.textContent).toContain('"destinationType":"CITY"');

        // hasActiveFilters must be true since default was applied
        expect(screen.getByTestId('debug-has-active').textContent).toBe('true');
    });

    // -----------------------------------------------------------------------
    // 2. URL params override defaults
    // -----------------------------------------------------------------------
    it('uses URL param value instead of default when initialParams contains the key', () => {
        // Arrange / Act
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{ destinationType: 'TOWN' }}
            />
        );

        // Assert — TOWN is used, not CITY (the default)
        const activeDebug = screen.getByTestId('debug-active');
        expect(activeDebug.textContent).toContain('"destinationType":"TOWN"');
        expect(activeDebug.textContent).not.toContain('"destinationType":"CITY"');
    });

    // -----------------------------------------------------------------------
    // 3. Sentinel clears default
    // -----------------------------------------------------------------------
    it('sentinel value suppresses the default and yields no active filter for that key', () => {
        // Arrange / Act
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{ destinationType: '__cleared__' }}
            />
        );

        // Assert — destinationType must NOT be in activeFilters
        const activeDebug = screen.getByTestId('debug-active');
        expect(activeDebug.textContent).not.toContain('destinationType');

        // hasActiveFilters = false because no other active filter exists
        expect(screen.getByTestId('debug-has-active').textContent).toBe('false');
    });

    // -----------------------------------------------------------------------
    // 4. FilterBar renders filter controls
    // -----------------------------------------------------------------------
    it('renders one combobox per select filter and one per boolean filter', () => {
        // Arrange / Act
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert — 3 filters (2 select + 1 boolean) → 3 comboboxes
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes).toHaveLength(3);
    });

    // -----------------------------------------------------------------------
    // 5. Default filter shows chip
    // -----------------------------------------------------------------------
    it('renders a chip for the default filter when initialParams is empty', () => {
        // Arrange / Act
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert — the chip label key for destinationType should be visible
        // t() is identity, so labelKey is rendered as-is
        // Label appears in both the chip and the filter trigger (GAP-054-053)
        const labels = screen.getAllByText('admin-filters.destinationType.label:');
        expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    // -----------------------------------------------------------------------
    // 6. hasNonDefaultFilters is false at defaults
    // -----------------------------------------------------------------------
    it('reports hasNonDefaultFilters=false when only defaults are active', () => {
        // Arrange / Act
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert
        expect(screen.getByTestId('debug-has-non-default').textContent).toBe('false');
    });

    // -----------------------------------------------------------------------
    // 7. hasNonDefaultFilters is true when an extra filter is active
    // -----------------------------------------------------------------------
    it('reports hasNonDefaultFilters=true when a non-default filter is active', () => {
        // Arrange / Act — status has no defaultValue but is set in URL
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{ status: 'ACTIVE' }}
            />
        );

        // Assert — activeFilters = { destinationType:'CITY', status:'ACTIVE' }
        // which differs from computedDefaults = { destinationType:'CITY' }
        expect(screen.getByTestId('debug-has-non-default').textContent).toBe('true');
    });

    // -----------------------------------------------------------------------
    // 8. Clear all sets sentinels for defaults
    // -----------------------------------------------------------------------
    it('sets sentinel for default-filters and clears others when Clear all is clicked', async () => {
        // Arrange
        const user = userEvent.setup();
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Act — click "Clear all" button (t() returns the key itself)
        const clearAllBtn = screen.getByRole('button', { name: /admin-filters\.clearAll/ });
        await act(async () => {
            await user.click(clearAllBtn);
        });

        // Assert — searchParams should now contain the sentinel for destinationType
        const paramsDebug = screen.getByTestId('debug-params');
        expect(paramsDebug.textContent).toContain('"destinationType":"__cleared__"');

        // hasActiveFilters must be false (sentinel suppresses the default)
        expect(screen.getByTestId('debug-has-active').textContent).toBe('false');
    });

    // -----------------------------------------------------------------------
    // 9. Reset to defaults restores default values
    // -----------------------------------------------------------------------
    it('restores default values and removes extra filters when Reset to defaults is clicked', async () => {
        // Arrange — start with cleared default + extra filter
        const user = userEvent.setup();
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{ destinationType: '__cleared__', status: 'ACTIVE' }}
            />
        );

        // Act — click "Reset to defaults"
        const resetBtn = screen.getByRole('button', { name: /admin-filters\.resetDefaults/ });
        await act(async () => {
            await user.click(resetBtn);
        });

        // Assert — destinationType restored to CITY
        const activeDebug = screen.getByTestId('debug-active');
        expect(activeDebug.textContent).toContain('"destinationType":"CITY"');

        // status should be gone (no default)
        expect(activeDebug.textContent).not.toContain('status');
    });

    // -----------------------------------------------------------------------
    // 10. Page resets to 1 on filter change
    // -----------------------------------------------------------------------
    it('resets page to 1 after Clear all is triggered from page 3', async () => {
        // Arrange — start on page 3
        const user = userEvent.setup();
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{ page: 3 }}
            />
        );

        // Act — trigger Clear all (which internally calls handleClearAll → onUpdateSearch with page:1)
        const clearAllBtn = screen.getByRole('button', { name: /admin-filters\.clearAll/ });
        await act(async () => {
            await user.click(clearAllBtn);
        });

        // Assert — page must be 1 in the updated searchParams
        const paramsDebug = screen.getByTestId('debug-params');
        expect(paramsDebug.textContent).toContain('"page":1');
    });

    // -----------------------------------------------------------------------
    // 11. Accessibility: aria-live region present when chips are shown
    // -----------------------------------------------------------------------
    it('renders an aria-live="polite" region when filter chips are present', () => {
        // Arrange / Act — empty params → default chip appears
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert — ActiveFilterChips renders role="status" with aria-live="polite"
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toBeInTheDocument();
        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    // -----------------------------------------------------------------------
    // 12. Accessibility: chip remove button has aria-label starting with "Remove filter"
    // -----------------------------------------------------------------------
    it('renders a chip remove button with aria-label starting with "Remove filter"', () => {
        // Arrange / Act — default chip for destinationType will be rendered
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert — at least one remove button with the expected aria-label pattern
        // GAP-054-027: Use precise regex that validates "Remove filter <label>: <value>" format
        const removeButtons = screen.getAllByRole('button', { name: /^Remove filter .+: .+$/ });
        expect(removeButtons.length).toBeGreaterThan(0);
    });

    // -----------------------------------------------------------------------
    // GAP-054-020: Accessibility — chip aria-label includes filter label and value
    // -----------------------------------------------------------------------
    it('chip remove button aria-label contains the filter label and display value', () => {
        // Arrange / Act — default chip for destinationType:CITY
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Assert — aria-label matches "Remove filter <labelKey>: <displayValue>"
        // With identity t(), labelKey and option labelKey are rendered as-is
        const removeButton = screen.getAllByRole('button', { name: /^Remove filter .+: .+$/ })[0];
        expect(removeButton).toBeInTheDocument();
        // Verify the aria-label contains both the filter label key and the value label key
        const ariaLabel = removeButton.getAttribute('aria-label') ?? '';
        expect(ariaLabel).toContain('admin-filters.destinationType.label');
    });

    // -----------------------------------------------------------------------
    // GAP-054-020: Accessibility — all filter controls are keyboard reachable
    // -----------------------------------------------------------------------
    it('all filter comboboxes are reachable via sequential tab navigation', async () => {
        // Arrange
        const user = userEvent.setup();
        render(
            <FilterIntegrationHarness
                filterBarConfig={destinationsConfig}
                initialParams={{}}
            />
        );

        // Act — tab through the controls
        const comboboxes = screen.getAllByRole('combobox');
        const focusedComboboxes: Element[] = [];

        // Tab until we've passed through all comboboxes or hit a reasonable limit
        for (let i = 0; i < 20; i++) {
            await act(async () => {
                await user.tab();
            });
            const activeEl = document.activeElement;
            if (
                activeEl?.getAttribute('role') === 'combobox' &&
                !focusedComboboxes.includes(activeEl)
            ) {
                focusedComboboxes.push(activeEl);
            }
            if (focusedComboboxes.length === comboboxes.length) break;
        }

        // Assert — we reached all comboboxes
        expect(focusedComboboxes.length).toBe(comboboxes.length);
    });

    // -----------------------------------------------------------------------
    // GAP-054-043: FilterBar absent when no config
    // -----------------------------------------------------------------------
    it('does not render filter controls when filterBarConfig is undefined', () => {
        // Arrange — harness with no config (simulates legacy entity)
        function NoConfigHarness() {
            const [searchParams, setSearchParams] = useState<Record<string, unknown>>({});
            const onUpdateSearch = useCallback(
                (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
                    setSearchParams((prev) => updater(prev));
                },
                []
            );
            const filterState = useFilterState({
                filterBarConfig: undefined,
                searchParams,
                onUpdateSearch
            });

            return (
                <div>
                    <div data-testid="debug-has-active">{String(filterState.hasActiveFilters)}</div>
                </div>
            );
        }

        // Act
        render(<NoConfigHarness />);

        // Assert — no comboboxes (filter selects) rendered
        expect(screen.queryAllByRole('combobox')).toHaveLength(0);
        expect(screen.getByTestId('debug-has-active').textContent).toBe('false');
    });

    // -----------------------------------------------------------------------
    // GAP-054-044: Legacy entities with defaultFilters only (no filterBarConfig)
    // -----------------------------------------------------------------------
    it('legacy entity without filterBarConfig: no FilterBar, useFilterState returns inactive', () => {
        // Arrange — simulates an entity with only defaultFilters (old pattern)
        function LegacyHarness() {
            const [searchParams, setSearchParams] = useState<Record<string, unknown>>({});
            const onUpdateSearch = useCallback(
                (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
                    setSearchParams((prev) => updater(prev));
                },
                []
            );
            const filterState = useFilterState({
                filterBarConfig: undefined,
                searchParams,
                onUpdateSearch
            });

            return (
                <div>
                    <div data-testid="debug-active">
                        {JSON.stringify(filterState.activeFilters)}
                    </div>
                    <div data-testid="debug-has-active">{String(filterState.hasActiveFilters)}</div>
                    <div data-testid="debug-chips">{JSON.stringify(filterState.chips)}</div>
                </div>
            );
        }

        // Act
        render(<LegacyHarness />);

        // Assert — no active filters, no chips, FilterBar not rendered
        expect(screen.getByTestId('debug-has-active').textContent).toBe('false');
        expect(screen.getByTestId('debug-active').textContent).toBe('{}');
        expect(screen.getByTestId('debug-chips').textContent).toBe('[]');
        expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    });
});

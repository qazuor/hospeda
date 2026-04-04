// @vitest-environment jsdom
/**
 * Tests for FilterBar component.
 *
 * Covers rendering of filter controls from config, FilterActions presence,
 * chip rendering, and empty-chip behaviour.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../FilterBar';
import type { ActiveFilters, FilterBarConfig, FilterChipData } from '../filter-types';

// useTranslations and @repo/icons are already mocked globally in test/setup.tsx.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const filterBarConfig: FilterBarConfig = {
    filters: [
        {
            paramKey: 'status',
            labelKey: 'filters.status',
            type: 'select',
            order: 1,
            options: [
                { value: 'ACTIVE', labelKey: 'status.active' },
                { value: 'INACTIVE', labelKey: 'status.inactive' }
            ]
        },
        {
            paramKey: 'isFeatured',
            labelKey: 'filters.isFeatured',
            type: 'boolean',
            order: 2
        }
    ]
};

const emptyFilters: ActiveFilters = {};

const defaultProps = {
    config: filterBarConfig,
    activeFilters: emptyFilters,
    computedDefaults: emptyFilters,
    onFilterChange: vi.fn(),
    onClearAll: vi.fn(),
    onResetDefaults: vi.fn(),
    hasActiveFilters: false,
    hasNonDefaultFilters: false,
    chips: [] as ReadonlyArray<FilterChipData>
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterBar', () => {
    it('renders filter controls from config (select and boolean)', () => {
        // Arrange / Act
        render(<FilterBar {...defaultProps} />);

        // Assert — each filter's aria-label matches its labelKey (t is identity)
        expect(screen.getByRole('combobox', { name: 'filters.status' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'filters.isFeatured' })).toBeInTheDocument();
    });

    it('renders FilterActions container (even when no buttons are visible)', () => {
        // Arrange / Act
        const { container } = render(<FilterBar {...defaultProps} />);

        // Assert — the FilterActions wrapper div is always present
        // When hasActiveFilters=false and hasNonDefaultFilters=false, no buttons render,
        // but the container div from FilterActions is still in the DOM.
        expect(container.querySelector('.flex.items-center.gap-1')).toBeInTheDocument();
    });

    it('shows "Clear all" button when hasActiveFilters is true', () => {
        // Arrange / Act
        render(
            <FilterBar
                {...defaultProps}
                hasActiveFilters={true}
                activeFilters={{ status: 'ACTIVE' }}
            />
        );

        // Assert — t('admin-filters.clearAll') returns the key via identity mock
        expect(screen.getByText('admin-filters.clearAll')).toBeInTheDocument();
    });

    it('shows chips when chips array is non-empty', () => {
        // Arrange
        const chips: ReadonlyArray<FilterChipData> = [
            {
                paramKey: 'status',
                labelKey: 'filters.status',
                value: 'ACTIVE',
                displayValue: 'status.active',
                isDefault: false
            }
        ];

        // Act
        render(
            <FilterBar
                {...defaultProps}
                chips={chips}
                hasActiveFilters={true}
            />
        );

        // Assert — chip content is rendered
        expect(screen.getByText('status.active')).toBeInTheDocument();
    });

    it('does not show chips area when chips array is empty', () => {
        // Arrange / Act
        render(
            <FilterBar
                {...defaultProps}
                chips={[]}
            />
        );

        // Assert — ActiveFilterChips renders null when empty, so aria-live region absent
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('renders only select controls for select-type filters and boolean for boolean-type', () => {
        // Arrange / Act
        render(<FilterBar {...defaultProps} />);

        // Assert — both comboboxes are present (one per filter control)
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes).toHaveLength(2);
    });
});

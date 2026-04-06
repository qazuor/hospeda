// @vitest-environment jsdom
/**
 * Tests for FilterBar component.
 *
 * Covers rendering of filter controls from config, FilterActions presence,
 * chip rendering, and empty-chip behaviour.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../FilterBar';
import type {
    ActiveFilters,
    FilterBarConfig,
    FilterChipData,
    FilterControlConfig
} from '../filter-types';

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
        expect(container.querySelector('[data-filter-actions]')).toBeInTheDocument();
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

    // GAP-054-040: Skips unknown filter types without crashing
    it('silently skips unknown filter types without crashing', () => {
        // Arrange — inject an unknown filter type via cast
        const configWithUnknown: FilterBarConfig = {
            filters: [
                ...filterBarConfig.filters,
                {
                    paramKey: 'custom',
                    labelKey: 'filters.custom',
                    type: 'relation',
                    order: 3
                } as unknown as FilterControlConfig
            ]
        };

        // Act — should not throw
        render(
            <FilterBar
                {...defaultProps}
                config={configWithUnknown}
            />
        );

        // Assert — known filters render, unknown is skipped
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes).toHaveLength(2);
    });

    // GAP-054-041: Chip click calls onFilterChange
    it('calls onFilterChange when a chip remove button is clicked', async () => {
        // Arrange
        const onFilterChange = vi.fn();
        const chips: ReadonlyArray<FilterChipData> = [
            {
                paramKey: 'status',
                labelKey: 'filters.status',
                value: 'ACTIVE',
                displayValue: 'status.active',
                isDefault: false
            }
        ];

        render(
            <FilterBar
                {...defaultProps}
                onFilterChange={onFilterChange}
                chips={chips}
                hasActiveFilters={true}
            />
        );

        // Act — click the chip's remove button
        const removeButton = screen.getByRole('button', { name: /^Remove filter/ });
        await userEvent.click(removeButton);

        // Assert
        expect(onFilterChange).toHaveBeenCalledWith('status', undefined);
    });

    // GAP-054-042: "Reset to defaults" visibility
    it('shows "Reset to defaults" when hasNonDefaultFilters is true', () => {
        // Arrange / Act
        render(
            <FilterBar
                {...defaultProps}
                hasActiveFilters={true}
                hasNonDefaultFilters={true}
                activeFilters={{ status: 'ACTIVE' }}
            />
        );

        // Assert
        expect(screen.getByText('admin-filters.resetDefaults')).toBeInTheDocument();
    });

    // GAP-054-042 complement: hidden when false
    it('hides "Reset to defaults" when hasNonDefaultFilters is false', () => {
        // Arrange / Act
        render(
            <FilterBar
                {...defaultProps}
                hasActiveFilters={true}
                hasNonDefaultFilters={false}
            />
        );

        // Assert
        expect(screen.queryByText('admin-filters.resetDefaults')).not.toBeInTheDocument();
    });

    // GAP-054-047: Default chip shows "(default)" badge
    it('renders "(default)" badge on chips with isDefault true', () => {
        // Arrange
        const chips: ReadonlyArray<FilterChipData> = [
            {
                paramKey: 'destinationType',
                labelKey: 'filters.destinationType',
                value: 'CITY',
                displayValue: 'destinationType.city',
                isDefault: true
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

        // Assert — t('admin-filters.defaultBadge') returns key via identity mock
        expect(screen.getByText('(admin-filters.defaultBadge)')).toBeInTheDocument();
    });

    // GAP-054-047: Sort order respected
    it('renders filters in order defined by config order field', () => {
        // Arrange — reverse the order values
        const reversedConfig: FilterBarConfig = {
            filters: [
                {
                    paramKey: 'status',
                    labelKey: 'filters.status',
                    type: 'select',
                    order: 2,
                    options: [{ value: 'ACTIVE', labelKey: 'status.active' }]
                },
                {
                    paramKey: 'isFeatured',
                    labelKey: 'filters.isFeatured',
                    type: 'boolean',
                    order: 1
                }
            ]
        };

        // Act
        render(
            <FilterBar
                {...defaultProps}
                config={reversedConfig}
            />
        );

        // Assert — comboboxes should render in order: isFeatured (1) then status (2)
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes).toHaveLength(2);
        // First combobox should be isFeatured (order 1), second should be status (order 2)
        expect(comboboxes[0]).toHaveAttribute('aria-label', 'filters.isFeatured');
        expect(comboboxes[1]).toHaveAttribute(
            'aria-label',
            expect.stringContaining('filters.status')
        );
    });
});

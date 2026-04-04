// @vitest-environment jsdom
/**
 * Tests for FilterSelect component.
 *
 * Covers rendering, aria-label, "All" option presence, and config options rendering.
 * Radix Select does not open in jsdom, so interaction tests are skipped in favour
 * of structural/render assertions.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from '../FilterSelect';
import type { FilterControlConfig } from '../filter-types';

// useTranslations is already mocked globally in test/setup.tsx.
// Re-declared here for documentation clarity only.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const statusConfig: FilterControlConfig = {
    paramKey: 'status',
    labelKey: 'filters.status',
    type: 'select',
    options: [
        { value: 'ACTIVE', labelKey: 'status.active' },
        { value: 'INACTIVE', labelKey: 'status.inactive' }
    ]
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterSelect', () => {
    it('renders without crashing with valid config', () => {
        // Arrange / Act
        const { container } = render(
            <FilterSelect
                config={statusConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — component mounts and produces DOM output
        expect(container.firstChild).not.toBeNull();
    });

    it('renders with the correct aria-label derived from config.labelKey', () => {
        // Arrange / Act
        render(
            <FilterSelect
                config={statusConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — t() is identity so aria-label equals the labelKey
        expect(screen.getByRole('combobox', { name: 'filters.status' })).toBeInTheDocument();
    });

    it('renders the "All" option in the content', () => {
        // Arrange / Act
        render(
            <FilterSelect
                config={statusConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — default allLabelKey resolves to 'admin-filters.allOption' via t()
        expect(screen.getByText('admin-filters.allOption')).toBeInTheDocument();
    });

    it('renders without crashing when config has multiple options', () => {
        // Arrange — config with multiple options
        const multiOptionConfig: FilterControlConfig = {
            paramKey: 'status',
            labelKey: 'filters.status',
            type: 'select',
            options: [
                { value: 'ACTIVE', labelKey: 'status.active' },
                { value: 'INACTIVE', labelKey: 'status.inactive' },
                { value: 'DRAFT', labelKey: 'status.draft' }
            ]
        };

        // Act — Radix Select does not render SelectContent to the DOM when closed in jsdom.
        // We verify only that the component mounts without error and has the right structure.
        const { container } = render(
            <FilterSelect
                config={multiOptionConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — trigger is present; options are in the portal (not accessible while closed)
        expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
    });

    it('uses custom allLabelKey when provided in config', () => {
        // Arrange
        const configWithCustomAll: FilterControlConfig = {
            ...statusConfig,
            allLabelKey: 'filters.showAll'
        };

        // Act
        render(
            <FilterSelect
                config={configWithCustomAll}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByText('filters.showAll')).toBeInTheDocument();
    });

    it('applies active border class when a value is set', () => {
        // Arrange / Act
        render(
            <FilterSelect
                config={statusConfig}
                value="ACTIVE"
                onChange={vi.fn()}
            />
        );

        // Assert — trigger button has the active class when value is defined
        const trigger = screen.getByRole('combobox', { name: 'filters.status' });
        expect(trigger.className).toContain('border-primary');
    });

    it('applies dashed border class when no value is set', () => {
        // Arrange / Act
        render(
            <FilterSelect
                config={statusConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — trigger button has the inactive dashed class when no value
        const trigger = screen.getByRole('combobox', { name: 'filters.status' });
        expect(trigger.className).toContain('border-dashed');
    });
});

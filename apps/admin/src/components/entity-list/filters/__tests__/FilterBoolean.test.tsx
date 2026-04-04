// @vitest-environment jsdom
/**
 * Tests for FilterBoolean component.
 *
 * Covers rendering, aria-label, and presence of Yes/No/All options.
 * Radix Select does not open in jsdom, so interaction tests are skipped in favour
 * of structural/render assertions.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterBoolean } from '../FilterBoolean';
import type { FilterControlConfig } from '../filter-types';

// useTranslations is already mocked globally in test/setup.tsx.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const isFeaturedConfig: FilterControlConfig = {
    paramKey: 'isFeatured',
    labelKey: 'filters.isFeatured',
    type: 'boolean'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterBoolean', () => {
    it('renders without crashing with valid config', () => {
        // Arrange / Act
        const { container } = render(
            <FilterBoolean
                config={isFeaturedConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(container.firstChild).not.toBeNull();
    });

    it('renders with the correct aria-label derived from config.labelKey', () => {
        // Arrange / Act
        render(
            <FilterBoolean
                config={isFeaturedConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — t() is identity so aria-label equals the labelKey
        expect(screen.getByRole('combobox', { name: 'filters.isFeatured' })).toBeInTheDocument();
    });

    it('renders the "All" option', () => {
        // Arrange / Act
        render(
            <FilterBoolean
                config={isFeaturedConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByText('admin-filters.allOption')).toBeInTheDocument();
    });

    it('renders a combobox trigger (Yes/No/All options are in the hidden portal when closed)', () => {
        // Arrange / Act
        // Radix Select does not render SelectContent to the DOM when the dropdown is closed
        // in jsdom. We verify the trigger is present and the component does not crash.
        const { container } = render(
            <FilterBoolean
                config={isFeaturedConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — trigger combobox is rendered
        expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
    });

    it('renders with value "true" without crashing (Yes option is selected)', () => {
        // Arrange / Act
        const { container } = render(
            <FilterBoolean
                config={isFeaturedConfig}
                value="true"
                onChange={vi.fn()}
            />
        );

        // Assert — combobox is rendered and shows the current selection placeholder
        expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
    });

    it('applies active border class when a value is set', () => {
        // Arrange / Act
        render(
            <FilterBoolean
                config={isFeaturedConfig}
                value="true"
                onChange={vi.fn()}
            />
        );

        // Assert — trigger button has active class when value is defined
        const trigger = screen.getByRole('combobox', { name: 'filters.isFeatured' });
        expect(trigger.className).toContain('border-primary');
    });

    it('applies dashed border class when no value is set', () => {
        // Arrange / Act
        render(
            <FilterBoolean
                config={isFeaturedConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — trigger button has inactive dashed class
        const trigger = screen.getByRole('combobox', { name: 'filters.isFeatured' });
        expect(trigger.className).toContain('border-dashed');
    });
});

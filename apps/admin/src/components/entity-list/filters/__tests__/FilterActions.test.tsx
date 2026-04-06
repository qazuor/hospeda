// @vitest-environment jsdom
/**
 * Tests for FilterActions component (GAP-054-062).
 *
 * Covers visibility and click behavior for "Clear all" and "Reset to defaults" buttons.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterActions } from '../FilterActions';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

describe('FilterActions', () => {
    it('shows "Clear all" button when hasActiveFilters is true', () => {
        // Arrange / Act
        render(
            <FilterActions
                hasActiveFilters={true}
                hasNonDefaultFilters={false}
                onClearAll={vi.fn()}
                onResetDefaults={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByText('admin-filters.clearAll')).toBeInTheDocument();
    });

    it('hides "Clear all" button when hasActiveFilters is false', () => {
        // Arrange / Act
        render(
            <FilterActions
                hasActiveFilters={false}
                hasNonDefaultFilters={false}
                onClearAll={vi.fn()}
                onResetDefaults={vi.fn()}
            />
        );

        // Assert
        expect(screen.queryByText('admin-filters.clearAll')).not.toBeInTheDocument();
    });

    it('shows "Reset to defaults" when hasNonDefaultFilters is true', () => {
        // Arrange / Act
        render(
            <FilterActions
                hasActiveFilters={true}
                hasNonDefaultFilters={true}
                onClearAll={vi.fn()}
                onResetDefaults={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByText('admin-filters.resetDefaults')).toBeInTheDocument();
    });

    it('hides "Reset to defaults" when hasNonDefaultFilters is false', () => {
        // Arrange / Act
        render(
            <FilterActions
                hasActiveFilters={true}
                hasNonDefaultFilters={false}
                onClearAll={vi.fn()}
                onResetDefaults={vi.fn()}
            />
        );

        // Assert
        expect(screen.queryByText('admin-filters.resetDefaults')).not.toBeInTheDocument();
    });

    it('calls onClearAll when "Clear all" is clicked', async () => {
        // Arrange
        const onClearAll = vi.fn();
        render(
            <FilterActions
                hasActiveFilters={true}
                hasNonDefaultFilters={false}
                onClearAll={onClearAll}
                onResetDefaults={vi.fn()}
            />
        );

        // Act
        await userEvent.click(screen.getByText('admin-filters.clearAll'));

        // Assert
        expect(onClearAll).toHaveBeenCalledOnce();
    });

    it('calls onResetDefaults when "Reset to defaults" is clicked', async () => {
        // Arrange
        const onResetDefaults = vi.fn();
        render(
            <FilterActions
                hasActiveFilters={true}
                hasNonDefaultFilters={true}
                onClearAll={vi.fn()}
                onResetDefaults={onResetDefaults}
            />
        );

        // Act
        await userEvent.click(screen.getByText('admin-filters.resetDefaults'));

        // Assert
        expect(onResetDefaults).toHaveBeenCalledOnce();
    });
});

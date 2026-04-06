// @vitest-environment jsdom
/**
 * Tests for FilterChip component.
 *
 * Covers rendering label/value, default badge annotation, and remove interactions.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip } from '../FilterChip';
import type { FilterChipData } from '../filter-types';

// useTranslations and @repo/icons are already mocked globally in test/setup.tsx.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const userChip: FilterChipData = {
    paramKey: 'status',
    labelKey: 'filters.status',
    value: 'ACTIVE',
    displayValue: 'status.active',
    isDefault: false
};

const defaultChip: FilterChipData = {
    paramKey: 'destinationType',
    labelKey: 'filters.destinationType',
    value: 'CITY',
    displayValue: 'destinationType.city',
    isDefault: true
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterChip', () => {
    it('renders label and display value text', () => {
        // Arrange / Act
        render(
            <FilterChip
                chip={userChip}
                onRemove={vi.fn()}
            />
        );

        // Assert — t() is identity, so text equals the labelKey and displayValue
        expect(screen.getByText('filters.status:')).toBeInTheDocument();
        expect(screen.getByText('status.active')).toBeInTheDocument();
    });

    it('shows "(default)" annotation when chip.isDefault is true', () => {
        // Arrange / Act
        render(
            <FilterChip
                chip={defaultChip}
                onRemove={vi.fn()}
            />
        );

        // Assert — t('admin-filters.defaultBadge') returns the key via identity mock
        expect(screen.getByText('(admin-filters.defaultBadge)')).toBeInTheDocument();
    });

    it('does NOT show "(default)" annotation when chip.isDefault is false', () => {
        // Arrange / Act
        render(
            <FilterChip
                chip={userChip}
                onRemove={vi.fn()}
            />
        );

        // Assert
        expect(screen.queryByText('(admin-filters.defaultBadge)')).not.toBeInTheDocument();
    });

    it('calls onRemove when the X button is clicked', async () => {
        // Arrange
        const onRemove = vi.fn();
        render(
            <FilterChip
                chip={userChip}
                onRemove={onRemove}
            />
        );

        // Act
        const button = screen.getByRole('button', { name: /remove filter/i });
        await userEvent.click(button);

        // Assert
        expect(onRemove).toHaveBeenCalledOnce();
    });

    it('calls onRemove when Enter key is pressed on the X button', async () => {
        // Arrange
        const onRemove = vi.fn();
        render(
            <FilterChip
                chip={userChip}
                onRemove={onRemove}
            />
        );

        // Act — use tab to reach the button (GAP-054-066)
        await userEvent.tab();
        await userEvent.keyboard('{Enter}');

        // Assert
        expect(onRemove).toHaveBeenCalledOnce();
    });

    // GAP-054-039: Regression test for Space key after handleKeyDown removal
    it('calls onRemove when Space key is pressed on the X button', async () => {
        // Arrange
        const onRemove = vi.fn();
        render(
            <FilterChip
                chip={userChip}
                onRemove={onRemove}
            />
        );

        // Act — native button fires click on Space keyup
        const button = screen.getByRole('button', { name: /remove filter/i });
        button.focus();
        await userEvent.keyboard(' ');

        // Assert — should fire exactly once (no double-fire)
        expect(onRemove).toHaveBeenCalledOnce();
    });
});

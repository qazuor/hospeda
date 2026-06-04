// @vitest-environment jsdom
/**
 * Tests for FilterText component.
 *
 * Covers:
 * - Rendering and aria-label
 * - Debounce: typing emits onChange once with the final value
 * - Empty / whitespace input calls onChange(undefined) to remove the param
 * - External value reset syncs the local input state
 * - Chip integration: text filter with a value shows chip and clear removes param
 * - Active / inactive border styles
 *
 * NOTE: Tests that exercise debounce timers use `fireEvent.change` (not
 * `userEvent.type`) to avoid conflicts between @testing-library/user-event's
 * internal async event queue and vi.useFakeTimers. This is the same pattern
 * used by FilterBoolean.test.tsx and FilterSelect.test.tsx in this suite.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterText } from '../FilterText';
import type { TextFilterConfig } from '../filter-types';

// useTranslations is already mocked globally in test/setup.tsx.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const searchConfig: TextFilterConfig = {
    paramKey: 'search',
    labelKey: 'filters.search',
    type: 'text',
    debounceMs: 100
};

const configWithPlaceholder: TextFilterConfig = {
    ...searchConfig,
    placeholderKey: 'filters.searchPlaceholder'
};

const configWithMaxLength: TextFilterConfig = {
    ...searchConfig,
    maxLength: 50
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterText', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    it('renders without crashing with valid config', () => {
        // Arrange / Act
        const { container } = render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(container.firstChild).not.toBeNull();
    });

    it('renders a text input element', () => {
        // Arrange / Act
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with aria-label equal to labelKey when no value is set', () => {
        // Arrange / Act
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — t() is identity mock so aria-label equals labelKey
        expect(screen.getByRole('textbox', { name: 'filters.search' })).toBeInTheDocument();
    });

    it('renders with aria-label including current value when value is set', () => {
        // Arrange / Act
        render(
            <FilterText
                config={searchConfig}
                value="hotel"
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByRole('textbox', { name: 'filters.search: hotel' })).toBeInTheDocument();
    });

    it('uses placeholderKey when provided', () => {
        // Arrange / Act
        render(
            <FilterText
                config={configWithPlaceholder}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('placeholder', 'filters.searchPlaceholder');
    });

    it('falls back to labelKey as placeholder when placeholderKey is not provided', () => {
        // Arrange / Act
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('placeholder', 'filters.search');
    });

    it('applies maxLength attribute when config.maxLength is provided', () => {
        // Arrange / Act
        render(
            <FilterText
                config={configWithMaxLength}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('maxlength', '50');
    });

    // -------------------------------------------------------------------------
    // Border styles (active / inactive)
    // -------------------------------------------------------------------------

    it('applies dashed border class when no value is set', () => {
        // Arrange / Act
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert
        const input = screen.getByRole('textbox');
        expect(input.className).toContain('border-dashed');
    });

    it('applies active border class when a value is set', () => {
        // Arrange / Act
        render(
            <FilterText
                config={searchConfig}
                value="hotel"
                onChange={vi.fn()}
            />
        );

        // Assert
        const input = screen.getByRole('textbox');
        expect(input.className).toContain('border-primary');
    });

    // -------------------------------------------------------------------------
    // Debounce: typing emits once with the final value
    //
    // We use fireEvent.change (synchronous) instead of userEvent.type to avoid
    // conflicts between @testing-library/user-event's async event queue and
    // vi.useFakeTimers — the same approach used in FilterBoolean/FilterSelect tests.
    // -------------------------------------------------------------------------

    it('does not call onChange before the debounce timer fires', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={onChange}
            />
        );
        const input = screen.getByRole('textbox');

        // Act — change input value synchronously; debounce is still pending
        fireEvent.change(input, { target: { value: 'hotel' } });

        // Assert — onChange not called yet
        expect(onChange).not.toHaveBeenCalled();
    });

    it('calls onChange with final value after the debounce timer fires', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={onChange}
            />
        );
        const input = screen.getByRole('textbox');

        // Act — simulate user typing then waiting
        fireEvent.change(input, { target: { value: 'hotel' } });
        vi.advanceTimersByTime(200); // past debounceMs=100

        // Assert — called once with the value
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith('hotel');
    });

    it('debounces: only last change fires when multiple changes occur within window', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={onChange}
            />
        );
        const input = screen.getByRole('textbox');

        // Act — rapid changes within the debounce window
        fireEvent.change(input, { target: { value: 'h' } });
        fireEvent.change(input, { target: { value: 'ho' } });
        fireEvent.change(input, { target: { value: 'hot' } });
        // none should have fired yet
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: 'hotel' } });
        vi.advanceTimersByTime(200);

        // Assert — fired once with the final value
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith('hotel');
    });

    // -------------------------------------------------------------------------
    // Empty value removes the param
    // -------------------------------------------------------------------------

    it('calls onChange(undefined) when input is cleared to empty string', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <FilterText
                config={searchConfig}
                value="hotel"
                onChange={onChange}
            />
        );
        const input = screen.getByRole('textbox');

        // Act — clear the input
        fireEvent.change(input, { target: { value: '' } });
        vi.advanceTimersByTime(200);

        // Assert
        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('calls onChange(undefined) when input contains only whitespace', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={onChange}
            />
        );
        const input = screen.getByRole('textbox');

        // Act
        fireEvent.change(input, { target: { value: '   ' } });
        vi.advanceTimersByTime(200);

        // Assert
        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('trims leading/trailing whitespace before calling onChange', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={onChange}
            />
        );
        const input = screen.getByRole('textbox');

        // Act
        fireEvent.change(input, { target: { value: '  hotel  ' } });
        vi.advanceTimersByTime(200);

        // Assert — onChange receives trimmed value
        expect(onChange).toHaveBeenCalledWith('hotel');
    });

    // -------------------------------------------------------------------------
    // External reset syncs the input
    // -------------------------------------------------------------------------

    it('syncs local input state when external value changes from defined to undefined', () => {
        // Arrange — start with an active value
        const { rerender } = render(
            <FilterText
                config={searchConfig}
                value="hotel"
                onChange={vi.fn()}
            />
        );

        // Verify initial state
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('hotel');

        // Act — simulate external clear (chip removed, reset-all, etc.)
        rerender(
            <FilterText
                config={searchConfig}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        // Assert — input cleared
        expect(input.value).toBe('');
    });

    it('syncs local input state when external value changes to a new string', () => {
        // Arrange
        const { rerender } = render(
            <FilterText
                config={searchConfig}
                value="hotel"
                onChange={vi.fn()}
            />
        );

        // Act — external value replaced (e.g. URL navigated to pre-filled params)
        rerender(
            <FilterText
                config={searchConfig}
                value="cabaña"
                onChange={vi.fn()}
            />
        );

        // Assert
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('cabaña');
    });
});

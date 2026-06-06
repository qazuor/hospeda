/**
 * WindowToggle tests — SPEC-197 T-012.
 *
 * `useTranslations` is mocked globally in test/setup.tsx as `t: (key) => key`,
 * so button text assertions match on the raw i18n key strings.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WindowToggle } from '../WindowToggle';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('WindowToggle', () => {
    it('marks the 30d button as active when value is "30d" and 7d as inactive', () => {
        // Arrange
        render(
            <WindowToggle
                value="30d"
                onChange={vi.fn()}
            />
        );

        // Act — read ARIA states
        const btn7d = screen.getByText('common.window.7d');
        const btn30d = screen.getByText('common.window.30d');

        // Assert
        expect(btn30d).toHaveAttribute('aria-pressed', 'true');
        expect(btn30d).toHaveAttribute('data-state', 'on');
        expect(btn7d).toHaveAttribute('aria-pressed', 'false');
        expect(btn7d).toHaveAttribute('data-state', 'off');
    });

    it('calls onChange with "7d" when the 7d button is clicked', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <WindowToggle
                value="30d"
                onChange={onChange}
            />
        );

        // Act
        fireEvent.click(screen.getByText('common.window.7d'));

        // Assert
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith('7d');
    });

    it('does NOT call onChange when disabled and either button is clicked', () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <WindowToggle
                value="7d"
                onChange={onChange}
                disabled={true}
            />
        );

        // Act — both buttons should be inert
        const btn7d = screen.getByText('common.window.7d');
        const btn30d = screen.getByText('common.window.30d');
        fireEvent.click(btn7d);
        fireEvent.click(btn30d);

        // Assert
        expect(onChange).not.toHaveBeenCalled();
        expect(btn7d).toBeDisabled();
        expect(btn30d).toBeDisabled();
    });

    it('has the correct role and aria-label on the wrapper', () => {
        // Arrange + Act
        render(
            <WindowToggle
                value="7d"
                onChange={vi.fn()}
            />
        );

        // Assert — t(key) === key in test environment
        const group = screen.getByRole('group', { name: 'common.window.ariaLabel' });
        expect(group).toBeInTheDocument();
    });
});

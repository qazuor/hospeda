/**
 * Test suite for SignOutButton component.
 * Covers rendering, sign-out flow, error handling, and styling.
 *
 * @module sign-out-button.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignOutButton } from '../src/sign-out-button';
import type { SignOutButtonProps } from '../src/sign-out-button';

// Mock authLogger to avoid console noise and allow assertion
vi.mock('../src/logger', () => ({
    authLogger: {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock window.location
const locationMock = { replace: vi.fn(), href: '', pathname: '/' };
Object.defineProperty(window, 'location', { value: locationMock, writable: true });

/**
 * Creates default props for SignOutButton
 */
const createProps = (overrides?: Partial<SignOutButtonProps>): SignOutButtonProps => ({
    isAuthenticated: true,
    onSignOut: vi.fn().mockResolvedValue(undefined),
    ...overrides
});

describe('SignOutButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationMock.href = '';
        locationMock.pathname = '/';
    });

    it('returns null when isAuthenticated is false', () => {
        // Arrange & Act
        const { container } = render(
            <SignOutButton {...createProps({ isAuthenticated: false })} />
        );

        // Assert
        expect(container.innerHTML).toBe('');
    });

    it('renders button when isAuthenticated is true', () => {
        // Arrange & Act
        render(<SignOutButton {...createProps()} />);

        // Assert
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('displays "Cerrar sesion" as button text', () => {
        // Arrange & Act
        render(<SignOutButton {...createProps()} />);

        // Assert
        expect(screen.getByRole('button')).toHaveTextContent('Cerrar sesion');
    });

    it('calls onSignOut when clicked', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSignOut = vi.fn().mockResolvedValue(undefined);
        render(<SignOutButton {...createProps({ onSignOut })} />);

        // Act
        await user.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(onSignOut).toHaveBeenCalledTimes(1);
        });
    });

    it('calls onComplete after onSignOut resolves', async () => {
        // Arrange
        const user = userEvent.setup();
        const onComplete = vi.fn();
        const onSignOut = vi.fn().mockResolvedValue(undefined);
        render(<SignOutButton {...createProps({ onSignOut, onComplete })} />);

        // Act
        await user.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(onSignOut).toHaveBeenCalledTimes(1);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });
    });

    it('navigates to redirectTo via window.location.href after sign out', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSignOut = vi.fn().mockResolvedValue(undefined);
        render(<SignOutButton {...createProps({ onSignOut, redirectTo: '/home' })} />);

        // Act
        await user.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(locationMock.href).toBe('/home');
        });
    });

    it('does not navigate when redirectTo is not provided', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSignOut = vi.fn().mockResolvedValue(undefined);
        render(<SignOutButton {...createProps({ onSignOut })} />);

        // Act
        await user.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(onSignOut).toHaveBeenCalledTimes(1);
        });
        expect(locationMock.href).toBe('');
    });

    it('handles onSignOut error gracefully without crashing', async () => {
        // Arrange
        const user = userEvent.setup();
        const { authLogger } = await import('../src/logger');
        const error = new Error('Sign out failed');
        const onSignOut = vi.fn().mockRejectedValue(error);
        render(<SignOutButton {...createProps({ onSignOut })} />);

        // Act
        await user.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(authLogger.error).toHaveBeenCalledWith('Sign out error', error);
        });
        // Component should still be rendered (no crash)
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('accepts className and applies it to the button', () => {
        // Arrange & Act
        render(<SignOutButton {...createProps({ className: 'custom-class' })} />);

        // Assert
        expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('default style includes red background class', () => {
        // Arrange & Act
        render(<SignOutButton {...createProps()} />);

        // Assert
        expect(screen.getByRole('button')).toHaveClass('bg-red-600');
    });
});

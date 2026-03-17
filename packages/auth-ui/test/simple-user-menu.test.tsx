/**
 * Test suite for SimpleUserMenu component.
 * Covers loading state, unauthenticated state, authenticated state, sign-out, and error handling.
 *
 * @module simple-user-menu.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleUserMenu } from '../src/simple-user-menu';
import type { SimpleUserMenuProps } from '../src/simple-user-menu';
import type { AuthSession, SessionUser } from '../src/types';

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
const locationMock: { replace: ReturnType<typeof vi.fn>; href: string; pathname: string } = {
    replace: vi.fn(),
    href: '',
    pathname: '/'
};
Object.defineProperty(window, 'location', { value: locationMock, writable: true });

/**
 * Creates a mock SessionUser
 */
const createUser = (overrides?: Partial<SessionUser>): SessionUser => ({
    id: 'user-1',
    name: 'Maria Lopez',
    email: 'maria@example.com',
    image: null,
    ...overrides
});

/**
 * Creates a mock AuthSession
 */
const createSession = (userOverrides?: Partial<SessionUser>): AuthSession => ({
    user: createUser(userOverrides)
});

/**
 * Creates default props for SimpleUserMenu
 */
const createProps = (overrides?: Partial<SimpleUserMenuProps>): SimpleUserMenuProps => ({
    session: createSession(),
    onSignOut: vi.fn().mockResolvedValue(undefined),
    ...overrides
});

describe('SimpleUserMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationMock.href = '';
        locationMock.pathname = '/';
    });

    describe('loading state', () => {
        it('shows loading skeleton when isPending is true', () => {
            // Arrange & Act
            const { container } = render(<SimpleUserMenu {...createProps({ isPending: true })} />);

            // Assert
            const pulsingElements = container.querySelectorAll('.animate-pulse');
            expect(pulsingElements.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('unauthenticated state', () => {
        it('shows sign-in and sign-up links when session is null', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps({ session: null })} />);

            // Assert
            expect(screen.getByText('Iniciar sesion')).toBeInTheDocument();
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
        });

        it('sign-up button has gradient background', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps({ session: null })} />);

            // Assert
            const signUpLink = screen.getByText('Registrarse');
            expect(signUpLink).toHaveClass('bg-gradient-to-r');
        });

        it('sign-in URL has trailing slash', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps({ session: null })} />);

            // Assert
            const signInLink = screen.getByText('Iniciar sesion').closest('a');
            expect(signInLink).toHaveAttribute('href', '/auth/signin/');
        });

        it('sign-up URL has trailing slash', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps({ session: null })} />);

            // Assert
            const signUpLink = screen.getByText('Registrarse').closest('a');
            expect(signUpLink).toHaveAttribute('href', '/auth/signup/');
        });
    });

    describe('authenticated state', () => {
        it('shows user name when authenticated', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps()} />);

            // Assert
            expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
        });

        it('shows user email when authenticated', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps()} />);

            // Assert
            expect(screen.getByText('maria@example.com')).toBeInTheDocument();
        });

        it('uses session.user.image for avatar when available', () => {
            // Arrange
            const session = createSession({ image: 'https://example.com/avatar.jpg' });

            // Act
            render(<SimpleUserMenu {...createProps({ session })} />);

            // Assert
            const img = screen.getByAltText('Maria Lopez');
            expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
        });

        it('shows gradient+initial avatar when no image', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps()} />);

            // Assert - initial of "Maria Lopez" is "M"
            const initial = screen.getByText('M');
            expect(initial).toBeInTheDocument();
            // The parent div should have gradient class
            const avatarDiv = initial.closest('div');
            expect(avatarDiv).toHaveClass('bg-gradient-to-r');
        });

        it('falls back to email for displayName and initial when name is empty', () => {
            // Arrange - user with no name, only email
            const session = createSession({ name: '', email: 'test@example.com', image: null });

            // Act
            render(<SimpleUserMenu {...createProps({ session })} />);

            // Assert - displayName = email, so email appears twice (displayName + email line)
            const emailElements = screen.getAllByText('test@example.com');
            expect(emailElements.length).toBe(2);
            // initial should be "T" from email
            expect(screen.getByText('T')).toBeInTheDocument();
        });

        it('falls back to "User" and "U" when both name and email are empty', () => {
            // Arrange - user with no name and no email
            const session = createSession({ name: '', email: '', image: null });

            // Act
            render(<SimpleUserMenu {...createProps({ session })} />);

            // Assert - displayName should be "User", initial should be "U"
            expect(screen.getByText('User')).toBeInTheDocument();
            expect(screen.getByText('U')).toBeInTheDocument();
        });

        it('shows "Cerrar sesion" button when authenticated', () => {
            // Arrange & Act
            render(<SimpleUserMenu {...createProps()} />);

            // Assert
            expect(screen.getByText('Cerrar sesion')).toBeInTheDocument();
        });
    });

    describe('sign out', () => {
        it('calls onSignOut when "Cerrar sesion" is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSignOut = vi.fn().mockResolvedValue(undefined);
            render(<SimpleUserMenu {...createProps({ onSignOut })} />);

            // Act
            await user.click(screen.getByText('Cerrar sesion'));

            // Assert
            await waitFor(() => {
                expect(onSignOut).toHaveBeenCalledTimes(1);
            });
        });

        it('navigates to default redirectTo "/" after sign out', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSignOut = vi.fn().mockResolvedValue(undefined);
            render(<SimpleUserMenu {...createProps({ onSignOut })} />);

            // Act
            await user.click(screen.getByText('Cerrar sesion'));

            // Assert
            await waitFor(() => {
                expect(locationMock.href).toBe('/');
            });
        });

        it('navigates to custom redirectTo after sign out', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSignOut = vi.fn().mockResolvedValue(undefined);
            render(<SimpleUserMenu {...createProps({ onSignOut, redirectTo: '/goodbye' })} />);

            // Act
            await user.click(screen.getByText('Cerrar sesion'));

            // Assert
            await waitFor(() => {
                expect(locationMock.href).toBe('/goodbye');
            });
        });

        it('handles onSignOut error gracefully', async () => {
            // Arrange
            const user = userEvent.setup();
            const { authLogger } = await import('../src/logger');
            const error = new Error('Sign out failed');
            const onSignOut = vi.fn().mockRejectedValue(error);
            render(<SimpleUserMenu {...createProps({ onSignOut })} />);

            // Act
            await user.click(screen.getByText('Cerrar sesion'));

            // Assert
            await waitFor(() => {
                expect(authLogger.error).toHaveBeenCalledWith('Error during sign out', error);
            });
            // Component should still be rendered (no crash)
            expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
        });
    });
});

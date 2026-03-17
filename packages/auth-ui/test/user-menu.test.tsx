/**
 * Test suite for UserMenu component.
 * Covers rendering states, dropdown behavior, navigation, sign-out, and accessibility.
 *
 * @module user-menu.test
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession, SessionUser } from '../src/types';
import { UserMenu } from '../src/user-menu';
import type { UserMenuProps } from '../src/user-menu';

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

// Mock window.location with writable pathname
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
    name: 'Juan Perez',
    email: 'juan@example.com',
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
 * Creates default props for UserMenu
 */
const createProps = (overrides?: Partial<UserMenuProps>): UserMenuProps => ({
    session: createSession(),
    onSignOut: vi.fn().mockResolvedValue(undefined),
    ...overrides
});

describe('UserMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationMock.href = '';
        locationMock.pathname = '/';
    });

    describe('loading state', () => {
        it('shows loading skeleton when isPending is true', () => {
            // Arrange & Act
            const { container } = render(<UserMenu {...createProps({ isPending: true })} />);

            // Assert
            const pulsingElements = container.querySelectorAll('.animate-pulse');
            expect(pulsingElements.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('unauthenticated state', () => {
        it('returns null when session is null', () => {
            // Arrange & Act
            const { container } = render(<UserMenu {...createProps({ session: null })} />);

            // Assert
            expect(container.innerHTML).toBe('');
        });
    });

    describe('authenticated state', () => {
        it('shows avatar with initial when no image', () => {
            // Arrange & Act
            render(<UserMenu {...createProps()} />);

            // Assert - initial of "Juan Perez" is "J"
            expect(screen.getByText('J')).toBeInTheDocument();
        });

        it('shows user image when session.user.image exists', () => {
            // Arrange
            const session = createSession({ image: 'https://example.com/avatar.jpg' });

            // Act
            render(<UserMenu {...createProps({ session })} />);

            // Assert
            const img = screen.getByAltText('Juan Perez');
            expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
        });

        it('uses user.name as displayName', () => {
            // Arrange & Act
            render(<UserMenu {...createProps()} />);

            // Assert
            expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        });

        it('falls back to email when name is not available', () => {
            // Arrange
            const session = createSession({ name: null });

            // Act
            render(<UserMenu {...createProps({ session })} />);

            // Assert
            expect(screen.getByText('juan@example.com')).toBeInTheDocument();
        });

        it('falls back to "User" when neither name nor email available', () => {
            // Arrange
            const session: AuthSession = {
                user: { id: 'user-1', name: null, email: '' as unknown as string, image: null }
            };

            // Act
            render(<UserMenu {...createProps({ session })} />);

            // Assert - empty string is falsy, so displayName = 'User'
            expect(screen.getByText('User')).toBeInTheDocument();
        });
    });

    describe('dropdown behavior', () => {
        it('opens dropdown on avatar click', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<UserMenu {...createProps()} />);

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));

            // Assert
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
            expect(screen.getByText('Cerrar Sesion')).toBeInTheDocument();
        });

        it('closes dropdown on backdrop click', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<UserMenu {...createProps()} />);

            // Act - open dropdown
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));
            expect(screen.getByText('Dashboard')).toBeInTheDocument();

            // Act - click backdrop (the fixed overlay div with role="button")
            const backdrop = screen.getByLabelText('Close menu');
            await user.click(backdrop);

            // Assert
            expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
        });

        it('closes dropdown on Escape key', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<UserMenu {...createProps()} />);

            // Act - open dropdown
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));
            expect(screen.getByText('Dashboard')).toBeInTheDocument();

            // Act - press Escape on the backdrop (which has the keyDown handler)
            const backdrop = screen.getByLabelText('Close menu');
            fireEvent.keyDown(backdrop, { key: 'Escape' });

            // Assert
            expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
        });
    });

    describe('dropdown links', () => {
        it('has Dashboard link with default dashboardUrl', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<UserMenu {...createProps()} />);

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));

            // Assert
            const dashboardLink = screen.getByText('Dashboard').closest('a');
            expect(dashboardLink).toHaveAttribute('href', '/dashboard/');
        });

        it('has Mi Perfil link with default profileUrl', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<UserMenu {...createProps()} />);

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));

            // Assert
            const profileLink = screen.getByText('Mi Perfil').closest('a');
            expect(profileLink).toHaveAttribute('href', '/profile/');
        });

        it('uses custom dashboardUrl and profileUrl', async () => {
            // Arrange
            const user = userEvent.setup();
            render(
                <UserMenu
                    {...createProps({
                        dashboardUrl: '/custom-dashboard/',
                        profileUrl: '/custom-profile/'
                    })}
                />
            );

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));

            // Assert
            const dashboardLink = screen.getByText('Dashboard').closest('a');
            expect(dashboardLink).toHaveAttribute('href', '/custom-dashboard/');
            const profileLink = screen.getByText('Mi Perfil').closest('a');
            expect(profileLink).toHaveAttribute('href', '/custom-profile/');
        });
    });

    describe('sign out', () => {
        it('calls onSignOut when "Cerrar Sesion" is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            const onSignOut = vi.fn().mockResolvedValue(undefined);
            render(<UserMenu {...createProps({ onSignOut })} />);

            // Act - open dropdown
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));
            // Act - click sign out
            await user.click(screen.getByText('Cerrar Sesion'));

            // Assert
            await waitFor(() => {
                expect(onSignOut).toHaveBeenCalledTimes(1);
            });
        });

        it('navigates to "/" after sign out when not on /auth page', async () => {
            // Arrange
            const user = userEvent.setup();
            locationMock.pathname = '/dashboard/';
            const onSignOut = vi.fn().mockResolvedValue(undefined);
            render(<UserMenu {...createProps({ onSignOut })} />);

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));
            await user.click(screen.getByText('Cerrar Sesion'));

            // Assert
            await waitFor(() => {
                expect(locationMock.href).toBe('/');
            });
        });

        it('does NOT redirect after sign out when on /auth page', async () => {
            // Arrange
            const user = userEvent.setup();
            locationMock.pathname = '/auth/signin/';
            const onSignOut = vi.fn().mockResolvedValue(undefined);
            render(<UserMenu {...createProps({ onSignOut })} />);

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));
            await user.click(screen.getByText('Cerrar Sesion'));

            // Assert
            await waitFor(() => {
                expect(onSignOut).toHaveBeenCalledTimes(1);
            });
            expect(locationMock.href).toBe('');
        });

        it('handles sign out error gracefully', async () => {
            // Arrange
            const user = userEvent.setup();
            const { authLogger } = await import('../src/logger');
            const error = new Error('Sign out failed');
            const onSignOut = vi.fn().mockRejectedValue(error);
            render(<UserMenu {...createProps({ onSignOut })} />);

            // Act
            await user.click(screen.getByRole('button', { name: /Juan Perez/i }));
            await user.click(screen.getByText('Cerrar Sesion'));

            // Assert
            await waitFor(() => {
                expect(authLogger.error).toHaveBeenCalledWith('Sign out error', error);
            });
        });
    });

    describe('accessibility', () => {
        it('has aria-expanded=false when dropdown is closed', () => {
            // Arrange & Act
            render(<UserMenu {...createProps()} />);

            // Assert
            const trigger = screen.getByRole('button', { name: /Juan Perez/i });
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });

        it('has aria-expanded=true when dropdown is open', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<UserMenu {...createProps()} />);

            // Act
            const trigger = screen.getByRole('button', { name: /Juan Perez/i });
            await user.click(trigger);

            // Assert
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });

        it('has aria-haspopup="true" on trigger', () => {
            // Arrange & Act
            render(<UserMenu {...createProps()} />);

            // Assert
            const trigger = screen.getByRole('button', { name: /Juan Perez/i });
            expect(trigger).toHaveAttribute('aria-haspopup', 'true');
        });
    });
});

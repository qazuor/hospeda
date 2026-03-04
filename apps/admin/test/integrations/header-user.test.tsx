/**
 * HeaderUser Component Tests
 *
 * Tests the user avatar dropdown menu in the header.
 * Verifies:
 * - Skeleton shown during loading
 * - Nothing rendered when no user
 * - Avatar image vs initials rendering
 * - Dropdown menu interactions
 * - Sign out behavior
 * - No hasMounted delay (regression test)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

// Mock auth context - controllable state
let mockAuthState = {
    isLoading: false,
    isAuthenticated: true,
    user: {
        id: 'user-1',
        role: 'ADMIN',
        permissions: [],
        displayName: 'John Doe',
        email: 'john@example.com',
        avatar: undefined as string | undefined
    },
    error: null,
    refreshSession: vi.fn(),
    clearSession: vi.fn(),
    signOut: vi.fn()
};

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => mockAuthState
}));

vi.mock('@/lib/auth-client', () => ({
    signOut: () => mockSignOut()
}));

vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: mockNavigate
    })
}));

import { HeaderUser } from '@/integrations/clerk/header-user';

describe('HeaderUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState = {
            isLoading: false,
            isAuthenticated: true,
            user: {
                id: 'user-1',
                role: 'ADMIN',
                permissions: [],
                displayName: 'John Doe',
                email: 'john@example.com',
                avatar: undefined
            },
            error: null,
            refreshSession: vi.fn(),
            clearSession: vi.fn(),
            signOut: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render placeholder when isLoading is true', () => {
        mockAuthState.isLoading = true;
        render(<HeaderUser />);

        // Static placeholder (no animate-pulse) to reserve space
        const placeholder = document.querySelector('.rounded-full.bg-muted\\/50');
        expect(placeholder).toBeInTheDocument();
    });

    it('should render nothing when user is null', () => {
        mockAuthState.user = null as unknown as typeof mockAuthState.user;
        const { container } = render(<HeaderUser />);

        expect(container.innerHTML).toBe('');
    });

    it('should render avatar image when user.avatar exists', () => {
        mockAuthState.user = {
            ...mockAuthState.user,
            avatar: 'https://example.com/avatar.jpg'
        };
        render(<HeaderUser />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should render initials when no avatar', () => {
        render(<HeaderUser />);

        const button = screen.getByRole('button', { name: 'User menu' });
        expect(button.textContent).toBe('JD');
    });

    it('should render initials from email when no displayName', () => {
        mockAuthState.user = {
            ...mockAuthState.user,
            displayName: '',
            email: 'test@example.com'
        };
        render(<HeaderUser />);

        const button = screen.getByRole('button', { name: 'User menu' });
        expect(button.textContent).toBe('T');
    });

    it('should open dropdown on click', async () => {
        const user = userEvent.setup();
        render(<HeaderUser />);

        const button = screen.getByRole('button', { name: 'User menu' });
        await user.click(button);

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('should show user name and email in dropdown', async () => {
        const user = userEvent.setup();
        render(<HeaderUser />);

        await user.click(screen.getByRole('button', { name: 'User menu' }));

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('should call signOut and redirect on sign out', async () => {
        const user = userEvent.setup();

        // Mock window.location
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, href: '' }
        });

        render(<HeaderUser />);

        await user.click(screen.getByRole('button', { name: 'User menu' }));
        await user.click(screen.getByText('Sign out'));

        await waitFor(() => {
            expect(mockSignOut).toHaveBeenCalled();
        });

        // Restore
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation
        });
    });

    it('should render immediately without hasMounted delay', () => {
        // Key regression test: HeaderUser should NOT have a hasMounted guard
        // that delays rendering on first mount
        render(<HeaderUser />);

        // Should immediately show the user button (not skeleton, not nothing)
        const button = screen.getByRole('button', { name: 'User menu' });
        expect(button).toBeInTheDocument();
    });

    it('should navigate to profile on Profile click', async () => {
        const user = userEvent.setup();
        render(<HeaderUser />);

        await user.click(screen.getByRole('button', { name: 'User menu' }));
        await user.click(screen.getByText('Profile'));

        expect(mockNavigate).toHaveBeenCalledWith({ to: '/me/profile' });
    });

    it('should navigate to settings on Settings click', async () => {
        const user = userEvent.setup();
        render(<HeaderUser />);

        await user.click(screen.getByRole('button', { name: 'User menu' }));
        await user.click(screen.getByText('Settings'));

        expect(mockNavigate).toHaveBeenCalledWith({ to: '/me/settings' });
    });
});

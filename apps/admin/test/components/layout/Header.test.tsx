/**
 * Tests for Header Component
 *
 * Tests the main navigation header (Level 1):
 * 1. Renders navigation items
 * 2. Shows active state for current section
 * 3. Mobile menu toggle
 * 4. Right-side actions (notifications, profile, settings)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        children,
        className,
        ...props
    }: { to: string; children: ReactNode; className?: string }) => (
        <a
            href={to}
            className={className}
            {...props}
        >
            {children}
        </a>
    ),
    useRouter: () => ({
        subscribe: vi.fn(() => vi.fn())
    }),
    useLocation: () => ({ pathname: '/dashboard' })
}));

// Mock translations
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

// Mock sidebar context
const mockOpenMobile = vi.fn();
const mockCloseMobile = vi.fn();

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        openMobile: mockOpenMobile,
        closeMobile: mockCloseMobile,
        isMobileOpen: false
    })
}));

// Mock current section
vi.mock('@/lib/sections', () => ({
    useCurrentSectionId: () => 'dashboard'
}));

// Mock header nav items
vi.mock('@/config/sections', () => ({
    headerNavItems: [
        {
            id: 'dashboard',
            labelKey: 'admin-menu.dashboard',
            routes: ['/dashboard'],
            defaultRoute: '/dashboard'
        },
        {
            id: 'content',
            labelKey: 'admin-menu.content',
            routes: ['/accommodations'],
            defaultRoute: '/accommodations'
        },
        {
            id: 'administration',
            labelKey: 'admin-menu.administration',
            routes: ['/access'],
            defaultRoute: '/access/users'
        },
        {
            id: 'analytics',
            labelKey: 'admin-menu.analytics',
            routes: ['/analytics'],
            defaultRoute: '/analytics/usage'
        }
    ]
}));

// Mock icons - must include all icons used by Header and its children
vi.mock('@repo/icons', () => ({
    MenuIcon: () => <span data-testid="menu-icon">Menu</span>,
    SearchIcon: () => <span data-testid="search-icon">Search</span>,
    NotificationIcon: () => <span data-testid="notification-icon">Notification</span>,
    UserIcon: () => <span data-testid="user-icon">User</span>,
    SettingsIcon: () => <span data-testid="settings-icon">Settings</span>,
    CloseIcon: () => <span data-testid="close-icon">Close</span>,
    ChevronIcon: () => <span data-testid="chevron-icon">Chevron</span>,
    HomeIcon: () => <span data-testid="home-icon">Home</span>,
    DashboardIcon: () => <span data-testid="dashboard-icon">Dashboard</span>,
    DropdownIcon: () => <span data-testid="dropdown-icon">Dropdown</span>
}));

// Mock Clerk header
vi.mock('@/integrations/clerk/header-user', () => ({
    default: () => <div data-testid="clerk-header">Clerk</div>
}));

// Import after mocks
import { Header } from '@/components/layout/header/Header';

describe('Header', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render the header with navigation', () => {
            render(<Header />);

            expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
        });

        it('should render logo/brand link', () => {
            render(<Header />);

            const logoLink = screen.getByRole('link', { name: /admin-nav.topbar.admin/i });
            expect(logoLink).toHaveAttribute('href', '/dashboard');
        });

        it('should render all navigation items', () => {
            render(<Header />);

            // Use getAllByText because items appear both in desktop nav and mobile menu
            expect(screen.getAllByText('admin-menu.dashboard').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('admin-menu.content').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('admin-menu.administration').length).toBeGreaterThanOrEqual(
                1
            );
            expect(screen.getAllByText('admin-menu.analytics').length).toBeGreaterThanOrEqual(1);
        });

        it('should render right-side action buttons', () => {
            render(<Header />);

            expect(screen.getByTestId('notification-icon')).toBeInTheDocument();
            expect(screen.getByTestId('user-icon')).toBeInTheDocument();
            expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
        });

        it('should render Clerk user menu', () => {
            render(<Header />);

            expect(screen.getByTestId('clerk-header')).toBeInTheDocument();
        });
    });

    describe('mobile menu toggle', () => {
        it('should render mobile menu button', () => {
            render(<Header />);

            const menuButton = screen.getByRole('button', { name: 'admin-common.aria.toggleMenu' });
            expect(menuButton).toBeInTheDocument();
        });

        it('should call openMobile when menu button clicked', async () => {
            const user = userEvent.setup();
            render(<Header />);

            const menuButton = screen.getByRole('button', { name: 'admin-common.aria.toggleMenu' });
            await user.click(menuButton);

            expect(mockOpenMobile).toHaveBeenCalledTimes(1);
        });
    });

    describe('notifications', () => {
        it('should render notifications button', () => {
            render(<Header />);

            const notifButton = screen.getByRole('button', {
                name: 'admin-common.aria.notifications'
            });
            expect(notifButton).toBeInTheDocument();
        });

        it('should toggle notifications dropdown on click', async () => {
            const user = userEvent.setup();
            render(<Header />);

            const notifButton = screen.getByRole('button', {
                name: 'admin-common.aria.notifications'
            });
            await user.click(notifButton);

            await waitFor(() => {
                expect(screen.getByText('admin-nav.topbar.notifications')).toBeInTheDocument();
            });
        });
    });

    describe('profile and settings links', () => {
        it('should render profile link', () => {
            render(<Header />);

            const profileLink = screen.getByRole('link', { name: 'admin-common.aria.profile' });
            expect(profileLink).toHaveAttribute('href', '/me/profile');
        });

        it('should render settings link', () => {
            render(<Header />);

            const settingsLink = screen.getByRole('link', { name: 'admin-common.aria.settings' });
            expect(settingsLink).toHaveAttribute('href', '/me/settings');
        });
    });

    describe('search placeholder', () => {
        it('should render search placeholder', () => {
            render(<Header />);

            expect(screen.getByText('admin-nav.topbar.search')).toBeInTheDocument();
        });
    });
});

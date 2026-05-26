/**
 * Tests for Header Component (SPEC-154 T-027 migration)
 *
 * Tests the main navigation header (Level 1) driven by the NEW
 * config-driven IA system:
 * 1. Renders without the old getHeaderNavItems / useCurrentSectionId system
 * 2. Renders <MainMenu /> in the desktop nav slot
 * 3. Renders <QuickCreate /> in the right-side actions
 * 4. Shows <CommandPalette /> when roleConfig.topbar.showSearch is true
 * 5. Hides <CommandPalette /> when roleConfig.topbar.showSearch is false
 * 6. Mobile hamburger calls openMobile / closeMobile from sidebar context
 * 7. Notifications dropdown toggle
 * 8. Profile and settings links
 * 9. Renders AuthHeader (user menu)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── TanStack Router mock ──────────────────────────────────────────────────────
vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        children,
        className,
        ...props
    }: { to: string; children: ReactNode; className?: string; [k: string]: unknown }) => (
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

// ── Translations mock ─────────────────────────────────────────────────────────
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es'
    })
}));

// ── Sidebar context mock ──────────────────────────────────────────────────────
const mockOpenMobile = vi.fn();
const mockCloseMobile = vi.fn();
let mockIsMobileOpen = false;

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        openMobile: mockOpenMobile,
        closeMobile: mockCloseMobile,
        isMobileOpen: mockIsMobileOpen,
        isCollapsed: false
    })
}));

// ── useCurrentRoleConfig mock ─────────────────────────────────────────────────
type MockTopbar = { showSearch?: boolean };
type MockRoleConfig = { topbar?: MockTopbar } | undefined;
let mockRoleConfig: MockRoleConfig = { topbar: { showSearch: true } };

vi.mock('@/hooks/use-current-role-config', () => ({
    useCurrentRoleConfig: () => mockRoleConfig
}));

// ── MainMenu mock ─────────────────────────────────────────────────────────────
vi.mock('@/components/layout/main-menu/MainMenu', () => ({
    MainMenu: () => <nav data-testid="main-menu">MainMenu</nav>
}));

// ── QuickCreate mock ──────────────────────────────────────────────────────────
vi.mock('@/components/layout/quick-create/QuickCreate', () => ({
    QuickCreate: () => <button data-testid="quick-create">QuickCreate</button>
}));

// ── CommandPalette mock ───────────────────────────────────────────────────────
vi.mock('@/components/search/CommandPalette', () => ({
    CommandPalette: () => <div data-testid="command-palette">CommandPalette</div>
}));

// ── Icons mock ────────────────────────────────────────────────────────────────
vi.mock('@repo/icons', () => ({
    MenuIcon: ({ className }: { className?: string }) => (
        <span
            data-testid="menu-icon"
            className={className}
        >
            Menu
        </span>
    ),
    NotificationIcon: ({ className }: { className?: string }) => (
        <span
            data-testid="notification-icon"
            className={className}
        >
            Notification
        </span>
    ),
    UserIcon: ({ className }: { className?: string }) => (
        <span
            data-testid="user-icon"
            className={className}
        >
            User
        </span>
    ),
    SettingsIcon: ({ className }: { className?: string }) => (
        <span
            data-testid="settings-icon"
            className={className}
        >
            Settings
        </span>
    )
}));

// ── AuthHeader mock ───────────────────────────────────────────────────────────
vi.mock('@/integrations/clerk/header-user', () => ({
    HeaderUser: () => <div data-testid="auth-header">AuthHeader</div>
}));

// Import after mocks
import { Header } from '@/components/layout/header/Header';

describe('Header', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsMobileOpen = false;
        mockRoleConfig = { topbar: { showSearch: true } };
    });

    // ── rendering ─────────────────────────────────────────────────────────────

    describe('rendering', () => {
        it('should render the header element', () => {
            render(<Header />);

            expect(screen.getByRole('banner')).toBeInTheDocument();
        });

        it('should render MainMenu component', () => {
            render(<Header />);

            expect(screen.getByTestId('main-menu')).toBeInTheDocument();
        });

        it('should render QuickCreate component', () => {
            render(<Header />);

            expect(screen.getByTestId('quick-create')).toBeInTheDocument();
        });

        it('should render AuthHeader user menu', () => {
            render(<Header />);

            expect(screen.getByTestId('auth-header')).toBeInTheDocument();
        });

        it('should render logo/brand link to /dashboard', () => {
            render(<Header />);

            const logoLink = screen.getByRole('link', {
                name: /hospeda admin/i
            });
            expect(logoLink).toHaveAttribute('href', '/dashboard');
        });

        it('should render notification icon', () => {
            render(<Header />);

            expect(screen.getByTestId('notification-icon')).toBeInTheDocument();
        });
    });

    // ── CommandPalette visibility ─────────────────────────────────────────────

    describe('CommandPalette visibility', () => {
        it('should render CommandPalette when topbar.showSearch is true', () => {
            mockRoleConfig = { topbar: { showSearch: true } };

            render(<Header />);

            expect(screen.getByTestId('command-palette')).toBeInTheDocument();
        });

        it('should NOT render CommandPalette when topbar.showSearch is false', () => {
            mockRoleConfig = { topbar: { showSearch: false } };

            render(<Header />);

            expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
        });

        it('should render CommandPalette when roleConfig is undefined (defaults to true)', () => {
            mockRoleConfig = undefined;

            render(<Header />);

            // Default showSearch is true when roleConfig is missing
            expect(screen.getByTestId('command-palette')).toBeInTheDocument();
        });

        it('should render CommandPalette when topbar is missing (defaults to true)', () => {
            mockRoleConfig = {};

            render(<Header />);

            expect(screen.getByTestId('command-palette')).toBeInTheDocument();
        });
    });

    // ── mobile menu toggle ────────────────────────────────────────────────────

    describe('mobile menu toggle', () => {
        it('should render mobile menu button with toggleMenu aria-label', () => {
            render(<Header />);

            const menuButton = screen.getByRole('button', {
                name: 'admin-common.aria.toggleMenu'
            });
            expect(menuButton).toBeInTheDocument();
        });

        it('should call openMobile when menu button clicked and sidebar is closed', async () => {
            const user = userEvent.setup();
            mockIsMobileOpen = false;

            render(<Header />);

            const menuButton = screen.getByRole('button', {
                name: 'admin-common.aria.toggleMenu'
            });
            await user.click(menuButton);

            expect(mockOpenMobile).toHaveBeenCalledTimes(1);
            expect(mockCloseMobile).not.toHaveBeenCalled();
        });

        it('should call closeMobile when menu button clicked and sidebar is open', async () => {
            const user = userEvent.setup();
            mockIsMobileOpen = true;

            render(<Header />);

            const menuButton = screen.getByRole('button', {
                name: 'admin-common.aria.toggleMenu'
            });
            await user.click(menuButton);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
            expect(mockOpenMobile).not.toHaveBeenCalled();
        });
    });

    // ── notifications ─────────────────────────────────────────────────────────

    describe('notifications', () => {
        it('should render notifications button with correct aria-label', () => {
            render(<Header />);

            const notifButton = screen.getByRole('button', {
                name: 'admin-common.aria.notifications'
            });
            expect(notifButton).toBeInTheDocument();
        });

        it('should toggle notifications dropdown on click', async () => {
            const user = userEvent.setup();
            render(<Header />);

            // Dropdown not visible initially
            expect(screen.queryByText('admin-nav.topbar.notifications')).not.toBeInTheDocument();

            const notifButton = screen.getByRole('button', {
                name: 'admin-common.aria.notifications'
            });
            await user.click(notifButton);

            await waitFor(() => {
                // The dropdown heading text should appear (it's both a title and dropdown header)
                const headings = screen.getAllByText('admin-nav.topbar.notifications');
                // At least one visible element with that text
                expect(headings.length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    // ── profile and settings links ────────────────────────────────────────────

    describe('profile and settings links', () => {
        it('should render profile link to /me/profile', () => {
            render(<Header />);

            const profileLink = screen.getByRole('link', {
                name: 'admin-common.aria.profile'
            });
            expect(profileLink).toHaveAttribute('href', '/me/profile');
        });

        it('should render settings link to /me/settings', () => {
            render(<Header />);

            const settingsLink = screen.getByRole('link', {
                name: 'admin-common.aria.settings'
            });
            expect(settingsLink).toHaveAttribute('href', '/me/settings');
        });
    });

    // ── no old system references ──────────────────────────────────────────────

    describe('no old system', () => {
        it('should NOT render individual nav items from old getHeaderNavItems', () => {
            render(<Header />);

            // Old system injected items like 'admin-menu.dashboard' directly.
            // The NEW system delegates to MainMenu which is mocked as a single
            // <nav data-testid="main-menu"> — no individual labels visible.
            expect(screen.queryByText('admin-menu.dashboard')).not.toBeInTheDocument();
            expect(screen.queryByText('admin-menu.content')).not.toBeInTheDocument();
        });
    });
});

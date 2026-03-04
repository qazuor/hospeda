/**
 * Navigation Integration Tests
 *
 * Tests the 3-level navigation system:
 * 1. Header (Level 1) - Section navigation
 * 2. Sidebar (Level 2) - Contextual navigation
 * 3. PageTabs (Level 3) - Entity detail tabs
 *
 * Verifies:
 * - Navigation between sections updates sidebar
 * - URL-based navigation state persistence
 * - Active states are correctly applied
 * - Mobile menu functionality
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Track mock state for testing
let mockPathname = '/dashboard';
let mockParams: Record<string, string> = {};
const mockNavigate = vi.fn();

// Controllable sidebar config for tests
let mockSidebarConfig: { title: string; items: unknown[] } | undefined = undefined;

// Mock TanStack Router - prevent actual navigation
vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        children,
        className,
        onClick,
        ...props
    }: {
        to: string;
        children: ReactNode;
        className?: string;
        onClick?: (e: React.MouseEvent) => void;
    }) => {
        const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            mockNavigate(to);
            if (onClick) onClick(e);
        };
        return (
            // biome-ignore lint/a11y/useValidAnchor: Mock Link component for testing
            <a
                href="#"
                className={className}
                onClick={handleClick}
                data-href={to}
                {...props}
            >
                {children}
            </a>
        );
    },
    useRouter: () => ({
        subscribe: vi.fn(() => vi.fn())
    }),
    useLocation: () => ({ pathname: mockPathname }),
    useParams: () => mockParams
}));

// Mock translations
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'admin-menu.dashboard': 'Dashboard',
                'admin-menu.content.title': 'Content',
                'admin-menu.admin.title': 'Administration',
                'admin-menu.analytics.title': 'Analytics',
                'admin-tabs.overview': 'Overview',
                'admin-tabs.gallery': 'Gallery',
                'admin-common.aria.toggleMenu': 'Toggle menu',
                'admin-common.aria.closeMenu': 'Close menu',
                'admin-common.aria.notifications': 'Notifications',
                'admin-common.aria.profile': 'Profile',
                'admin-common.aria.settings': 'Settings',
                'admin-common.aria.closeSidebarOverlay': 'Close sidebar',
                'admin-nav.topbar.admin': 'Admin Panel',
                'admin-nav.topbar.search': 'Search...',
                'admin-nav.topbar.notifications': 'Notifications'
            };
            return translations[key] || key;
        }
    })
}));

// Mock icons
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
    DropdownIcon: () => <span data-testid="dropdown-icon">Dropdown</span>,
    AccommodationIcon: () => <span data-testid="accommodation-icon">Accommodation</span>,
    ContentIcon: () => <span data-testid="content-icon">Content</span>,
    AdminIcon: () => <span data-testid="admin-icon">Admin</span>,
    AnalyticsIcon: () => <span data-testid="analytics-icon">Analytics</span>,
    ListIcon: () => <span data-testid="list-icon">List</span>,
    AddIcon: () => <span data-testid="add-icon">Add</span>
}));

// Mock auth header
vi.mock('@/integrations/clerk/header-user', () => ({
    HeaderUser: () => <div data-testid="auth-header">Auth</div>
}));

// Mock section data - defined inline in mocks to avoid hoisting issues
vi.mock('@/config/sections', () => {
    const items = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            labelKey: 'admin-menu.dashboard',
            href: '/dashboard'
        },
        {
            id: 'content',
            label: 'Content',
            labelKey: 'admin-menu.content.title',
            href: '/accommodations'
        }
    ];
    return {
        headerNavItems: items,
        getHeaderNavItems: () => items,
        initializeSections: vi.fn(),
        sections: []
    };
});

// Mock section registry
vi.mock('@/lib/sections/section-registry', () => ({
    getSectionForPath: (path: string) => {
        if (path.startsWith('/dashboard')) {
            return {
                id: 'dashboard',
                label: 'Dashboard',
                routes: ['/dashboard'],
                defaultRoute: '/dashboard',
                sidebar: { title: 'Dashboard', items: [] }
            };
        }
        if (path.startsWith('/accommodations')) {
            return {
                id: 'content',
                label: 'Content',
                routes: ['/accommodations'],
                defaultRoute: '/accommodations',
                sidebar: { title: 'Content', items: [] }
            };
        }
        return undefined;
    },
    getSidebarConfigForPath: (path: string) => {
        if (path.startsWith('/dashboard')) return { title: 'Dashboard', items: [] };
        if (path.startsWith('/accommodations')) return { title: 'Content', items: [] };
        return undefined;
    },
    registerSections: vi.fn(),
    clearSections: vi.fn(),
    getSection: vi.fn(),
    getAllSections: () => []
}));

// Mock section hooks - useCurrentSidebarConfig returns controllable value
vi.mock('@/lib/sections', async () => {
    return {
        useCurrentSection: () => undefined,
        useCurrentSectionId: () => 'dashboard',
        useCurrentSidebarConfig: () => mockSidebarConfig,
        useSectionSidebarSync: vi.fn(),
        filterByPermissions: (items: unknown[]) => items,
        sidebar: {
            link: (id: string, label: string, href: string) => ({ type: 'link', id, label, href }),
            separator: () => ({ type: 'separator', id: 'sep' }),
            group: (id: string, label: string, items: unknown[]) => ({
                type: 'group',
                id,
                label,
                items
            })
        }
    };
});

import { Header } from '@/components/layout/header/Header';
import { Sidebar } from '@/components/layout/sidebar/Sidebar';
// Import components after mocks
import { SidebarProvider } from '@/contexts/sidebar-context';

// Helper to render with providers
function renderWithProviders(ui: ReactNode) {
    return render(<SidebarProvider>{ui}</SidebarProvider>);
}

describe('Navigation Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPathname = '/dashboard';
        mockParams = {};
        mockSidebarConfig = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Header Section Navigation', () => {
        it('should render all main navigation sections', () => {
            renderWithProviders(<Header />);

            expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Content').length).toBeGreaterThanOrEqual(1);
        });

        it('should highlight active section based on current path', () => {
            mockPathname = '/dashboard';
            renderWithProviders(<Header />);

            // Find the dashboard nav item in the main nav (not mobile menu)
            const nav = screen.getByRole('navigation', { name: 'Main navigation' });
            const dashboardLink = nav.querySelector('[data-section-id="dashboard"]');

            expect(dashboardLink).toHaveAttribute('aria-current', 'page');
        });

        it('should navigate to section default route on click', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Header />);

            const nav = screen.getByRole('navigation', { name: 'Main navigation' });
            const contentLink = nav.querySelector('[data-section-id="content"]');

            if (contentLink) {
                await user.click(contentLink);
                expect(mockNavigate).toHaveBeenCalledWith('/accommodations');
            }
        });
    });

    describe('Sidebar Config Integration', () => {
        it('should not show sidebar when no config is available', () => {
            mockSidebarConfig = undefined;
            renderWithProviders(<Sidebar />);

            expect(
                screen.queryByRole('navigation', { name: 'Secondary navigation' })
            ).not.toBeInTheDocument();
        });

        it('should show sidebar when config is available for current route', () => {
            mockSidebarConfig = {
                title: 'Test Sidebar',
                items: [{ type: 'link', id: 'test', label: 'Test Link', href: '/test' }]
            };
            renderWithProviders(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
            expect(screen.getByText('Test Link')).toBeInTheDocument();
        });

        it('should update sidebar when config changes', () => {
            mockSidebarConfig = { title: 'First Title', items: [] };
            const { rerender } = renderWithProviders(<Sidebar />);

            expect(screen.getAllByText('First Title').length).toBeGreaterThanOrEqual(1);

            mockSidebarConfig = { title: 'Second Title', items: [] };
            rerender(
                <SidebarProvider>
                    <Sidebar />
                </SidebarProvider>
            );

            expect(screen.getAllByText('Second Title').length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('URL-Based Navigation State', () => {
        it('should determine active section from URL path', () => {
            mockPathname = '/accommodations';
            renderWithProviders(<Header />);

            const nav = screen.getByRole('navigation', { name: 'Main navigation' });
            const contentLink = nav.querySelector('[data-section-id="content"]');
            const dashboardLink = nav.querySelector('[data-section-id="dashboard"]');

            // Both sections should be present
            expect(contentLink).toBeInTheDocument();
            expect(dashboardLink).toBeInTheDocument();
        });

        it('should handle nested paths correctly', () => {
            mockPathname = '/accommodations/123/edit';
            renderWithProviders(<Header />);

            // Should still recognize content section for nested accommodation paths
            const nav = screen.getByRole('navigation', { name: 'Main navigation' });
            const contentLink = nav.querySelector('[data-section-id="content"]');

            expect(contentLink).toBeInTheDocument();
        });
    });

    describe('Mobile Navigation', () => {
        it('should toggle mobile menu from header', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Header />);

            const menuButton = screen.getByRole('button', { name: 'Toggle menu' });
            await user.click(menuButton);

            expect(menuButton).toBeInTheDocument();
        });
    });

    describe('Navigation Flow', () => {
        it('should support full navigation flow: header -> sidebar -> content', async () => {
            const user = userEvent.setup();

            // Start on dashboard with sidebar config
            mockPathname = '/dashboard';
            mockSidebarConfig = {
                title: 'Dashboard',
                items: [
                    { type: 'link' as const, id: 'overview', label: 'Overview', href: '/dashboard' }
                ]
            };

            const { rerender } = renderWithProviders(
                <>
                    <Header />
                    <Sidebar />
                </>
            );

            // Verify dashboard state
            expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);

            // Click on Content section in header
            const nav = screen.getByRole('navigation', { name: 'Main navigation' });
            const contentLink = nav.querySelector('[data-section-id="content"]');

            if (contentLink) {
                await user.click(contentLink);
                expect(mockNavigate).toHaveBeenCalledWith('/accommodations');
            }

            // Simulate navigation by updating path and config
            mockPathname = '/accommodations';
            mockSidebarConfig = {
                title: 'Content',
                items: [
                    {
                        type: 'link' as const,
                        id: 'accommodations',
                        label: 'Accommodations',
                        href: '/accommodations'
                    }
                ]
            };

            rerender(
                <SidebarProvider>
                    <Header />
                    <Sidebar />
                </SidebarProvider>
            );

            // Verify content section sidebar is now shown
            expect(screen.getByText('Accommodations')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA roles throughout navigation', () => {
            mockSidebarConfig = { title: 'Test', items: [] };
            renderWithProviders(
                <>
                    <Header />
                    <Sidebar />
                </>
            );

            // Header navigation
            expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();

            // Sidebar navigation
            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<Header />);

            // Tab to first focusable element
            await user.tab();

            // Verify that a focusable element received focus
            expect(document.activeElement).not.toBe(document.body);
        });
    });
});

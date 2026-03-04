/**
 * Tests for Sidebar Component
 *
 * Tests the contextual sidebar navigation (Level 2):
 * 1. Does not render when no config available
 * 2. Renders items from config
 * 3. Filters items by permissions
 * 4. Handles mobile open/close
 * 5. Renders groups correctly
 */

import type { SidebarConfig } from '@/lib/sections/types';
import { render, screen } from '@testing-library/react';
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
    useLocation: () => ({ pathname: '/dashboard' }),
    useParams: () => ({})
}));

// Mock translations
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

// Controllable sidebar config for useCurrentSidebarConfig
let mockSidebarConfig: SidebarConfig | undefined = undefined;

// Sidebar context mock state (only mobile/collapse state used by Sidebar now)
let mockIsMobileOpen = false;
const mockCloseMobile = vi.fn();

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        isMobileOpen: mockIsMobileOpen,
        closeMobile: mockCloseMobile,
        isCollapsed: false
    })
}));

// Mock useCurrentSidebarConfig from sections
vi.mock('@/lib/sections', () => ({
    useCurrentSidebarConfig: () => mockSidebarConfig,
    isGroupActive: () => false,
    findActiveItem: () => undefined,
    filterByPermissions: (items: unknown[], permissions?: string[]) => {
        if (!permissions || permissions.length === 0) {
            // Filter out items that require permissions when none provided
            return (items as Array<{ permissions?: string[] }>).filter(
                (item) => !item.permissions || item.permissions.length === 0
            );
        }
        return (items as Array<{ permissions?: string[] }>).filter(
            (item) =>
                !item.permissions ||
                item.permissions.length === 0 ||
                item.permissions.some((p: string) => permissions.includes(p))
        );
    }
}));

// Mock icons - must include all icons used by Sidebar and its children
vi.mock('@repo/icons', () => ({
    CloseIcon: () => <span data-testid="close-icon">Close</span>,
    ChevronIcon: () => <span data-testid="chevron-icon">Chevron</span>,
    DropdownIcon: () => <span data-testid="dropdown-icon">Dropdown</span>
}));

// Import after mocks
import { Sidebar } from '@/components/layout/sidebar/Sidebar';

describe('Sidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSidebarConfig = undefined;
        mockIsMobileOpen = false;
    });

    describe('visibility', () => {
        it('should not render when config is undefined (no route match)', () => {
            mockSidebarConfig = undefined;

            const { container } = render(<Sidebar />);

            expect(container.firstChild).toBeNull();
        });

        it('should render when config exists for current route', () => {
            mockSidebarConfig = { title: 'Test Sidebar', items: [] };

            render(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });
    });

    describe('title rendering', () => {
        it('should render sidebar title', () => {
            mockSidebarConfig = { title: 'Dashboard', items: [] };

            render(<Sidebar />);

            expect(screen.getAllByText('Dashboard')).toHaveLength(2); // Mobile and desktop
        });

        it('should use titleKey if provided', () => {
            mockSidebarConfig = { title: 'Fallback', titleKey: 'admin-menu.dashboard', items: [] };

            render(<Sidebar />);

            expect(screen.getAllByText('admin-menu.dashboard')).toHaveLength(2);
        });
    });

    describe('items rendering', () => {
        it('should render link items', () => {
            mockSidebarConfig = {
                title: 'Test',
                items: [
                    { type: 'link', id: 'home', label: 'Home', href: '/home' },
                    { type: 'link', id: 'about', label: 'About', href: '/about' }
                ]
            };

            render(<Sidebar />);

            expect(screen.getByText('Home')).toBeInTheDocument();
            expect(screen.getByText('About')).toBeInTheDocument();
        });

        it('should render separator items', () => {
            mockSidebarConfig = {
                title: 'Test',
                items: [
                    { type: 'link', id: 'home', label: 'Home', href: '/home' },
                    { type: 'separator', id: 'sep-1' },
                    { type: 'link', id: 'about', label: 'About', href: '/about' }
                ]
            };

            render(<Sidebar />);

            expect(screen.getByRole('separator')).toBeInTheDocument();
        });

        it('should render group items', () => {
            mockSidebarConfig = {
                title: 'Test',
                items: [
                    {
                        type: 'group',
                        id: 'content',
                        label: 'Content',
                        items: [
                            { type: 'link', id: 'posts', label: 'Posts', href: '/posts' },
                            { type: 'link', id: 'pages', label: 'Pages', href: '/pages' }
                        ]
                    }
                ]
            };

            render(<Sidebar />);

            expect(screen.getByText('Content')).toBeInTheDocument();
        });
    });

    describe('permissions filtering', () => {
        it('should show all items when no permissions required', () => {
            mockSidebarConfig = {
                title: 'Test',
                items: [
                    { type: 'link', id: 'public', label: 'Public', href: '/public' },
                    { type: 'link', id: 'admin', label: 'Admin', href: '/admin' }
                ]
            };

            render(<Sidebar userPermissions={[]} />);

            expect(screen.getByText('Public')).toBeInTheDocument();
            expect(screen.getByText('Admin')).toBeInTheDocument();
        });

        it('should filter items by permissions', () => {
            mockSidebarConfig = {
                title: 'Test',
                items: [
                    { type: 'link', id: 'public', label: 'Public', href: '/public' },
                    {
                        type: 'link',
                        id: 'admin',
                        label: 'Admin Only',
                        href: '/admin',
                        permissions: ['admin:read']
                    }
                ]
            };

            render(<Sidebar userPermissions={[]} />);

            expect(screen.getByText('Public')).toBeInTheDocument();
            expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
        });

        it('should show items when user has matching permissions', () => {
            mockSidebarConfig = {
                title: 'Test',
                items: [
                    {
                        type: 'link',
                        id: 'admin',
                        label: 'Admin',
                        href: '/admin',
                        permissions: ['admin:read']
                    }
                ]
            };

            render(<Sidebar userPermissions={['admin:read']} />);

            expect(screen.getByText('Admin')).toBeInTheDocument();
        });
    });

    describe('mobile behavior', () => {
        it('should show overlay when mobile is open', () => {
            mockIsMobileOpen = true;
            mockSidebarConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            // Overlay should be visible (not have pointer-events-none)
            const overlay = screen.getByLabelText('admin-common.aria.closeSidebarOverlay');
            expect(overlay).not.toHaveClass('pointer-events-none');
        });

        it('should call closeMobile when overlay clicked', async () => {
            const user = userEvent.setup();
            mockIsMobileOpen = true;
            mockSidebarConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            const overlay = screen.getByLabelText('admin-common.aria.closeSidebarOverlay');
            await user.click(overlay);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
        });

        it('should render close button in mobile header', () => {
            mockIsMobileOpen = true;
            mockSidebarConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            const closeButton = screen.getByRole('button', { name: 'admin-common.aria.closeMenu' });
            expect(closeButton).toBeInTheDocument();
        });

        it('should call closeMobile when close button clicked', async () => {
            const user = userEvent.setup();
            mockIsMobileOpen = true;
            mockSidebarConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            const closeButton = screen.getByRole('button', { name: 'admin-common.aria.closeMenu' });
            await user.click(closeButton);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
        });
    });

    describe('accessibility', () => {
        it('should have navigation role', () => {
            mockSidebarConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });

        it('should have proper aria-label on overlay', () => {
            mockIsMobileOpen = true;
            mockSidebarConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            expect(
                screen.getByLabelText('admin-common.aria.closeSidebarOverlay')
            ).toBeInTheDocument();
        });
    });
});

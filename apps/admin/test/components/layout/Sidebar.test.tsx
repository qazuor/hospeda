/**
 * Tests for Sidebar Component
 *
 * Tests the contextual sidebar navigation (Level 2):
 * 1. Does not render when not contextual
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
    useLocation: () => ({ pathname: '/dashboard' })
}));

// Mock translations
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

// Sidebar context mock state
let mockConfig: SidebarConfig | null = null;
let mockIsContextual = false;
let mockIsMobileOpen = false;
const mockCloseMobile = vi.fn();

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        config: mockConfig,
        isContextual: mockIsContextual,
        isMobileOpen: mockIsMobileOpen,
        closeMobile: mockCloseMobile,
        isCollapsed: false
    })
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
        mockConfig = null;
        mockIsContextual = false;
        mockIsMobileOpen = false;
    });

    describe('visibility', () => {
        it('should not render when isContextual is false', () => {
            mockIsContextual = false;
            mockConfig = { title: 'Test', items: [] };

            const { container } = render(<Sidebar />);

            expect(container.firstChild).toBeNull();
        });

        it('should not render when config is null', () => {
            mockIsContextual = true;
            mockConfig = null;

            const { container } = render(<Sidebar />);

            expect(container.firstChild).toBeNull();
        });

        it('should render when isContextual is true and config exists', () => {
            mockIsContextual = true;
            mockConfig = { title: 'Test Sidebar', items: [] };

            render(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });
    });

    describe('title rendering', () => {
        it('should render sidebar title', () => {
            mockIsContextual = true;
            mockConfig = { title: 'Dashboard', items: [] };

            render(<Sidebar />);

            expect(screen.getAllByText('Dashboard')).toHaveLength(2); // Mobile and desktop
        });

        it('should use titleKey if provided', () => {
            mockIsContextual = true;
            mockConfig = { title: 'Fallback', titleKey: 'admin-menu.dashboard', items: [] };

            render(<Sidebar />);

            expect(screen.getAllByText('admin-menu.dashboard')).toHaveLength(2);
        });
    });

    describe('items rendering', () => {
        it('should render link items', () => {
            mockIsContextual = true;
            mockConfig = {
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
            mockIsContextual = true;
            mockConfig = {
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
            mockIsContextual = true;
            mockConfig = {
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
            mockIsContextual = true;
            mockConfig = {
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
            mockIsContextual = true;
            mockConfig = {
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
            mockIsContextual = true;
            mockConfig = {
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
            mockIsContextual = true;
            mockIsMobileOpen = true;
            mockConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            // Overlay should be visible (not have pointer-events-none)
            const overlay = screen.getByLabelText('admin-common.aria.closeSidebarOverlay');
            expect(overlay).not.toHaveClass('pointer-events-none');
        });

        it('should call closeMobile when overlay clicked', async () => {
            const user = userEvent.setup();
            mockIsContextual = true;
            mockIsMobileOpen = true;
            mockConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            const overlay = screen.getByLabelText('admin-common.aria.closeSidebarOverlay');
            await user.click(overlay);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
        });

        it('should render close button in mobile header', () => {
            mockIsContextual = true;
            mockIsMobileOpen = true;
            mockConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            const closeButton = screen.getByRole('button', { name: 'admin-common.aria.closeMenu' });
            expect(closeButton).toBeInTheDocument();
        });

        it('should call closeMobile when close button clicked', async () => {
            const user = userEvent.setup();
            mockIsContextual = true;
            mockIsMobileOpen = true;
            mockConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            const closeButton = screen.getByRole('button', { name: 'admin-common.aria.closeMenu' });
            await user.click(closeButton);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
        });
    });

    describe('accessibility', () => {
        it('should have navigation role', () => {
            mockIsContextual = true;
            mockConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });

        it('should have proper aria-label on overlay', () => {
            mockIsContextual = true;
            mockIsMobileOpen = true;
            mockConfig = { title: 'Test', items: [] };

            render(<Sidebar />);

            expect(
                screen.getByLabelText('admin-common.aria.closeSidebarOverlay')
            ).toBeInTheDocument();
        });
    });
});

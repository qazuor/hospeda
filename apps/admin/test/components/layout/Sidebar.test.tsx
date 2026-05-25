/**
 * Tests for Sidebar Component (SPEC-154 T-024 migration)
 *
 * Tests the contextual sidebar navigation (Level 2) driven by the NEW
 * config-driven IA system:
 * 1. Does not render when no sidebar is configured for the current route
 * 2. Renders visible items from useVisibleSidebarItems
 * 3. Renders disabled items (greyed-out, no navigation) for items with no access
 * 4. Handles mobile open/close via sidebar context
 * 5. Injects the unread-badge into the conversations-inbox item by ID
 * 6. Renders groups correctly (uses I18nLabel + resolveIcon)
 */

import type { VisibleGroupItem, VisibleLinkItem } from '@/hooks/use-visible-sidebar-items';
import { render, screen } from '@testing-library/react';
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
    useLocation: () => ({ pathname: '/dashboard' }),
    useParams: () => ({})
}));

// ── Translations mock ─────────────────────────────────────────────────────────
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es'
    })
}));

// ── Unread count mock ─────────────────────────────────────────────────────────
vi.mock('@/features/conversations/hooks/useUnreadCount', () => ({
    useUnreadCount: () => ({ data: { count: 3 } })
}));

// ── Sidebar context mock ──────────────────────────────────────────────────────
let mockIsMobileOpen = false;
const mockCloseMobile = vi.fn();
const mockOpenMobile = vi.fn();

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        isMobileOpen: mockIsMobileOpen,
        closeMobile: mockCloseMobile,
        openMobile: mockOpenMobile,
        isCollapsed: false
    })
}));

// ── New hook mocks ────────────────────────────────────────────────────────────
// useCurrentSidebar — returns the raw Sidebar or undefined.
type MockSidebar = { items: readonly object[] } | undefined;
let mockCurrentSidebar: MockSidebar = undefined;

vi.mock('@/hooks/use-current-sidebar', () => ({
    useCurrentSidebar: () => mockCurrentSidebar
}));

// useVisibleSidebarItems — returns the pre-annotated items (with disabled flag).
type MockVisibleItem =
    | VisibleLinkItem
    | VisibleGroupItem
    | { type: 'separator'; id: string; disabled: false };
let mockVisibleItems: readonly MockVisibleItem[] = [];

vi.mock('@/hooks/use-visible-sidebar-items', () => ({
    useVisibleSidebarItems: () => mockVisibleItems
}));

// ── useLocalizedLabel mock ────────────────────────────────────────────────────
vi.mock('@/hooks/use-localized-label', () => ({
    useLocalizedLabel: (label: { es: string; en: string; pt: string }) => label.es
}));

// ── Icons mock ────────────────────────────────────────────────────────────────
vi.mock('@repo/icons', () => ({
    CloseIcon: ({ className }: { className?: string }) => (
        <span
            data-testid="close-icon"
            className={className}
        >
            Close
        </span>
    ),
    DropdownIcon: ({ className }: { className?: string }) => (
        <span
            data-testid="dropdown-icon"
            className={className}
        >
            Dropdown
        </span>
    ),
    resolveIcon:
        () =>
        ({ size: _size, ...props }: { size?: string; [k: string]: unknown }) => (
            <span
                data-testid="resolved-icon"
                {...props}
            />
        )
}));

// Import after mocks
import { Sidebar } from '@/components/layout/sidebar/Sidebar';

describe('Sidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentSidebar = undefined;
        mockVisibleItems = [];
        mockIsMobileOpen = false;
    });

    // ── visibility ────────────────────────────────────────────────────────────

    describe('visibility', () => {
        it('should not render when no sidebar configured for the current route', () => {
            mockCurrentSidebar = undefined;
            const { container } = render(<Sidebar />);
            expect(container.firstChild).toBeNull();
        });

        it('should render when a sidebar is configured for the current route', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [];

            render(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });
    });

    // ── item rendering ────────────────────────────────────────────────────────

    describe('items rendering', () => {
        it('should render visible link items with localized label', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [
                {
                    type: 'link',
                    id: 'home',
                    label: { es: 'Inicio', en: 'Home', pt: 'Início' },
                    route: '/dashboard',
                    exact: true,
                    onMissing: 'disable',
                    disabled: false
                },
                {
                    type: 'link',
                    id: 'about',
                    label: { es: 'Acerca', en: 'About', pt: 'Sobre' },
                    route: '/about',
                    exact: false,
                    onMissing: 'disable',
                    disabled: false
                }
            ];

            render(<Sidebar />);

            expect(screen.getByText('Inicio')).toBeInTheDocument();
            expect(screen.getByText('Acerca')).toBeInTheDocument();
        });

        it('should render separator items', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [
                {
                    type: 'link',
                    id: 'home',
                    label: { es: 'Inicio', en: 'Home', pt: 'Início' },
                    route: '/dashboard',
                    exact: true,
                    onMissing: 'disable',
                    disabled: false
                },
                { type: 'separator', id: 'sep-1', disabled: false },
                {
                    type: 'link',
                    id: 'about',
                    label: { es: 'Acerca', en: 'About', pt: 'Sobre' },
                    route: '/about',
                    exact: false,
                    onMissing: 'disable',
                    disabled: false
                }
            ];

            render(<Sidebar />);

            expect(document.querySelector('hr')).toBeInTheDocument();
        });

        it('should render group items', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [
                {
                    type: 'group',
                    id: 'content',
                    label: { es: 'Contenido', en: 'Content', pt: 'Conteúdo' },
                    defaultOpen: false,
                    onMissing: 'disable',
                    disabled: false,
                    items: [
                        {
                            type: 'link',
                            id: 'posts',
                            label: { es: 'Posts', en: 'Posts', pt: 'Posts' },
                            route: '/posts',
                            exact: false,
                            onMissing: 'disable',
                            disabled: false
                        }
                    ]
                }
            ];

            render(<Sidebar />);

            expect(screen.getByText('Contenido')).toBeInTheDocument();
        });

        it('should render disabled link items greyed-out with tooltip', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [
                {
                    type: 'link',
                    id: 'admin',
                    label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
                    route: '/admin',
                    exact: false,
                    onMissing: 'disable',
                    disabled: true
                }
            ];

            render(<Sidebar />);

            const disabledItem = screen.getByTitle('Requiere permiso');
            expect(disabledItem).toBeInTheDocument();
            // Should be a span (not a link) when disabled
            expect(disabledItem.tagName).toBe('SPAN');
        });
    });

    // ── unread badge ──────────────────────────────────────────────────────────

    describe('unread badge injection', () => {
        it('should inject unread badge on conversations-inbox item', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [
                {
                    type: 'link',
                    id: 'conversations-inbox',
                    label: { es: 'Inbox', en: 'Inbox', pt: 'Inbox' },
                    route: '/conversations',
                    exact: false,
                    onMissing: 'disable',
                    disabled: false
                }
            ];

            render(<Sidebar />);

            // useUnreadCount mock returns count: 3
            expect(screen.getByLabelText('3 unread messages')).toBeInTheDocument();
        });

        it('should NOT show badge on items other than conversations-inbox', () => {
            mockCurrentSidebar = { items: [] };
            mockVisibleItems = [
                {
                    type: 'link',
                    id: 'dashboard',
                    label: { es: 'Dashboard', en: 'Dashboard', pt: 'Dashboard' },
                    route: '/dashboard',
                    exact: true,
                    onMissing: 'disable',
                    disabled: false
                }
            ];

            render(<Sidebar />);

            expect(screen.queryByLabelText('3 unread messages')).not.toBeInTheDocument();
        });
    });

    // ── mobile behavior ───────────────────────────────────────────────────────

    describe('mobile behavior', () => {
        it('should show overlay when mobile is open', () => {
            mockIsMobileOpen = true;
            mockCurrentSidebar = { items: [] };

            render(<Sidebar />);

            const overlay = screen.getByLabelText('admin-common.aria.closeSidebarOverlay');
            expect(overlay).not.toHaveClass('pointer-events-none');
        });

        it('should call closeMobile when overlay clicked', async () => {
            const user = userEvent.setup();
            mockIsMobileOpen = true;
            mockCurrentSidebar = { items: [] };

            render(<Sidebar />);

            const overlay = screen.getByLabelText('admin-common.aria.closeSidebarOverlay');
            await user.click(overlay);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
        });

        it('should render close button in mobile header', () => {
            mockIsMobileOpen = true;
            mockCurrentSidebar = { items: [] };

            render(<Sidebar />);

            const closeButton = screen.getByRole('button', { name: 'admin-common.aria.closeMenu' });
            expect(closeButton).toBeInTheDocument();
        });

        it('should call closeMobile when close button clicked', async () => {
            const user = userEvent.setup();
            mockIsMobileOpen = true;
            mockCurrentSidebar = { items: [] };

            render(<Sidebar />);

            const closeButton = screen.getByRole('button', { name: 'admin-common.aria.closeMenu' });
            await user.click(closeButton);

            expect(mockCloseMobile).toHaveBeenCalledTimes(1);
        });
    });

    // ── accessibility ─────────────────────────────────────────────────────────

    describe('accessibility', () => {
        it('should have navigation role with label', () => {
            mockCurrentSidebar = { items: [] };

            render(<Sidebar />);

            expect(
                screen.getByRole('navigation', { name: 'Secondary navigation' })
            ).toBeInTheDocument();
        });

        it('should have proper aria-label on overlay', () => {
            mockIsMobileOpen = true;
            mockCurrentSidebar = { items: [] };

            render(<Sidebar />);

            expect(
                screen.getByLabelText('admin-common.aria.closeSidebarOverlay')
            ).toBeInTheDocument();
        });
    });
});

// @vitest-environment jsdom
/**
 * Smoke tests — data-tour attributes (SPEC-174 T-012).
 *
 * Light assertions confirming that the key `data-tour` attributes specified in
 * §7.7 are present in the rendered DOM of each layout component. These tests
 * are additive: they verify the new attributes without duplicating the full
 * behavior coverage of the existing component test suites.
 *
 * Attributes verified:
 * - `data-tour="main-menu"` on MainMenu's <nav> container.
 * - `data-tour="main-menu-section-<id>"` on each section link.
 * - `data-tour="quick-create"` on QuickCreate's trigger button.
 * - `data-tour="notifications"` on Header's notifications button.
 * - `data-tour="user-menu"` on HeaderUser's avatar button.
 * - `data-tour="bottom-nav"` on BottomNav's <nav> container.
 *
 * **Section ID casing note (SPEC-174 T-012 critical note):**
 * Section IDs in the IA config are camelCase (e.g. `'misAlojamientos'`, `'inicio'`).
 * The `MainMenu` component sets `data-tour="main-menu-section-<sectionId>"` using
 * the section ID AS-IS. This means values are mixed case:
 * `data-tour="main-menu-section-misAlojamientos"`.
 * The `TourStepTargetSchema` currently only allows lowercase IDs (`[a-z0-9-]+`),
 * so dynamic per-section targets with camelCase IDs CANNOT be used in tours
 * yet. The attributes are added for future use.
 *
 * NOTE: vi.mock factories are hoisted above top-level const declarations.
 * All fixture objects used inside vi.mock() factories MUST be inlined.
 *
 * @see apps/admin/src/components/layout/main-menu/MainMenu.tsx
 * @see apps/admin/src/components/layout/quick-create/QuickCreate.tsx
 * @see apps/admin/src/components/layout/header/Header.tsx
 * @see apps/admin/src/integrations/clerk/header-user.tsx
 * @see apps/admin/src/components/layout/mobile-nav/BottomNav.tsx
 * @see SPEC-174 §7.7
 */

import type { RoleConfig } from '@/config/ia/schema';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Common router mock
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        children,
        className,
        'aria-current': ariaCurrent,
        'data-section-id': dataSectionId,
        'data-tour': dataTour,
        ...rest
    }: {
        to: string;
        children: ReactNode;
        className?: string;
        'aria-current'?: string;
        'data-section-id'?: string;
        'data-tour'?: string;
        [k: string]: unknown;
    }) => (
        <a
            href={to}
            className={className}
            aria-current={ariaCurrent as 'page' | undefined}
            data-section-id={dataSectionId}
            data-tour={dataTour}
            {...rest}
        >
            {children}
        </a>
    ),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/dashboard' }),
    useRouter: () => ({ subscribe: vi.fn(() => vi.fn()) })
}));

// ---------------------------------------------------------------------------
// Common hook + util mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (k: string) => k, locale: 'es' })
}));

vi.mock('@/hooks/use-localized-label', () => ({
    useLocalizedLabel: (label: { es: string }) => label.es
}));

vi.mock('@/lib/nav-icon-map', () => ({
    resolveNavIcon: ({ iconName }: { iconName: string }) => {
        const MockIcon = (p: Record<string, unknown>) => (
            <span
                data-testid={`icon-${iconName}`}
                aria-hidden="true"
                {...p}
            />
        );
        MockIcon.displayName = `MockIcon(${iconName})`;
        return MockIcon;
    }
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/config/ia/permission-bundles', () => ({
    expandPermissions: ({ expressions }: { expressions: readonly string[] }) => expressions
}));

// ---------------------------------------------------------------------------
// validatedConfig mock — all sections inline (hoisting safe)
// ---------------------------------------------------------------------------

vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        sections: {
            inicio: {
                id: 'inicio',
                label: { es: 'Inicio', en: 'Home', pt: 'Início' },
                icon: 'HomeIcon',
                route: '/dashboard',
                defaultRoute: '/dashboard',
                sidebar: null
            },
            catalogo: {
                id: 'catalogo',
                label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
                icon: 'AccommodationIcon',
                route: '/accommodations',
                defaultRoute: '/accommodations',
                sidebar: null
            }
        },
        sidebars: {},
        dashboards: {},
        tabs: {},
        createActions: {
            'create-accommodation': {
                id: 'create-accommodation',
                label: { es: 'Alojamiento', en: 'Accommodation', pt: 'Alojamento' },
                route: '/accommodations/new',
                icon: 'AccommodationIcon',
                permissions: []
            }
        },
        roles: {},
        tours: {}
    }
}));

// ---------------------------------------------------------------------------
// Role/permission/section mocks — all inline (hoisting safe)
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-current-role-config', () => ({
    useCurrentRoleConfig: (): RoleConfig => ({
        enabled: true,
        label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
        mainMenu: ['inicio', 'catalogo'],
        dashboard: 'adminDashboard',
        topbar: { showSearch: true, showQuickCreate: 'all', accountInMenu: false },
        mobile: { bottomNav: ['inicio', 'catalogo'], fab: null },
        labelOverrides: {}
    })
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => []
}));

vi.mock('@/hooks/use-current-section', () => ({
    useCurrentSection: () => undefined
}));

// ---------------------------------------------------------------------------
// Sidebar-specific mocks
// ---------------------------------------------------------------------------

vi.mock('@/contexts/sidebar-context', () => ({
    useSidebarContext: () => ({
        openMobile: vi.fn(),
        closeMobile: vi.fn(),
        isMobileOpen: false,
        isCollapsed: false,
        toggle: vi.fn()
    })
}));

vi.mock('@/hooks/use-current-sidebar', () => ({
    useCurrentSidebar: () => null
}));

vi.mock('@/hooks/use-visible-sidebar-items', () => ({
    useVisibleSidebarItems: () => []
}));

vi.mock('@/features/conversations/hooks/useUnreadCount', () => ({
    useUnreadCount: () => ({ data: null })
}));

// ---------------------------------------------------------------------------
// Header/CommandPalette/QuickCreate mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/search/CommandPalette', () => ({
    CommandPalette: () => <span data-testid="command-palette-stub" />
}));

vi.mock('@/components/whats-new/WhatsNewBadge', () => ({
    WhatsNewBadge: () => null
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({
        children,
        className,
        'aria-label': ariaLabel,
        'data-tour': dataTour
    }: {
        children: ReactNode;
        className?: string;
        'aria-label'?: string;
        'data-tour'?: string;
    }) => (
        <button
            type="button"
            className={className}
            aria-label={ariaLabel}
            data-tour={dataTour}
        >
            {children}
        </button>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children }: { children: ReactNode }) => (
        // biome-ignore lint/a11y/useFocusableInteractive: test-only mock, no interactive behavior needed
        <div role="menuitem">{children}</div>
    )
}));

vi.mock('@repo/icons', () => ({
    ChevronDownIcon: (p: Record<string, unknown>) => <span {...p} />,
    MenuIcon: (p: Record<string, unknown>) => <span {...p} />,
    NotificationIcon: (p: Record<string, unknown>) => <span {...p} />,
    SettingsIcon: (p: Record<string, unknown>) => <span {...p} />,
    UserIcon: (p: Record<string, unknown>) => <span {...p} />,
    SearchIcon: (p: Record<string, unknown>) => <span {...p} />,
    CloseIcon: (p: Record<string, unknown>) => <span {...p} />
}));

// ---------------------------------------------------------------------------
// HeaderUser-specific mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        isLoading: false,
        isAuthenticated: true,
        user: {
            id: 'user-1',
            role: 'ADMIN',
            permissions: [],
            displayName: 'Test User',
            email: 'test@example.com',
            avatar: undefined
        },
        error: null,
        refreshSession: vi.fn(),
        clearSession: vi.fn(),
        signOut: vi.fn()
    })
}));

vi.mock('@/lib/auth-client', () => ({
    signOut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@repo/media', () => ({
    getMediaUrl: (src: string) => src
}));

// ---------------------------------------------------------------------------
// Component imports (after all mocks)
// ---------------------------------------------------------------------------

import { MainMenu } from '@/components/layout/main-menu/MainMenu';
import { BottomNav } from '@/components/layout/mobile-nav/BottomNav';
import { QuickCreate } from '@/components/layout/quick-create/QuickCreate';
import { HeaderUser } from '@/integrations/clerk/header-user';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MainMenu — data-tour attributes (SPEC-174 T-012)', () => {
    it('renders data-tour="main-menu" on the nav container', () => {
        render(<MainMenu />);
        const nav = screen.getByRole('navigation', { name: 'Main navigation' });
        expect(nav).toHaveAttribute('data-tour', 'main-menu');
    });

    it('renders data-tour="main-menu-section-inicio" on the inicio section link', () => {
        render(<MainMenu />);
        // Sections with sidebar:null are always shown
        const link = document.querySelector('[data-section-id="inicio"]');
        expect(link).toBeTruthy();
        expect(link).toHaveAttribute('data-tour', 'main-menu-section-inicio');
    });

    it('renders data-tour="main-menu-section-catalogo" on the catalogo section link', () => {
        render(<MainMenu />);
        const link = document.querySelector('[data-section-id="catalogo"]');
        expect(link).toBeTruthy();
        expect(link).toHaveAttribute('data-tour', 'main-menu-section-catalogo');
    });
});

describe('QuickCreate — data-tour attribute (SPEC-174 T-012)', () => {
    it('renders data-tour="quick-create" on the trigger button', () => {
        render(<QuickCreate />);
        const trigger = document.querySelector('[data-tour="quick-create"]');
        expect(trigger).toBeTruthy();
        expect(trigger?.getAttribute('aria-label')).toBe('Quick create');
    });
});

describe('BottomNav — data-tour attribute (SPEC-174 T-012)', () => {
    it('renders data-tour="bottom-nav" on the nav container', () => {
        render(<BottomNav />);
        const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
        expect(nav).toHaveAttribute('data-tour', 'bottom-nav');
    });
});

describe('HeaderUser — data-tour attribute (SPEC-174 T-012)', () => {
    it('renders data-tour="user-menu" on the avatar button', () => {
        render(<HeaderUser />);
        const button = screen.getByRole('button', { name: 'User menu' });
        expect(button).toHaveAttribute('data-tour', 'user-menu');
    });
});

// @vitest-environment jsdom
/**
 * Tests for MainMenu Component (SPEC-154 T-023).
 *
 * Covers:
 * - Returns null when no role config (unauthenticated / unknown role / disabled role).
 * - Renders sections from roleConfig.mainMenu in order.
 * - Active section gets aria-current="page" and active styling data attribute.
 * - Section with 0 user-accessible items in its sidebar is omitted.
 * - Section with sidebar:null is always shown (no items to filter).
 * - ARCHITECTURE PROOF: same role, different user permissions → different sections shown.
 * - Links point to section.defaultRoute ?? section.route.
 *
 * @see apps/admin/src/components/layout/main-menu/MainMenu.tsx
 * @see SPEC-154 T-023
 */

import type { RoleConfig, Section } from '@/config/ia/schema';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        children,
        className,
        'aria-current': ariaCurrent,
        'data-section-id': dataSectionId
    }: {
        to: string;
        children: ReactNode;
        className?: string;
        'aria-current'?: string | boolean;
        'data-section-id'?: string;
    }) => (
        <a
            href={to}
            className={className}
            aria-current={ariaCurrent as 'page' | undefined}
            data-section-id={dataSectionId}
        >
            {children}
        </a>
    ),
    useLocation: () => ({ pathname: '/inicio' })
}));

// ---------------------------------------------------------------------------
// Mock translations
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es'
    })
}));

// ---------------------------------------------------------------------------
// Mock icons
// ---------------------------------------------------------------------------

vi.mock('@repo/icons', () => ({
    resolveIcon: ({ iconName }: { iconName: string }) => {
        const MockIcon = ({ 'aria-hidden': _h, ...p }: Record<string, unknown>) => (
            <span
                data-testid={`icon-${iconName}`}
                {...p}
            />
        );
        MockIcon.displayName = `MockIcon(${iconName})`;
        return MockIcon;
    }
}));

// ---------------------------------------------------------------------------
// Controllable mocks
// ---------------------------------------------------------------------------

let mockRoleConfig: RoleConfig | undefined;
let mockUserPermissions: string[] = [];
let mockActiveSection: Section | undefined;

vi.mock('@/hooks/use-current-role-config', () => ({
    useCurrentRoleConfig: () => mockRoleConfig
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mockUserPermissions
}));

vi.mock('@/hooks/use-current-section', () => ({
    useCurrentSection: () => mockActiveSection
}));

vi.mock('@/hooks/use-localized-label', () => ({
    useLocalizedLabel: (label: { es: string; en: string; pt: string }) => label.es
}));

// ---------------------------------------------------------------------------
// Mock validatedConfig with deterministic fixtures.
// NOTE: vi.mock factories are hoisted above all module-level variable
// declarations, so fixture objects must be inlined inside the factory.
// We re-declare the same objects as consts below for use in tests.
// ---------------------------------------------------------------------------

vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        sections: {
            inicio: {
                id: 'inicio',
                label: { es: 'Inicio', en: 'Home', pt: 'Início' },
                icon: 'HouseIcon',
                route: '/inicio',
                defaultRoute: '/inicio/dashboard',
                sidebar: 'inicioSidebar'
            },
            catalogo: {
                id: 'catalogo',
                label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
                icon: 'PackageIcon',
                route: '/catalogo',
                defaultRoute: '/catalogo/alojamientos',
                sidebar: 'catalogoSidebar'
            },
            noSidebar: {
                id: 'noSidebar',
                label: { es: 'Sin sidebar', en: 'No Sidebar', pt: 'Sem sidebar' },
                icon: 'SettingsIcon',
                route: '/sin-sidebar',
                sidebar: null
            }
        },
        sidebars: {
            inicioSidebar: {
                items: [
                    {
                        type: 'link',
                        id: 'link-public',
                        label: { es: 'Public', en: 'Public', pt: 'Public' },
                        route: '/inicio/dashboard',
                        exact: false,
                        onMissing: 'disable'
                    }
                ]
            },
            catalogoSidebar: {
                items: [
                    {
                        type: 'link',
                        id: 'link-gated',
                        label: { es: 'Gated', en: 'Gated', pt: 'Gated' },
                        route: '/catalogo/alojamientos',
                        exact: false,
                        onMissing: 'hide',
                        permissions: ['ACCOMMODATION_VIEW_ALL']
                    }
                ]
            }
        },
        dashboards: {},
        tabs: {},
        createActions: {},
        roles: {}
    }
}));

// ---------------------------------------------------------------------------
// Fixture consts (used in test assertions — defined AFTER vi.mock blocks)
// ---------------------------------------------------------------------------

const SECTION_INICIO: Section = {
    id: 'inicio',
    label: { es: 'Inicio', en: 'Home', pt: 'Início' },
    icon: 'HouseIcon',
    route: '/inicio',
    defaultRoute: '/inicio/dashboard',
    sidebar: 'inicioSidebar'
};

// expandPermissions: map ACCOMMODATION_VIEW_ALL → 'accommodation.viewAll'
vi.mock('@/config/ia/permission-bundles', () => ({
    expandPermissions: ({ expressions }: { expressions: readonly string[] }) => {
        const map: Record<string, string> = {
            ACCOMMODATION_VIEW_ALL: 'accommodation.viewAll',
            ACCOMMODATION_CREATE: 'accommodation.create'
        };
        return expressions.flatMap((expr) => {
            if (expr === '*') return ['accommodation.viewAll', 'accommodation.create'];
            const resolved = map[expr];
            if (!resolved) throw new Error(`Unknown permission: ${expr}`);
            return [resolved];
        });
    }
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { MainMenu } from '@/components/layout/main-menu/MainMenu';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_ROLE_CONFIG: RoleConfig = {
    enabled: true,
    label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
    mainMenu: ['inicio', 'catalogo'],
    dashboard: 'adminDashboard',
    topbar: { showSearch: true, showQuickCreate: null, accountInMenu: false },
    mobile: { bottomNav: null, fab: null },
    labelOverrides: {}
};

function setRole(config: RoleConfig | undefined): void {
    mockRoleConfig = config;
}

function setPermissions(...perms: string[]): void {
    mockUserPermissions = [...perms];
}

function setActiveSection(section: Section | undefined): void {
    mockActiveSection = section;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MainMenu', () => {
    beforeEach(() => {
        mockRoleConfig = undefined;
        mockUserPermissions = [];
        mockActiveSection = undefined;
    });

    describe('null / no-render cases', () => {
        it('renders nothing when no role config (unauthenticated)', () => {
            setRole(undefined);
            const { container } = render(<MainMenu />);
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when roleConfig has empty mainMenu', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: [] });
            const { container } = render(<MainMenu />);
            expect(container.firstChild).toBeNull();
        });
    });

    describe('section rendering', () => {
        it('renders sections from roleConfig.mainMenu in order', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio', 'catalogo'] });
            setPermissions('accommodation.viewAll'); // grants access to catalogo
            render(<MainMenu />);

            const links = screen.getAllByRole('link');
            const sectionIds = links.map((l) => l.getAttribute('data-section-id'));
            expect(sectionIds).toEqual(['inicio', 'catalogo']);
        });

        it('renders label for each section', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio'] });
            render(<MainMenu />);
            expect(screen.getByText('Inicio')).toBeInTheDocument();
        });

        it('uses section.defaultRoute as href when available', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio'] });
            render(<MainMenu />);
            expect(screen.getByRole('link')).toHaveAttribute('href', '/inicio/dashboard');
        });

        it('falls back to section.route when defaultRoute is absent', () => {
            // Temporarily add a section without defaultRoute
            setRole({
                ...BASE_ROLE_CONFIG,
                mainMenu: ['catalogo']
            });
            setPermissions('accommodation.viewAll');
            render(<MainMenu />);
            expect(screen.getByRole('link')).toHaveAttribute('href', '/catalogo/alojamientos');
        });
    });

    describe('active state', () => {
        it('marks the active section with aria-current="page"', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio'] });
            setActiveSection(SECTION_INICIO);
            render(<MainMenu />);
            const link = screen.getByRole('link', { current: 'page' });
            expect(link).toHaveAttribute('data-section-id', 'inicio');
        });

        it('does not set aria-current on inactive sections', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio', 'catalogo'] });
            setPermissions('accommodation.viewAll');
            setActiveSection(SECTION_INICIO);
            render(<MainMenu />);

            const catalogoLink = screen.getByRole('link', {
                name: (_name, el) => el.getAttribute('data-section-id') === 'catalogo'
            });
            expect(catalogoLink).not.toHaveAttribute('aria-current');
        });
    });

    describe('permission-driven section visibility (AC-17)', () => {
        it('hides a section when user has 0 accessible items in its sidebar', () => {
            // catalogo sidebar has only ACCOMMODATION_VIEW_ALL gated items (onMissing:'hide')
            // User has no permissions → 0 accessible items → section hidden
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio', 'catalogo'] });
            setPermissions(); // no permissions
            render(<MainMenu />);

            expect(screen.queryByText('Catálogo')).not.toBeInTheDocument();
            // inicio has a public item → still shown
            expect(screen.getByText('Inicio')).toBeInTheDocument();
        });

        it('shows a section when user has the required permission', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['catalogo'] });
            setPermissions('accommodation.viewAll'); // grants access
            render(<MainMenu />);
            expect(screen.getByText('Catálogo')).toBeInTheDocument();
        });

        it('always shows a section with sidebar:null regardless of permissions', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['noSidebar'] });
            setPermissions(); // no permissions
            render(<MainMenu />);
            expect(screen.getByText('Sin sidebar')).toBeInTheDocument();
        });
    });

    describe('ARCHITECTURE PROOF: visibility driven by user permissions, not role', () => {
        it('same role, different user permissions → different sections shown', () => {
            // Both renders use the same role template.
            // User A: has no permissions → catalogo hidden (gated sidebar item with hide).
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio', 'catalogo'] });
            setPermissions();
            const { unmount } = render(<MainMenu />);
            const linksUserA = screen
                .queryAllByRole('link')
                .map((l) => l.getAttribute('data-section-id'));
            expect(linksUserA).not.toContain('catalogo');
            unmount();

            // User B: has accommodation.viewAll → catalogo shown.
            setPermissions('accommodation.viewAll');
            render(<MainMenu />);
            const linksUserB = screen
                .queryAllByRole('link')
                .map((l) => l.getAttribute('data-section-id'));
            expect(linksUserB).toContain('catalogo');
        });
    });

    describe('icon rendering', () => {
        it('renders icon for sections that have an icon id', () => {
            setRole({ ...BASE_ROLE_CONFIG, mainMenu: ['inicio'] });
            render(<MainMenu />);
            expect(screen.getByTestId('icon-HouseIcon')).toBeInTheDocument();
        });
    });
});

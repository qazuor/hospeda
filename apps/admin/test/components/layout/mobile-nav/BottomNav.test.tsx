// @vitest-environment jsdom
/**
 * Tests for BottomNav Component (SPEC-154 T-026).
 *
 * Covers:
 * - Returns null when no role config (unauthenticated / unknown role).
 * - Returns null when roleConfig.mobile.bottomNav is null.
 * - Renders bottomNav section links in order.
 * - Active section gets aria-current="page".
 * - Section with 0 user-accessible items in its sidebar is hidden.
 * - FAB renders when mobile.fab is set and user has permission.
 * - FAB is hidden when user lacks the required permission.
 * - FAB is absent when mobile.fab is null.
 * - Component is mobile-only (renders with md:hidden class).
 *
 * @see apps/admin/src/components/layout/mobile-nav/BottomNav.tsx
 * @see SPEC-154 T-026
 */

import type { RoleConfig, Section } from '@/config/ia/schema';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

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
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/inicio' })
}));

// ---------------------------------------------------------------------------
// Mock translations + localized label
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (k: string) => k, locale: 'es' })
}));

vi.mock('@/hooks/use-localized-label', () => ({
    useLocalizedLabel: (label: { es: string; en: string; pt: string }) => label.es
}));

// ---------------------------------------------------------------------------
// Mock icons
// ---------------------------------------------------------------------------

vi.mock('@repo/icons', () => ({
    resolveIcon: ({ iconName }: { iconName: string }) => {
        const MockIcon = ({ 'aria-hidden': _h, weight: _w, ...p }: Record<string, unknown>) => (
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

// ---------------------------------------------------------------------------
// Mock validatedConfig with deterministic fixtures.
// NOTE: vi.mock factories are hoisted; fixture objects must be inlined.
// Fixture consts used in test assertions are declared AFTER vi.mock blocks.
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
                sidebar: 'catalogoSidebar'
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
        createActions: {
            newAccommodation: {
                id: 'newAccommodation',
                label: { es: 'Nuevo alojamiento', en: 'New accommodation', pt: 'Novo alojamento' },
                route: '/accommodations/new',
                icon: 'AccommodationIcon',
                permissions: ['ACCOMMODATION_CREATE']
            }
        },
        roles: {}
    }
}));

// ---------------------------------------------------------------------------
// Fixture consts — defined AFTER vi.mock blocks, used in test assertions.
// ---------------------------------------------------------------------------

const SECTION_INICIO: Section = {
    id: 'inicio',
    label: { es: 'Inicio', en: 'Home', pt: 'Início' },
    icon: 'HouseIcon',
    route: '/inicio',
    defaultRoute: '/inicio/dashboard',
    sidebar: 'inicioSidebar'
};

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
    cn: (...cls: (string | undefined | false)[]) => cls.filter(Boolean).join(' ')
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { BottomNav } from '@/components/layout/mobile-nav/BottomNav';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRoleConfig(bottomNav: string[] | null, fab: string | null = null): RoleConfig {
    return {
        enabled: true,
        label: { es: 'Host', en: 'Host', pt: 'Anfitrião' },
        mainMenu: ['inicio', 'catalogo'],
        dashboard: 'hostDashboard',
        topbar: { showSearch: false, showQuickCreate: null, accountInMenu: true },
        mobile: { bottomNav, fab },
        labelOverrides: {}
    };
}

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

describe('BottomNav', () => {
    beforeEach(() => {
        mockRoleConfig = undefined;
        mockUserPermissions = [];
        mockActiveSection = undefined;
        mockNavigate.mockClear();
    });

    describe('null / no-render cases', () => {
        it('renders nothing when no role config', () => {
            setRole(undefined);
            const { container } = render(<BottomNav />);
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when bottomNav is null', () => {
            setRole(buildRoleConfig(null));
            const { container } = render(<BottomNav />);
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when all sections have 0 accessible items and no FAB', () => {
            // catalogo sidebar items are gated (hide) and user has no perms
            setRole(buildRoleConfig(['catalogo']));
            setPermissions(); // no access
            const { container } = render(<BottomNav />);
            expect(container.firstChild).toBeNull();
        });
    });

    describe('section rendering', () => {
        it('renders bottomNav section links in declared order', () => {
            setRole(buildRoleConfig(['inicio', 'catalogo']));
            setPermissions('accommodation.viewAll'); // grants catalogo
            render(<BottomNav />);

            const links = screen.getAllByRole('link');
            expect(links[0]).toHaveAttribute('data-section-id', 'inicio');
            expect(links[1]).toHaveAttribute('data-section-id', 'catalogo');
        });

        it('renders section labels', () => {
            setRole(buildRoleConfig(['inicio']));
            render(<BottomNav />);
            expect(screen.getByText('Inicio')).toBeInTheDocument();
        });

        it('uses section.defaultRoute as href when available', () => {
            setRole(buildRoleConfig(['inicio']));
            render(<BottomNav />);
            expect(screen.getByRole('link')).toHaveAttribute('href', '/inicio/dashboard');
        });

        it('falls back to section.route when defaultRoute is absent', () => {
            setRole(buildRoleConfig(['catalogo']));
            setPermissions('accommodation.viewAll');
            render(<BottomNav />);
            expect(screen.getByRole('link')).toHaveAttribute('href', '/catalogo');
        });
    });

    describe('active state', () => {
        it('marks the active section with aria-current="page"', () => {
            setRole(buildRoleConfig(['inicio', 'catalogo']));
            setPermissions('accommodation.viewAll');
            setActiveSection(SECTION_INICIO);
            render(<BottomNav />);

            const activeLink = screen.getByRole('link', { current: 'page' });
            expect(activeLink).toHaveAttribute('data-section-id', 'inicio');
        });

        it('does not set aria-current on inactive sections', () => {
            setRole(buildRoleConfig(['inicio', 'catalogo']));
            setPermissions('accommodation.viewAll');
            setActiveSection(SECTION_INICIO);
            render(<BottomNav />);

            const catalogoLink = screen.getByRole('link', {
                name: (_name, el) => el.getAttribute('data-section-id') === 'catalogo'
            });
            expect(catalogoLink).not.toHaveAttribute('aria-current');
        });
    });

    describe('permission-driven section visibility', () => {
        it('hides a section when user has 0 accessible items in its sidebar', () => {
            // catalogo sidebar: gated item with onMissing:'hide', user has no access
            setRole(buildRoleConfig(['inicio', 'catalogo']));
            setPermissions(); // no perms
            render(<BottomNav />);

            expect(screen.queryByText('Catálogo')).not.toBeInTheDocument();
            expect(screen.getByText('Inicio')).toBeInTheDocument();
        });

        it('shows a section when user has the required permission', () => {
            setRole(buildRoleConfig(['catalogo']));
            setPermissions('accommodation.viewAll');
            render(<BottomNav />);
            expect(screen.getByText('Catálogo')).toBeInTheDocument();
        });
    });

    describe('FAB', () => {
        it('renders FAB when mobile.fab is set and user has permission', () => {
            setRole(buildRoleConfig(['inicio'], 'newAccommodation'));
            setPermissions('accommodation.create');
            render(<BottomNav />);

            const fab = screen.getByRole('button', { name: 'Nuevo alojamiento' });
            expect(fab).toBeInTheDocument();
            expect(fab).toHaveAttribute('data-action-id', 'newAccommodation');
        });

        it('hides FAB when user lacks the required permission', () => {
            setRole(buildRoleConfig(['inicio'], 'newAccommodation'));
            setPermissions(); // no perms
            render(<BottomNav />);

            expect(
                screen.queryByRole('button', { name: 'Nuevo alojamiento' })
            ).not.toBeInTheDocument();
        });

        it('does not render FAB when mobile.fab is null', () => {
            setRole(buildRoleConfig(['inicio'], null));
            render(<BottomNav />);

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('renders FAB icon when action has an icon id', () => {
            setRole(buildRoleConfig(['inicio'], 'newAccommodation'));
            setPermissions('accommodation.create');
            render(<BottomNav />);
            expect(screen.getByTestId('icon-AccommodationIcon')).toBeInTheDocument();
        });
    });

    describe('mobile-only visibility', () => {
        it('renders the nav element with md:hidden class for mobile-only display', () => {
            setRole(buildRoleConfig(['inicio']));
            render(<BottomNav />);

            const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
            expect(nav.className).toContain('md:hidden');
        });
    });

    describe('accessibility', () => {
        it('has navigation role with accessible label', () => {
            setRole(buildRoleConfig(['inicio']));
            render(<BottomNav />);
            expect(
                screen.getByRole('navigation', { name: 'Mobile navigation' })
            ).toBeInTheDocument();
        });
    });
});

// @vitest-environment jsdom
/**
 * Tests for QuickCreate Component (SPEC-154 T-025).
 *
 * Covers:
 * - Returns null when no role config (unauthenticated / unknown role).
 * - Returns null when roleConfig.topbar.showQuickCreate === null.
 * - Returns null when no actions remain after permission filtering.
 * - 'all' shows all create actions the user has permission for.
 * - string[] shows only those specific action IDs, permission-filtered.
 * - An action the user lacks permission for is excluded.
 * - The "+" trigger button is rendered and accessible.
 *
 * @see apps/admin/src/components/layout/quick-create/QuickCreate.tsx
 * @see SPEC-154 T-025
 */

import type { RoleConfig } from '@/config/ia/schema';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
    Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
    useLocation: () => ({ pathname: '/' })
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

vi.mock('@/lib/nav-icon-map', () => ({
    resolveNavIcon: ({ iconName }: { iconName: string }) => {
        const MockIcon = (p: Record<string, unknown>) => (
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
// Mock Radix UI DropdownMenu (no portal issues in JSDOM)
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({
        children,
        'aria-label': ariaLabel,
        ...props
    }: {
        children: ReactNode;
        'aria-label'?: string;
    } & Record<string, unknown>) => (
        <button
            type="button"
            aria-label={ariaLabel}
            data-testid="qc-trigger"
            {...props}
        >
            {children}
        </button>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
        <div data-testid="qc-content">{children}</div>
    ),
    DropdownMenuItem: ({
        children,
        onSelect,
        'data-action-id': dataActionId
    }: {
        children: ReactNode;
        onSelect?: () => void;
        'data-action-id'?: string;
    }) => (
        <button
            type="button"
            onClick={onSelect}
            data-action-id={dataActionId}
            data-testid={`qc-item-${dataActionId}`}
        >
            {children}
        </button>
    )
}));

// ---------------------------------------------------------------------------
// Controllable mocks
// ---------------------------------------------------------------------------

let mockRoleConfig: RoleConfig | undefined;
let mockUserPermissions: string[] = [];

vi.mock('@/hooks/use-current-role-config', () => ({
    useCurrentRoleConfig: () => mockRoleConfig
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mockUserPermissions
}));

// ---------------------------------------------------------------------------
// Mock validatedConfig — fixtures inlined (vi.mock is hoisted).
// Fixture consts for assertions are declared AFTER vi.mock blocks.
// ---------------------------------------------------------------------------

vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        sections: {},
        sidebars: {},
        dashboards: {},
        tabs: {},
        createActions: {
            newAccommodation: {
                id: 'newAccommodation',
                label: { es: 'Nuevo alojamiento', en: 'New accommodation', pt: 'Novo alojamento' },
                route: '/accommodations/new',
                icon: 'AccommodationIcon',
                permissions: ['ACCOMMODATION_CREATE']
            },
            newPost: {
                id: 'newPost',
                label: { es: 'Nueva entrada', en: 'New post', pt: 'Nova publicação' },
                route: '/posts/new',
                icon: 'PostIcon',
                permissions: ['POST_CREATE']
            },
            publicAction: {
                id: 'publicAction',
                label: { es: 'Acción pública', en: 'Public action', pt: 'Ação pública' },
                route: '/public/new'
            }
        },
        roles: {}
    }
}));

vi.mock('@/config/ia/permission-bundles', () => ({
    expandPermissions: ({ expressions }: { expressions: readonly string[] }) => {
        const map: Record<string, string> = {
            ACCOMMODATION_CREATE: 'accommodation.create',
            POST_CREATE: 'post.create'
        };
        return expressions.flatMap((expr) => {
            if (expr === '*') return ['accommodation.create', 'post.create'];
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

import { QuickCreate } from '@/components/layout/quick-create/QuickCreate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_TOPBAR = { showSearch: true, accountInMenu: false };

type ShowQuickCreate = 'all' | string[] | null;

function buildRoleConfig(showQuickCreate: ShowQuickCreate): RoleConfig {
    return {
        enabled: true,
        label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
        mainMenu: [],
        dashboard: 'd',
        topbar: { ...BASE_TOPBAR, showQuickCreate },
        mobile: { bottomNav: null, fab: null },
        labelOverrides: {}
    };
}

function setRole(config: RoleConfig | undefined): void {
    mockRoleConfig = config;
}

function setPermissions(...perms: string[]): void {
    mockUserPermissions = [...perms];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuickCreate', () => {
    beforeEach(() => {
        mockRoleConfig = undefined;
        mockUserPermissions = [];
        mockNavigate.mockClear();
    });

    describe('null / no-render cases', () => {
        it('renders nothing when no role config', () => {
            setRole(undefined);
            const { container } = render(<QuickCreate />);
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when showQuickCreate is null', () => {
            setRole(buildRoleConfig(null));
            const { container } = render(<QuickCreate />);
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when all actions are permission-filtered out', () => {
            setRole(buildRoleConfig(['newAccommodation', 'newPost']));
            setPermissions(); // user has no permissions
            const { container } = render(<QuickCreate />);
            expect(container.firstChild).toBeNull();
        });
    });

    describe("showQuickCreate: 'all'", () => {
        it('shows all actions the user has permission for', () => {
            setRole(buildRoleConfig('all'));
            setPermissions('accommodation.create', 'post.create');
            render(<QuickCreate />);

            expect(screen.getByTestId('qc-item-newAccommodation')).toBeInTheDocument();
            expect(screen.getByTestId('qc-item-newPost')).toBeInTheDocument();
        });

        it('includes actions with no permission gate', () => {
            setRole(buildRoleConfig('all'));
            setPermissions(); // no permissions
            render(<QuickCreate />);
            // publicAction has no permission gate → always shown
            expect(screen.getByTestId('qc-item-publicAction')).toBeInTheDocument();
        });

        it('excludes actions the user lacks permission for', () => {
            setRole(buildRoleConfig('all'));
            setPermissions('post.create'); // can post, not accommodation
            render(<QuickCreate />);

            expect(screen.getByTestId('qc-item-newPost')).toBeInTheDocument();
            expect(screen.queryByTestId('qc-item-newAccommodation')).not.toBeInTheDocument();
        });
    });

    describe('showQuickCreate: string[]', () => {
        it('shows only the specified action IDs, permission-filtered', () => {
            setRole(buildRoleConfig(['newAccommodation']));
            setPermissions('accommodation.create');
            render(<QuickCreate />);

            expect(screen.getByTestId('qc-item-newAccommodation')).toBeInTheDocument();
            expect(screen.queryByTestId('qc-item-newPost')).not.toBeInTheDocument();
        });

        it('excludes an action from the list when user lacks permission', () => {
            setRole(buildRoleConfig(['newAccommodation', 'newPost']));
            setPermissions('post.create'); // only post
            render(<QuickCreate />);

            expect(screen.getByTestId('qc-item-newPost')).toBeInTheDocument();
            expect(screen.queryByTestId('qc-item-newAccommodation')).not.toBeInTheDocument();
        });
    });

    describe('UI / accessibility', () => {
        it('renders the trigger button with aria-label', () => {
            setRole(buildRoleConfig('all'));
            setPermissions('accommodation.create');
            render(<QuickCreate />);

            const trigger = screen.getByTestId('qc-trigger');
            expect(trigger).toHaveAttribute('aria-label', 'Quick create');
        });

        it('renders action labels in the dropdown', () => {
            setRole(buildRoleConfig(['newAccommodation']));
            setPermissions('accommodation.create');
            render(<QuickCreate />);
            expect(screen.getByText('Nuevo alojamiento')).toBeInTheDocument();
        });

        it('renders action icons when provided', () => {
            setRole(buildRoleConfig(['newAccommodation']));
            setPermissions('accommodation.create');
            render(<QuickCreate />);
            expect(screen.getByTestId('icon-AccommodationIcon')).toBeInTheDocument();
        });
    });
});

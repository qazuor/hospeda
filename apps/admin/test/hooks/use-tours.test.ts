// @vitest-environment jsdom
/**
 * Tests for use-tours selectors (SPEC-174 T-011).
 *
 * Covers:
 * - useTourById: found / not found.
 * - useToursForRole: null role → empty; single-role match; multi-role membership; 'all'.
 * - useWelcomeTourForRole: returns welcome kind / returns undefined when none.
 * - useContextualTourForRoute: route match via section canonical route; unknown route → undefined.
 * - D14: SUPER_ADMIN matches admin.* contextual tours with roles:['ADMIN','SUPER_ADMIN'].
 *
 * NOTE: vi.mock factories are hoisted above top-level const declarations, so
 * all fixture data used inside vi.mock() factories MUST be inlined directly in
 * those factories — never reference top-level consts from within a factory.
 *
 * @see apps/admin/src/hooks/use-tours.ts
 * @see SPEC-174 §7.2, D14
 */

import type { Tour } from '@/config/ia/tour.schema';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock for validatedConfig — inlined fixtures (hoisting safe)
// ---------------------------------------------------------------------------

vi.mock('@/config/ia/validate', () => {
    const label = (t: string) => ({ es: t, en: t, pt: t });
    const step = (id: string) => ({
        id,
        target: 'center' as const,
        title: label('T'),
        body: label('B')
    });

    return {
        validatedConfig: {
            sections: {
                inicio: {
                    id: 'inicio',
                    label: label('Inicio'),
                    icon: 'HomeIcon',
                    route: '/dashboard',
                    defaultRoute: '/dashboard',
                    sidebar: null
                },
                misAlojamientos: {
                    id: 'misAlojamientos',
                    label: label('Mis alojamientos'),
                    icon: 'AccommodationIcon',
                    route: '/me/accommodations',
                    sidebar: null
                },
                catalogo: {
                    id: 'catalogo',
                    label: label('Catálogo'),
                    icon: 'AccommodationIcon',
                    route: '/accommodations',
                    defaultRoute: '/accommodations',
                    sidebar: null
                }
            },
            sidebars: {},
            dashboards: {},
            tabs: {},
            createActions: {},
            roles: {},
            tours: {
                'host.welcome': {
                    id: 'host.welcome',
                    roles: ['HOST'],
                    kind: 'welcome',
                    version: 1,
                    trigger: 'auto-first-visit',
                    showWelcomeModal: true,
                    steps: [step('s1')]
                },
                'host.misAlojamientos': {
                    id: 'host.misAlojamientos',
                    roles: ['HOST'],
                    kind: 'contextual',
                    route: '/me/accommodations',
                    version: 1,
                    trigger: 'auto-first-visit',
                    showWelcomeModal: false,
                    steps: [step('s1')]
                },
                'admin.welcome': {
                    id: 'admin.welcome',
                    roles: ['ADMIN'],
                    kind: 'welcome',
                    version: 1,
                    trigger: 'auto-first-visit',
                    showWelcomeModal: true,
                    steps: [step('s1')]
                },
                'admin.catalogo': {
                    id: 'admin.catalogo',
                    roles: ['ADMIN', 'SUPER_ADMIN'],
                    kind: 'contextual',
                    route: '/accommodations',
                    version: 1,
                    trigger: 'auto-first-visit',
                    showWelcomeModal: false,
                    steps: [step('s1')]
                },
                'superAdmin.welcome': {
                    id: 'superAdmin.welcome',
                    roles: ['SUPER_ADMIN'],
                    kind: 'welcome',
                    version: 1,
                    trigger: 'auto-first-visit',
                    showWelcomeModal: true,
                    steps: [step('s1')]
                },
                'for-all': {
                    id: 'for-all',
                    roles: 'all',
                    kind: 'contextual',
                    route: '/dashboard',
                    version: 1,
                    trigger: 'auto-first-visit',
                    showWelcomeModal: false,
                    steps: [step('s1')]
                }
            } satisfies Record<string, Tour>
        }
    };
});

// ---------------------------------------------------------------------------
// Controllable mock for useCurrentSection
// ---------------------------------------------------------------------------

type TestSection = {
    id: string;
    route: string;
    defaultRoute?: string;
    sidebar: string | null;
    label: { es: string; en: string; pt: string };
    icon: string;
};

let mockActiveSection: TestSection | undefined = undefined;

vi.mock('@/hooks/use-current-section', () => ({
    useCurrentSection: () => mockActiveSection
}));

// Minimal router mock (useCurrentSection is mocked above so router is not called)
vi.mock('@tanstack/react-router', () => ({
    useLocation: () => ({ pathname: '/' })
}));

// ---------------------------------------------------------------------------
// Controllable mocks for useWelcomeTourPending dependencies (D12 gate)
// ---------------------------------------------------------------------------

let mockAuthRole: string | null = null;
let mockTourStateLoading = false;
let mockHasSeenResult = false;

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: mockAuthRole ? { id: 'u1', role: mockAuthRole } : null })
}));

vi.mock('@/hooks/use-admin-tour-state', () => ({
    useAdminTourState: () => ({
        isLoading: mockTourStateLoading,
        error: null,
        hasSeen: () => mockHasSeenResult,
        markSeen: () => undefined
    })
}));

// ---------------------------------------------------------------------------
// Import the hooks AFTER all mocks
// ---------------------------------------------------------------------------

import {
    useContextualTourForRoute,
    useTourById,
    useToursForRole,
    useWelcomeTourForRole,
    useWelcomeTourPending
} from '@/hooks/use-tours';

// ---------------------------------------------------------------------------
// Fixtures (defined AFTER vi.mock blocks — safe to reference in tests)
// ---------------------------------------------------------------------------

const SECTION_MIS_ALOJAMIENTOS: TestSection = {
    id: 'misAlojamientos',
    label: { es: 'Mis alojamientos', en: 'My accommodations', pt: 'Meus alojamentos' },
    icon: 'AccommodationIcon',
    route: '/me/accommodations',
    sidebar: null
};

const SECTION_CATALOGO: TestSection = {
    id: 'catalogo',
    label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
    icon: 'AccommodationIcon',
    route: '/accommodations',
    defaultRoute: '/accommodations',
    sidebar: null
};

const SECTION_INICIO: TestSection = {
    id: 'inicio',
    label: { es: 'Inicio', en: 'Home', pt: 'Início' },
    icon: 'HomeIcon',
    route: '/dashboard',
    defaultRoute: '/dashboard',
    sidebar: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTourById', () => {
    it('returns the tour for a known id', () => {
        const { result } = renderHook(() => useTourById({ tourId: 'host.welcome' }));
        expect(result.current?.id).toBe('host.welcome');
    });

    it('returns undefined for an unknown id', () => {
        const { result } = renderHook(() => useTourById({ tourId: 'nonexistent' }));
        expect(result.current).toBeUndefined();
    });
});

describe('useToursForRole', () => {
    it('returns empty array when role is null', () => {
        const { result } = renderHook(() => useToursForRole({ role: null }));
        expect(result.current).toHaveLength(0);
    });

    it('returns empty array when role is undefined', () => {
        const { result } = renderHook(() => useToursForRole({ role: undefined }));
        expect(result.current).toHaveLength(0);
    });

    it('returns only tours for the HOST role (plus for-all)', () => {
        const { result } = renderHook(() => useToursForRole({ role: 'HOST' }));
        const ids = result.current.map((t) => t.id);
        expect(ids).toContain('host.welcome');
        expect(ids).toContain('host.misAlojamientos');
        expect(ids).toContain('for-all'); // roles:'all' matches everyone
        expect(ids).not.toContain('admin.welcome');
        expect(ids).not.toContain('admin.catalogo');
    });

    it('returns for-all tour for HOST role (roles:"all")', () => {
        const { result } = renderHook(() => useToursForRole({ role: 'HOST' }));
        expect(result.current.map((t) => t.id)).toContain('for-all');
    });

    it('returns for-all tour for ADMIN role (roles:"all")', () => {
        const { result } = renderHook(() => useToursForRole({ role: 'ADMIN' }));
        expect(result.current.map((t) => t.id)).toContain('for-all');
    });

    it('D14: SUPER_ADMIN receives admin.catalogo (roles includes SUPER_ADMIN)', () => {
        const { result } = renderHook(() => useToursForRole({ role: 'SUPER_ADMIN' }));
        const ids = result.current.map((t) => t.id);
        expect(ids).toContain('admin.catalogo');
        expect(ids).toContain('superAdmin.welcome');
        // HOST-only tours should NOT appear
        expect(ids).not.toContain('host.welcome');
        expect(ids).not.toContain('host.misAlojamientos');
    });

    it('HOST role does not include SUPER_ADMIN welcome tour', () => {
        const { result } = renderHook(() => useToursForRole({ role: 'HOST' }));
        const ids = result.current.map((t) => t.id);
        expect(ids).not.toContain('superAdmin.welcome');
    });

    it('EDITOR role returns only for-all tour (no editor-specific tours in catalog)', () => {
        const { result } = renderHook(() => useToursForRole({ role: 'EDITOR' }));
        const ids = result.current.map((t) => t.id);
        expect(ids).toEqual(['for-all']);
    });
});

describe('useWelcomeTourForRole', () => {
    it('returns the welcome tour for HOST', () => {
        const { result } = renderHook(() => useWelcomeTourForRole({ role: 'HOST' }));
        expect(result.current?.id).toBe('host.welcome');
        expect(result.current?.kind).toBe('welcome');
    });

    it('returns the welcome tour for ADMIN', () => {
        const { result } = renderHook(() => useWelcomeTourForRole({ role: 'ADMIN' }));
        expect(result.current?.id).toBe('admin.welcome');
    });

    it('returns the welcome tour for SUPER_ADMIN', () => {
        const { result } = renderHook(() => useWelcomeTourForRole({ role: 'SUPER_ADMIN' }));
        expect(result.current?.id).toBe('superAdmin.welcome');
    });

    it('returns undefined when role has no welcome tour (EDITOR in this catalog)', () => {
        const { result } = renderHook(() => useWelcomeTourForRole({ role: 'EDITOR' }));
        expect(result.current).toBeUndefined();
    });

    it('returns undefined when role is null', () => {
        const { result } = renderHook(() => useWelcomeTourForRole({ role: null }));
        expect(result.current).toBeUndefined();
    });
});

describe('useContextualTourForRoute', () => {
    beforeEach(() => {
        mockActiveSection = undefined;
    });

    it('returns contextual tour matching the section route', () => {
        mockActiveSection = SECTION_MIS_ALOJAMIENTOS;

        const { result } = renderHook(() =>
            useContextualTourForRoute({ pathname: '/me/accommodations' })
        );

        expect(result.current?.id).toBe('host.misAlojamientos');
        expect(result.current?.kind).toBe('contextual');
    });

    it('uses defaultRoute for matching when available', () => {
        mockActiveSection = SECTION_CATALOGO;

        const { result } = renderHook(() =>
            useContextualTourForRoute({ pathname: '/accommodations' })
        );

        expect(result.current?.id).toBe('admin.catalogo');
    });

    it('returns undefined when no active section', () => {
        mockActiveSection = undefined;

        const { result } = renderHook(() => useContextualTourForRoute({ pathname: '/unknown' }));

        expect(result.current).toBeUndefined();
    });

    it('returns undefined when section route has no matching contextual tour', () => {
        const unknownSection: TestSection = {
            id: 'analytics',
            label: { es: 'Analytics', en: 'Analytics', pt: 'Analytics' },
            icon: 'ChartIcon',
            route: '/analytics/usage',
            sidebar: null
        };
        mockActiveSection = unknownSection;

        const { result } = renderHook(() =>
            useContextualTourForRoute({ pathname: '/analytics/usage' })
        );

        expect(result.current).toBeUndefined();
    });

    it('returns the for-all contextual tour when section canonical route is /dashboard', () => {
        mockActiveSection = SECTION_INICIO;

        const { result } = renderHook(() => useContextualTourForRoute({ pathname: '/dashboard' }));

        expect(result.current?.id).toBe('for-all');
    });
});

describe('useWelcomeTourPending (D12 gate)', () => {
    beforeEach(() => {
        mockAuthRole = null;
        mockTourStateLoading = false;
        mockHasSeenResult = false;
    });

    it('is pessimistically TRUE while the tour state is loading and a welcome tour exists (D12 race guard)', () => {
        // Arrange
        mockAuthRole = 'HOST';
        mockTourStateLoading = true;

        // Act
        const { result } = renderHook(() => useWelcomeTourPending());

        // Assert: suppress What's New until the seen-state is known.
        expect(result.current.welcomeTourPending).toBe(true);
    });

    it('is FALSE while loading when the role has no welcome tour in the catalog', () => {
        // Arrange: EDITOR has no welcome tour in this fixture config.
        mockAuthRole = 'EDITOR';
        mockTourStateLoading = true;

        // Act
        const { result } = renderHook(() => useWelcomeTourPending());

        // Assert: nothing can ever be pending — no need to suppress.
        expect(result.current.welcomeTourPending).toBe(false);
    });

    it('is TRUE when loaded and the welcome tour is unseen', () => {
        // Arrange
        mockAuthRole = 'HOST';
        mockHasSeenResult = false;

        // Act
        const { result } = renderHook(() => useWelcomeTourPending());

        // Assert
        expect(result.current.welcomeTourPending).toBe(true);
    });

    it('is FALSE when loaded and the welcome tour was already seen', () => {
        // Arrange
        mockAuthRole = 'HOST';
        mockHasSeenResult = true;

        // Act
        const { result } = renderHook(() => useWelcomeTourPending());

        // Assert
        expect(result.current.welcomeTourPending).toBe(false);
    });

    it('is FALSE when there is no authenticated user', () => {
        // Act
        const { result } = renderHook(() => useWelcomeTourPending());

        // Assert
        expect(result.current.welcomeTourPending).toBe(false);
    });
});

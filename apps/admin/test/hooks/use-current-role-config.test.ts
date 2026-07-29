// @vitest-environment jsdom
/**
 * Tests for useCurrentRoleConfig.
 *
 * Covers:
 * - Returns undefined when user is null (unauthenticated).
 * - Returns undefined when user has no roles.
 * - Returns undefined when none of user.roles exist in validatedConfig.roles.
 * - Returns undefined when the matching role has enabled: false.
 * - Returns the RoleConfig when one of user.roles matches an enabled role.
 * - HOS-296: multi-hat tie-break — resolves the FIRST held role (in
 *   `validatedConfig.roles`' own key declaration order) that has a config entry.
 * - The returned config is the TEMPLATE (layout) only — not a permission gate.
 *
 * Architecture guarantee: the hook ONLY reads user.roles to pick the template.
 * It never filters items or checks permissions — that is always done by the
 * consumer via useUserPermissions().
 *
 * @see apps/admin/src/hooks/use-current-role-config.ts
 * @see SPEC-154 T-023
 * @see HOS-296
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock useAuthContext so we control user.roles per test.
// ---------------------------------------------------------------------------

const mockAuthContext = {
    isLoading: false,
    isAuthenticated: true,
    user: null as { roles: string[]; permissions: string[] } | null,
    error: null,
    refreshSession: vi.fn(),
    clearSession: vi.fn(),
    signOut: vi.fn()
};

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => mockAuthContext
}));

// ---------------------------------------------------------------------------
// Mock validatedConfig with a minimal, deterministic config.
// NOTE: vi.mock is hoisted, so factories must not reference top-level consts
// defined BELOW the vi.mock call. We inline the fixture objects directly.
// Key declaration order matters here: ADMIN before SPONSOR before HOST —
// this is the multi-hat tie-break order the hook resolves against.
// ---------------------------------------------------------------------------

vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        sections: {},
        sidebars: {},
        dashboards: {},
        tabs: {},
        createActions: {},
        roles: {
            ADMIN: {
                enabled: true,
                label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
                mainMenu: ['inicio'],
                dashboard: 'adminDashboard',
                topbar: { showSearch: true, showQuickCreate: null, accountInMenu: false },
                mobile: { bottomNav: null, fab: null },
                labelOverrides: {}
            },
            SPONSOR: {
                enabled: false,
                label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' },
                labelOverrides: {}
            },
            HOST: {
                enabled: true,
                label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
                mainMenu: ['inicio-host'],
                dashboard: 'hostDashboard',
                topbar: { showSearch: false, showQuickCreate: null, accountInMenu: false },
                mobile: { bottomNav: null, fab: null },
                labelOverrides: {}
            }
        }
    }
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useCurrentRoleConfig } from '@/hooks/use-current-role-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUser(user: { roles: string[]; permissions: string[] } | null): void {
    mockAuthContext.user = user;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCurrentRoleConfig', () => {
    describe('when user is not authenticated', () => {
        it('returns undefined when user is null', () => {
            setUser(null);
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current).toBeUndefined();
        });

        it('returns undefined when user has no roles', () => {
            setUser({ roles: [], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current).toBeUndefined();
        });
    });

    describe('when user roles do not match config', () => {
        it('returns undefined for an unknown role', () => {
            setUser({ roles: ['UNKNOWN_ROLE'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current).toBeUndefined();
        });

        it('returns undefined for USER role (not in admin IA)', () => {
            setUser({ roles: ['USER'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current).toBeUndefined();
        });
    });

    describe('when role is disabled', () => {
        it('returns undefined for a disabled role (enabled: false)', () => {
            setUser({ roles: ['SPONSOR'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current).toBeUndefined();
        });
    });

    describe('when role is enabled', () => {
        it('returns the RoleConfig for a matching enabled role', () => {
            setUser({ roles: ['ADMIN'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current).toBeDefined();
            expect(result.current?.enabled).toBe(true);
        });

        it('returned config contains mainMenu from the template', () => {
            setUser({ roles: ['ADMIN'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current?.mainMenu).toEqual(['inicio']);
        });

        it('returned config contains topbar from the template', () => {
            setUser({ roles: ['ADMIN'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current?.topbar?.showSearch).toBe(true);
        });
    });

    describe('HOS-296 — multi-hat tie-break', () => {
        it('resolves ADMIN over HOST when the user holds both (declaration order)', () => {
            setUser({ roles: ['HOST', 'ADMIN'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            // ADMIN is declared before HOST in validatedConfig.roles, so it wins
            // regardless of the order the roles appear in the user's own array.
            expect(result.current?.mainMenu).toEqual(['inicio']);
        });

        it('falls through to the next held role when the first-declared one has no config entry', () => {
            setUser({ roles: ['UNKNOWN_ROLE', 'HOST'], permissions: [] });
            const { result } = renderHook(() => useCurrentRoleConfig());
            expect(result.current?.mainMenu).toEqual(['inicio-host']);
        });
    });

    describe('architecture guarantee', () => {
        it('two users with SAME role but DIFFERENT permissions get the SAME template', () => {
            // User 1: ADMIN with no permissions
            setUser({ roles: ['ADMIN'], permissions: [] });
            const { result: result1 } = renderHook(() => useCurrentRoleConfig());

            // User 2: ADMIN with many permissions
            setUser({ roles: ['ADMIN'], permissions: ['accommodation.viewAll', 'billing.manage'] });
            const { result: result2 } = renderHook(() => useCurrentRoleConfig());

            // Same template regardless of permissions — role selects the layout template only.
            expect(result1.current).toEqual(result2.current);
        });
    });
});

/**
 * @file roles.test.ts
 * @description Unit tests for role-set-to-auth-group mapping helpers.
 *
 * Regression coverage for SPEC-243 T-005 (the mobile role gate must route
 * HOST/ADMIN/SUPER_ADMIN to `(host)`, all other authenticated roles to
 * `(tourist)`, and unauthenticated users to `(auth)`) plus HOS-296 AC-9:
 * dropping the scalar `users.role` must NOT silently route every user —
 * hosts included — to `(tourist)`.
 *
 * The AC-9 assertions come in two halves, and both matter:
 * - a host with a resolved role SET lands in `(host)`;
 * - a host whose role set is still LOADING lands nowhere at all (`null`),
 *   never in `(tourist)`. A transient tourist shell for a host is the same
 *   bug wearing a different hat.
 */
import { describe, expect, it } from 'vitest';
import type { ResolveAuthGroupInput } from './roles';
import { hasHostRole, resolveAuthGroup } from './roles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a resolver input with sensible defaults for the case under test. */
const input = (overrides: Partial<ResolveAuthGroupInput> = {}): ResolveAuthGroupInput => ({
    sessionStatus: 'authenticated',
    rolesStatus: 'ready',
    roles: [],
    ...overrides
});

// ---------------------------------------------------------------------------
// hasHostRole
// ---------------------------------------------------------------------------

describe('hasHostRole', () => {
    it('returns true for a set containing HOST', () => {
        // Arrange / Act / Assert
        expect(hasHostRole(['HOST'])).toBe(true);
    });

    it('returns true for a set containing ADMIN', () => {
        expect(hasHostRole(['ADMIN'])).toBe(true);
    });

    it('returns true for a set containing SUPER_ADMIN', () => {
        expect(hasHostRole(['SUPER_ADMIN'])).toBe(true);
    });

    it('returns true when a host role is held alongside non-host roles', () => {
        // The multi-hat case HOS-296 exists for: USER + COMMERCE_OWNER + HOST.
        expect(hasHostRole(['USER', 'COMMERCE_OWNER', 'HOST'])).toBe(true);
    });

    it('returns false for USER alone', () => {
        expect(hasHostRole(['USER'])).toBe(false);
    });

    it('returns false for EDITOR (divergence from web — mobile sends to tourist)', () => {
        expect(hasHostRole(['EDITOR'])).toBe(false);
    });

    it('returns false for CLIENT_MANAGER (divergence from web — mobile sends to tourist)', () => {
        expect(hasHostRole(['CLIENT_MANAGER'])).toBe(false);
    });

    it('returns false for SPONSOR', () => {
        expect(hasHostRole(['SPONSOR'])).toBe(false);
    });

    it('returns false for COMMERCE_OWNER', () => {
        expect(hasHostRole(['COMMERCE_OWNER'])).toBe(false);
    });

    it('returns false for GUEST', () => {
        expect(hasHostRole(['GUEST'])).toBe(false);
    });

    it('returns false for SYSTEM', () => {
        expect(hasHostRole(['SYSTEM'])).toBe(false);
    });

    it('returns false for an empty set', () => {
        expect(hasHostRole([])).toBe(false);
    });

    it('returns false for null', () => {
        expect(hasHostRole(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(hasHostRole(undefined)).toBe(false);
    });

    it('returns false for a set of unknown/future roles only', () => {
        expect(hasHostRole(['UNKNOWN_FUTURE_ROLE', 'ANOTHER_ONE'])).toBe(false);
    });

    it('is case-sensitive — lowercase role strings do not match', () => {
        // Every real role value is uppercase (RoleEnum.HOST === 'HOST').
        expect(hasHostRole(['host'])).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// resolveAuthGroup — session gate
// ---------------------------------------------------------------------------

describe('resolveAuthGroup — session state', () => {
    it('returns null while the session is still restoring', () => {
        expect(resolveAuthGroup(input({ sessionStatus: 'loading' })).group).toBeNull();
    });

    it('returns null while the session is restoring even if roles already resolved', () => {
        expect(
            resolveAuthGroup({
                sessionStatus: 'loading',
                rolesStatus: 'ready',
                roles: ['HOST']
            }).group
        ).toBeNull();
    });

    it('returns (auth) when there is no session', () => {
        expect(resolveAuthGroup(input({ sessionStatus: 'unauthenticated' })).group).toBe('(auth)');
    });

    it('returns (auth) when there is no session even if roles are still loading', () => {
        // No session means no waiting: the destination does not depend on roles.
        expect(
            resolveAuthGroup({
                sessionStatus: 'unauthenticated',
                rolesStatus: 'loading',
                roles: undefined
            }).group
        ).toBe('(auth)');
    });

    it('returns (auth) when there is no session even if a host role set is present', () => {
        expect(
            resolveAuthGroup({
                sessionStatus: 'unauthenticated',
                rolesStatus: 'ready',
                roles: ['HOST', 'ADMIN']
            }).group
        ).toBe('(auth)');
    });
});

// ---------------------------------------------------------------------------
// resolveAuthGroup — AC-9
// ---------------------------------------------------------------------------

describe('resolveAuthGroup — HOS-296 AC-9 (a host must not land in (tourist))', () => {
    it('returns (host) for a resolved role set containing HOST', () => {
        expect(resolveAuthGroup(input({ roles: ['USER', 'HOST'] })).group).toBe('(host)');
    });

    it('returns (host) for a resolved role set containing ADMIN', () => {
        expect(resolveAuthGroup(input({ roles: ['USER', 'ADMIN'] })).group).toBe('(host)');
    });

    it('returns (host) for a resolved role set containing SUPER_ADMIN', () => {
        expect(resolveAuthGroup(input({ roles: ['SUPER_ADMIN'] })).group).toBe('(host)');
    });

    it('returns (host) for a multi-hat host (HOST + COMMERCE_OWNER)', () => {
        // OQ-2 is deferred: dual-hat navigation does not exist, and the
        // 1-of-3 mapping resolves a multi-hat user to (host).
        expect(resolveAuthGroup(input({ roles: ['USER', 'HOST', 'COMMERCE_OWNER'] })).group).toBe(
            '(host)'
        );
    });

    it('returns null — NOT (tourist) — while a host session is still loading its roles', () => {
        // The load state must not resolve to the tourist shell, not even for
        // one frame: the gate holds the splash instead.
        const result = resolveAuthGroup({
            sessionStatus: 'authenticated',
            rolesStatus: 'loading',
            roles: undefined
        });
        expect(result.group).toBeNull();
        expect(result.group).not.toBe('(tourist)');
    });

    it('returns null while roles load even if a stale role set is passed in', () => {
        // `roles` is only meaningful when `rolesStatus` is `ready`.
        expect(
            resolveAuthGroup({
                sessionStatus: 'authenticated',
                rolesStatus: 'loading',
                roles: ['HOST']
            }).group
        ).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// resolveAuthGroup — tourist + failure fallback
// ---------------------------------------------------------------------------

describe('resolveAuthGroup — authenticated non-host', () => {
    it('returns (tourist) for USER', () => {
        expect(resolveAuthGroup(input({ roles: ['USER'] })).group).toBe('(tourist)');
    });

    it('returns (tourist) for EDITOR', () => {
        expect(resolveAuthGroup(input({ roles: ['USER', 'EDITOR'] })).group).toBe('(tourist)');
    });

    it('returns (tourist) for CLIENT_MANAGER', () => {
        expect(resolveAuthGroup(input({ roles: ['CLIENT_MANAGER'] })).group).toBe('(tourist)');
    });

    it('returns (tourist) for SPONSOR', () => {
        expect(resolveAuthGroup(input({ roles: ['SPONSOR'] })).group).toBe('(tourist)');
    });

    it('returns (tourist) for COMMERCE_OWNER without a host role', () => {
        expect(resolveAuthGroup(input({ roles: ['USER', 'COMMERCE_OWNER'] })).group).toBe(
            '(tourist)'
        );
    });

    it('returns (tourist) for an unknown/future role (never leaves a user without a shell)', () => {
        expect(resolveAuthGroup(input({ roles: ['UNKNOWN_FUTURE_ROLE'] })).group).toBe('(tourist)');
    });

    it('returns (tourist) for an empty resolved role set', () => {
        expect(resolveAuthGroup(input({ roles: [] })).group).toBe('(tourist)');
    });

    it('returns (tourist) for a null resolved role set', () => {
        expect(resolveAuthGroup(input({ roles: null })).group).toBe('(tourist)');
    });
});

describe('resolveAuthGroup — roles failed to load', () => {
    it('falls back to (tourist), the least-privileged authenticated shell', () => {
        expect(
            resolveAuthGroup({
                sessionStatus: 'authenticated',
                rolesStatus: 'error',
                roles: undefined
            }).group
        ).toBe('(tourist)');
    });

    it('never grants (host) on a failed fetch, even with a stale host role set', () => {
        expect(
            resolveAuthGroup({
                sessionStatus: 'authenticated',
                rolesStatus: 'error',
                roles: ['HOST']
            }).group
        ).toBe('(tourist)');
    });
});

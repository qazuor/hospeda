/**
 * @file roles.test.ts
 * @description Unit tests for role-to-auth-group mapping helpers.
 *
 * Regression coverage for SPEC-243 T-005: the mobile role gate must route
 * HOST/ADMIN/SUPER_ADMIN to (host), all other authenticated roles to (tourist),
 * and unauthenticated users to (auth). Unknown/future roles must default to
 * (tourist) — never leave a logged-in user with no shell.
 */
import { describe, expect, it } from 'vitest';
import { isHostRole, resolveAuthGroup } from './roles';

// ---------------------------------------------------------------------------
// isHostRole
// ---------------------------------------------------------------------------

describe('isHostRole', () => {
    it('returns true for HOST', () => {
        // Arrange / Act / Assert
        expect(isHostRole('HOST')).toBe(true);
    });

    it('returns true for ADMIN', () => {
        expect(isHostRole('ADMIN')).toBe(true);
    });

    it('returns true for SUPER_ADMIN', () => {
        expect(isHostRole('SUPER_ADMIN')).toBe(true);
    });

    it('returns false for USER', () => {
        expect(isHostRole('USER')).toBe(false);
    });

    it('returns false for EDITOR (divergence from web — mobile sends to tourist)', () => {
        expect(isHostRole('EDITOR')).toBe(false);
    });

    it('returns false for CLIENT_MANAGER (divergence from web — mobile sends to tourist)', () => {
        expect(isHostRole('CLIENT_MANAGER')).toBe(false);
    });

    it('returns false for SPONSOR', () => {
        expect(isHostRole('SPONSOR')).toBe(false);
    });

    it('returns false for GUEST', () => {
        expect(isHostRole('GUEST')).toBe(false);
    });

    it('returns false for SYSTEM', () => {
        expect(isHostRole('SYSTEM')).toBe(false);
    });

    it('returns false for null', () => {
        expect(isHostRole(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isHostRole(undefined)).toBe(false);
    });

    it('returns false for an empty string', () => {
        expect(isHostRole('')).toBe(false);
    });

    it('returns false for an unknown/future role string', () => {
        expect(isHostRole('UNKNOWN_FUTURE_ROLE')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// resolveAuthGroup
// ---------------------------------------------------------------------------

describe('resolveAuthGroup', () => {
    // --- No session → (auth) ---

    it('returns (auth) when hasSession is false, role is null', () => {
        // Arrange / Act / Assert
        expect(resolveAuthGroup(null, false)).toBe('(auth)');
    });

    it('returns (auth) when hasSession is false, role is undefined', () => {
        expect(resolveAuthGroup(undefined, false)).toBe('(auth)');
    });

    it('returns (auth) when hasSession is false even if role looks like a host role', () => {
        // Session is required — role alone is not enough
        expect(resolveAuthGroup('HOST', false)).toBe('(auth)');
        expect(resolveAuthGroup('ADMIN', false)).toBe('(auth)');
        expect(resolveAuthGroup('SUPER_ADMIN', false)).toBe('(auth)');
    });

    // --- Host roles → (host) ---

    it('returns (host) for HOST with session', () => {
        expect(resolveAuthGroup('HOST', true)).toBe('(host)');
    });

    it('returns (host) for ADMIN with session', () => {
        expect(resolveAuthGroup('ADMIN', true)).toBe('(host)');
    });

    it('returns (host) for SUPER_ADMIN with session', () => {
        expect(resolveAuthGroup('SUPER_ADMIN', true)).toBe('(host)');
    });

    // --- Tourist roles → (tourist) ---

    it('returns (tourist) for USER with session', () => {
        expect(resolveAuthGroup('USER', true)).toBe('(tourist)');
    });

    it('returns (tourist) for EDITOR with session', () => {
        expect(resolveAuthGroup('EDITOR', true)).toBe('(tourist)');
    });

    it('returns (tourist) for CLIENT_MANAGER with session', () => {
        expect(resolveAuthGroup('CLIENT_MANAGER', true)).toBe('(tourist)');
    });

    it('returns (tourist) for SPONSOR with session', () => {
        expect(resolveAuthGroup('SPONSOR', true)).toBe('(tourist)');
    });

    it('returns (tourist) for GUEST with session (edge: GUEST should not have session, but if it does)', () => {
        expect(resolveAuthGroup('GUEST', true)).toBe('(tourist)');
    });

    // --- Default-to-tourist for unknown roles ---

    it('returns (tourist) for an unknown/future role with session (never leaves user without shell)', () => {
        expect(resolveAuthGroup('UNKNOWN_FUTURE_ROLE', true)).toBe('(tourist)');
    });

    it('returns (tourist) for null role with session (role not yet loaded — conservative default)', () => {
        expect(resolveAuthGroup(null, true)).toBe('(tourist)');
    });

    it('returns (tourist) for empty string role with session', () => {
        expect(resolveAuthGroup('', true)).toBe('(tourist)');
    });
});

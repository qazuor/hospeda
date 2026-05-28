/**
 * Unit tests for `requireBillingAccess`.
 *
 * The function is a thin wrapper that checks a single permission and either
 * returns `void` (allowed) or throws a TanStack Router redirect (denied).
 *
 * Strategy: mock `@tanstack/react-router`'s `redirect` so we can assert
 * it was called with `{ to: '/auth/forbidden' }` without spinning up a
 * full router instance.  The mock `redirect` throws an object with a
 * recognisable shape so `requireBillingAccess` behaves identically to the
 * real implementation (i.e. it throws, stopping execution).
 *
 * SPEC-164 T-006 / AC-8 / AC-9.
 */

import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router's `redirect` BEFORE importing the module under
// test.  vi.mock is hoisted to the top of the file — the factory must NOT
// reference variables declared with `const`/`let` outside it (TDZ).
// We expose the spy via the module object instead.
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', async (importOriginal) => {
    const original = await importOriginal<typeof import('@tanstack/react-router')>();
    return {
        ...original,
        // Throw the descriptor so the guard's `throw redirect(...)` call
        // truly aborts execution (mirrors real TanStack Router behaviour).
        redirect: vi.fn((opts: Record<string, unknown>) => {
            throw { isRedirect: true, ...opts };
        })
    };
});

// Import AFTER vi.mock so the mocked version is used.
import * as TanStackRouter from '@tanstack/react-router';
import { requireBillingAccess } from '../../src/lib/billing-access';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeContext = (permissions: string[]): AuthState => ({
    userId: 'user-123',
    isAuthenticated: true,
    role: 'ADMIN',
    permissions,
    passwordChangeRequired: false,
    displayName: 'Test User',
    email: 'test@example.com',
    avatar: null,
    emailVerified: true
});

// Typed spy reference resolved at runtime (after mocks are set up).
const getRedirectSpy = () => TanStackRouter.redirect as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireBillingAccess', () => {
    beforeEach(() => {
        getRedirectSpy().mockClear();
    });

    it('throws a redirect to /auth/forbidden when BILLING_READ_ALL is absent (ADMIN role)', () => {
        // Arrange: ADMIN context without BILLING_READ_ALL (post T-002 seed revoke)
        const context = makeContext([PermissionEnum.ACCESS_PANEL_ADMIN]);

        // Act & Assert: expect the thrown redirect
        expect(() => requireBillingAccess(context)).toThrow();
        expect(getRedirectSpy()).toHaveBeenCalledOnce();
        expect(getRedirectSpy()).toHaveBeenCalledWith({ to: '/auth/forbidden' });
    });

    it('throws a redirect when the permissions array is empty', () => {
        const context = makeContext([]);

        expect(() => requireBillingAccess(context)).toThrow();
        expect(getRedirectSpy()).toHaveBeenCalledOnce();
        expect(getRedirectSpy()).toHaveBeenCalledWith({ to: '/auth/forbidden' });
    });

    it('does NOT throw when BILLING_READ_ALL is present (SUPER_ADMIN effective permissions)', () => {
        // Arrange: SUPER_ADMIN's session includes every PermissionEnum value via
        // the actor.ts runtime bypass — BILLING_READ_ALL is always in the array.
        const context = makeContext([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_READ_ALL
        ]);

        // Act & Assert: should return void without throwing or calling redirect
        expect(() => requireBillingAccess(context)).not.toThrow();
        expect(getRedirectSpy()).not.toHaveBeenCalled();
    });

    it('does NOT throw when the context has the full PermissionEnum set (SUPER_ADMIN bypass)', () => {
        // Simulate the complete permissions array the actor.ts bypass injects.
        const context = makeContext(Object.values(PermissionEnum));

        expect(() => requireBillingAccess(context)).not.toThrow();
        expect(getRedirectSpy()).not.toHaveBeenCalled();
    });

    it('throws when BILLING_READ_ALL is absent even if other billing permissions are present', () => {
        // BILLING_MANAGE alone is not enough — BILLING_READ_ALL is the gate.
        const context = makeContext([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_MANAGE
        ]);

        expect(() => requireBillingAccess(context)).toThrow();
        expect(getRedirectSpy()).toHaveBeenCalledWith({ to: '/auth/forbidden' });
    });

    it('accepts a plain object context (the raw TanStack Router context type)', () => {
        // requireBillingAccess casts `context` to AuthState internally; passing
        // a plain object with the right shape must work without TypeScript help.
        const context: unknown = {
            permissions: [PermissionEnum.BILLING_READ_ALL]
        };

        expect(() => requireBillingAccess(context)).not.toThrow();
        expect(getRedirectSpy()).not.toHaveBeenCalled();
    });

    it('throws when the context object has no permissions property', () => {
        const context: unknown = {};

        expect(() => requireBillingAccess(context)).toThrow();
        expect(getRedirectSpy()).toHaveBeenCalledWith({ to: '/auth/forbidden' });
    });
});

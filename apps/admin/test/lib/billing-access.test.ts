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

    // -------------------------------------------------------------------------
    // AC-8 / AC-9 — Graceful-degradation contract
    //
    // These tests encode the semantics of:
    //   AC-8: ADMIN direct-URL → beforeLoad guard rejects access (redirect fires)
    //         BEFORE the page component renders — i.e. the function THROWS,
    //         meaning control-flow never returns, so the component body is never
    //         reached.
    //   AC-9: ADMIN hitting a /billing/* URL directly → NO unhandled exception,
    //         NO 500, NO partial-data render, NO broken layout — a clean rejected
    //         state only.  The throw MUST be a TanStack Router redirect object,
    //         NOT a plain Error (which would bubble up as an unhandled exception
    //         and surface as a 500 / ErrorBoundary crash in SSR).
    //
    // Full in-browser direct-URL degradation (browser address bar → SSR render
    // → redirect response) is validated by the manual / staging smoke test
    // documented in .qtm/specs/SPEC-164-admin-billing-super-only/spec.md §8.
    // -------------------------------------------------------------------------

    describe('AC-8: redirect fires before component renders (control-flow never returns)', () => {
        it('ADMIN context — function throws, so the component body is never reached', () => {
            // Arrange: ADMIN context without BILLING_READ_ALL (T-002 seed revoke)
            const context = makeContext([PermissionEnum.ACCESS_PANEL_ADMIN]);
            let componentWouldRender = false;

            // Act: simulate what a beforeLoad callback does — if it throws,
            // the component render path is skipped entirely
            try {
                requireBillingAccess(context);
                // This line is the stand-in for "component starts rendering"
                componentWouldRender = true;
            } catch {
                // redirect was thrown — component never rendered
            }

            // Assert: the line after the call was never reached
            expect(componentWouldRender).toBe(false);
        });

        it('ADMIN context with no permissions — component never renders', () => {
            const context = makeContext([]);
            let componentWouldRender = false;

            try {
                requireBillingAccess(context);
                componentWouldRender = true;
            } catch {
                // swallowed — redirect thrown as expected
            }

            expect(componentWouldRender).toBe(false);
        });

        it('SUPER_ADMIN context — function returns, component IS allowed to render', () => {
            // Inverse: when BILLING_READ_ALL is present the function returns void,
            // control-flow continues, and the component would render.
            const context = makeContext([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_READ_ALL
            ]);
            let componentWouldRender = false;

            try {
                requireBillingAccess(context);
                componentWouldRender = true;
            } catch {
                // should NOT reach here
            }

            expect(componentWouldRender).toBe(true);
        });
    });

    describe('AC-9: thrown value is a redirect object, never a plain Error (no 500 / unhandled exception)', () => {
        it('ADMIN context — thrown value has isRedirect:true (TanStack Router redirect shape)', () => {
            // The real `redirect()` from @tanstack/react-router returns an object
            // with `{ isRedirect: true, ... }` which the router handles as a
            // navigation instruction.  Our mock mirrors this by throwing
            // `{ isRedirect: true, ...opts }`.  This test asserts that what
            // escapes requireBillingAccess is THAT object — not a generic Error.
            const context = makeContext([PermissionEnum.ACCESS_PANEL_ADMIN]);
            let thrownValue: unknown;

            try {
                requireBillingAccess(context);
            } catch (e) {
                thrownValue = e;
            }

            // AC-9 core assertion: thrown value is NOT a plain Error
            // (a plain Error would bubble to the framework as an unhandled
            // exception and surface as a 500 or broken layout)
            expect(thrownValue).not.toBeInstanceOf(Error);

            // It IS a redirect descriptor with the correct destination
            expect(thrownValue).toMatchObject({ isRedirect: true, to: '/auth/forbidden' });
        });

        it('ADMIN context with no permissions — same redirect shape, no plain Error', () => {
            const context = makeContext([]);
            let thrownValue: unknown;

            try {
                requireBillingAccess(context);
            } catch (e) {
                thrownValue = e;
            }

            expect(thrownValue).not.toBeInstanceOf(Error);
            expect(thrownValue).toMatchObject({ isRedirect: true, to: '/auth/forbidden' });
        });

        it('ADMIN context with other billing permissions but NOT BILLING_READ_ALL — clean redirect, no 500', () => {
            // Even if the ADMIN somehow has partial billing perms, the guard
            // MUST throw a redirect — not an Error — so no 500 escapes.
            const context = makeContext([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_MANAGE
            ]);
            let thrownValue: unknown;

            try {
                requireBillingAccess(context);
            } catch (e) {
                thrownValue = e;
            }

            expect(thrownValue).not.toBeInstanceOf(Error);
            expect(thrownValue).toMatchObject({ isRedirect: true, to: '/auth/forbidden' });
        });

        it('SUPER_ADMIN context — function does NOT throw at all (no redirect, no error)', () => {
            // AC-9 inverse: SUPER_ADMIN must pass through cleanly — no throw means
            // no redirect AND no unhandled exception.
            const context = makeContext(Object.values(PermissionEnum));
            let thrownValue: unknown;
            let threw = false;

            try {
                requireBillingAccess(context);
            } catch (e) {
                threw = true;
                thrownValue = e;
            }

            expect(threw).toBe(false);
            expect(thrownValue).toBeUndefined();
        });
    });
});

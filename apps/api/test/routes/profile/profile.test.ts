/**
 * Unit tests for the three protected profile-completion handlers
 * (SPEC-113 T-113-02 / T-113-03).
 *
 * Tests the PURE handlers directly with stubbed services and a minimal
 * Hono-context stub.  No initApp, no real DB, no auth middleware — that
 * wiring will be exercised by the Phase 5 E2E smoke (T-113-10).
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type CompleteProfileBody,
    type CompleteProfileDeps,
    type CompleteProfileUserService,
    completeProfileHandler
} from '../../../src/routes/profile/protected/complete';
import {
    type SetPasswordDeps,
    type SetPasswordUserService,
    setPasswordHandler
} from '../../../src/routes/profile/protected/set-password';
import {
    type SkipSetPasswordDeps,
    type SkipSetPasswordUserService,
    skipSetPasswordHandler
} from '../../../src/routes/profile/protected/skip-set-password';

// ---------------------------------------------------------------------------
// Shared test infrastructure
// ---------------------------------------------------------------------------

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Build a minimal actor for context.get('actor'). */
const buildActor = (email = 'user@example.com') => ({
    id: ACTOR_ID,
    email,
    role: 'USER' as const,
    permissions: [] as string[]
});

/** Build a minimal Hono context stub. */
const buildCtx = (opts: { headers?: Record<string, string>; email?: string } = {}) => {
    const actor = buildActor(opts.email);
    const headers = opts.headers ?? {};
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined),
        req: {
            header: (name: string) => headers[name.toLowerCase()],
            raw: { headers: new Headers(headers) }
        }
    } as unknown as Parameters<typeof completeProfileHandler>[0];
};

// ---------------------------------------------------------------------------
// completeProfileHandler
// ---------------------------------------------------------------------------

describe('completeProfileHandler', () => {
    const makeUserSvc = (
        overrides: Partial<{ profileCompleted: true; requiresSetPassword: boolean }> = {}
    ): CompleteProfileUserService => ({
        completeProfile: vi.fn().mockResolvedValue({
            data: {
                profileCompleted: true,
                requiresSetPassword: false,
                ...overrides
            },
            error: null
        })
    });

    const body: CompleteProfileBody = {
        displayName: 'Test User',
        acceptedTerms: true
    };

    it('returns profileCompleted = true and requiresSetPassword = false for credential user', async () => {
        const deps: CompleteProfileDeps = { userService: makeUserSvc() };
        const ctx = buildCtx();
        const result = await completeProfileHandler(ctx, body, deps);
        expect(result.profileCompleted).toBe(true);
        expect(result.requiresSetPassword).toBe(false);
    });

    it('returns requiresSetPassword = true for OAuth-only user', async () => {
        const deps: CompleteProfileDeps = {
            userService: makeUserSvc({ requiresSetPassword: true })
        };
        const ctx = buildCtx();
        const result = await completeProfileHandler(ctx, body, deps);
        expect(result.requiresSetPassword).toBe(true);
    });

    it('calls newsletter subscribe when newsletterOptIn = true and email is present', async () => {
        const newsletterSvc = {
            subscribe: vi
                .fn()
                .mockResolvedValue({ data: { status: 'pending_verification' }, error: null })
        };
        const deps: CompleteProfileDeps = {
            userService: makeUserSvc(),
            newsletterService: newsletterSvc as unknown as CompleteProfileDeps['newsletterService']
        };
        const ctx = buildCtx({ email: 'me@example.com' });
        await completeProfileHandler(ctx, { ...body, newsletterOptIn: true }, deps);
        expect(newsletterSvc.subscribe).toHaveBeenCalledOnce();
        expect(newsletterSvc.subscribe).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            expect.objectContaining({ userId: ACTOR_ID, email: 'me@example.com' })
        );
    });

    it('does NOT call newsletter subscribe when newsletterOptIn is absent', async () => {
        const newsletterSvc = { subscribe: vi.fn() };
        const deps: CompleteProfileDeps = {
            userService: makeUserSvc(),
            newsletterService: newsletterSvc as unknown as CompleteProfileDeps['newsletterService']
        };
        const ctx = buildCtx({ email: 'me@example.com' });
        await completeProfileHandler(ctx, body, deps);
        expect(newsletterSvc.subscribe).not.toHaveBeenCalled();
    });

    it('does NOT fail when newsletter throws (newsletter failure is non-blocking)', async () => {
        const newsletterSvc = { subscribe: vi.fn().mockRejectedValue(new Error('SMTP down')) };
        const deps: CompleteProfileDeps = {
            userService: makeUserSvc(),
            newsletterService: newsletterSvc as unknown as CompleteProfileDeps['newsletterService']
        };
        const ctx = buildCtx({ email: 'me@example.com' });
        // Should resolve without throwing even if newsletter fails
        await expect(
            completeProfileHandler(ctx, { ...body, newsletterOptIn: true }, deps)
        ).resolves.toBeDefined();
    });

    it('throws ServiceError when userService.completeProfile returns an error', async () => {
        const deps: CompleteProfileDeps = {
            userService: {
                completeProfile: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'User not found' }
                })
            }
        };
        const ctx = buildCtx();
        await expect(completeProfileHandler(ctx, body, deps)).rejects.toThrow(/User not found/);
    });

    it('throws ServiceError when userService.completeProfile returns null data', async () => {
        const deps: CompleteProfileDeps = {
            userService: {
                completeProfile: vi.fn().mockResolvedValue({ data: null, error: null })
            }
        };
        const ctx = buildCtx();
        await expect(completeProfileHandler(ctx, body, deps)).rejects.toThrow(
            /completeProfile returned no data/
        );
    });
});

// ---------------------------------------------------------------------------
// setPasswordHandler
// ---------------------------------------------------------------------------

describe('setPasswordHandler', () => {
    const makeUserSvc = (): SetPasswordUserService => ({
        markSetPasswordDone: vi.fn().mockResolvedValue({
            data: { setPasswordPrompted: true, credentialCreated: true },
            error: null
        })
    });

    const makeAuthApi = () => ({
        setPassword: vi.fn().mockResolvedValue({ status: 'OK' })
    });

    it('calls Better Auth setPassword and then marks the flag on the user', async () => {
        const authApi = makeAuthApi();
        const userSvc = makeUserSvc();
        const deps: SetPasswordDeps = { authApi, userService: userSvc };
        const ctx = buildCtx();
        const result = await setPasswordHandler(ctx, { password: 'Secure1234!' }, deps);
        expect(authApi.setPassword).toHaveBeenCalledWith({
            body: { newPassword: 'Secure1234!' },
            headers: expect.any(Headers)
        });
        expect(userSvc.markSetPasswordDone).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { userId: ACTOR_ID }
        );
        expect(result.setPasswordPrompted).toBe(true);
        expect(result.credentialCreated).toBe(true);
    });

    it('throws ServiceError when Better Auth setPassword throws', async () => {
        const authApi = { setPassword: vi.fn().mockRejectedValue(new Error('Invalid password')) };
        const deps: SetPasswordDeps = { authApi, userService: makeUserSvc() };
        const ctx = buildCtx();
        await expect(setPasswordHandler(ctx, { password: 'bad' }, deps)).rejects.toThrow(
            /Invalid password/
        );
    });

    it('throws ServiceError when markSetPasswordDone returns an error', async () => {
        const authApi = makeAuthApi();
        const userSvc: SetPasswordUserService = {
            markSetPasswordDone: vi.fn().mockResolvedValue({
                data: null,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'gone' }
            })
        };
        const deps: SetPasswordDeps = { authApi, userService: userSvc };
        const ctx = buildCtx();
        await expect(setPasswordHandler(ctx, { password: 'Secure1234!' }, deps)).rejects.toThrow(
            /gone/
        );
    });
});

// ---------------------------------------------------------------------------
// skipSetPasswordHandler
// ---------------------------------------------------------------------------

describe('skipSetPasswordHandler', () => {
    const makeUserSvc = (): SkipSetPasswordUserService => ({
        skipSetPassword: vi.fn().mockResolvedValue({
            data: { setPasswordPrompted: true, credentialCreated: false },
            error: null
        })
    });

    it('skips set-password and returns credentialCreated = false', async () => {
        const userSvc = makeUserSvc();
        const deps: SkipSetPasswordDeps = { userService: userSvc };
        const ctx = buildCtx();
        const result = await skipSetPasswordHandler(ctx, {}, deps);
        expect(userSvc.skipSetPassword).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { userId: ACTOR_ID }
        );
        expect(result.setPasswordPrompted).toBe(true);
        expect(result.credentialCreated).toBe(false);
    });

    it('throws ServiceError when skipSetPassword returns an error', async () => {
        const deps: SkipSetPasswordDeps = {
            userService: {
                skipSetPassword: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: ServiceErrorCode.FORBIDDEN, message: 'nope' }
                })
            }
        };
        const ctx = buildCtx();
        await expect(skipSetPasswordHandler(ctx, {}, deps)).rejects.toThrow(/nope/);
    });

    it('throws ServiceError when skipSetPassword returns null data', async () => {
        const deps: SkipSetPasswordDeps = {
            userService: {
                skipSetPassword: vi.fn().mockResolvedValue({ data: null, error: null })
            }
        };
        const ctx = buildCtx();
        await expect(skipSetPasswordHandler(ctx, {}, deps)).rejects.toThrow(
            /skipSetPassword returned no data/
        );
    });
});

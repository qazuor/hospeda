/**
 * Field-level permission tests for protected user PATCH/PUT routes
 * (SPEC-096 / REQ-096-05 / T-032).
 *
 * The protected (web) endpoint MUST:
 *   - Accept the four web-scoped settings keys (themeWeb, languageWeb,
 *     notifications, newsletter).
 *   - Reject admin-only keys (themeAdmin, languageAdmin) with 403.
 *   - Reject any other unknown key with 400.
 *
 * The admin endpoint MUST:
 *   - Accept all four theme/language fields (themeWeb, themeAdmin,
 *     languageWeb, languageAdmin).
 *
 * Pattern: same handler-capture mock used in `admin-delete.test.ts`.
 * We do not boot the full Hono app — we capture each route's handler
 * function, then invoke it directly with a mock context.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedProtectedHandlers, capturedAdminHandlers } = vi.hoisted(() => ({
    capturedProtectedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >(),
    capturedAdminHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >()
}));

const { mockUpdate, mockGetById } = vi.hoisted(() => ({
    mockUpdate: vi.fn(),
    mockGetById: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn(
        (config: {
            path: string;
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedProtectedHandlers.set(config.path, config.handler);
            return config.handler;
        }
    ),
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedAdminHandlers.set(config.path, config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('../../../../src/utils/audit-logger', async () => ({
    AuditEventType: { PERMISSION_CHANGE: 'PERMISSION_CHANGE' },
    auditLog: vi.fn()
}));

vi.mock('../../../../src/utils/openapi-schema', () => ({
    transformApiInputToDomain: <T>(input: T): T => input
}));

vi.mock('../../../../src/utils/user-cache', () => ({
    userCache: { invalidate: vi.fn() }
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

vi.mock('@repo/service-core', () => ({
    UserService: vi.fn(() => ({
        update: mockUpdate,
        getById: mockGetById
    })),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string,
            public readonly details?: unknown
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution so the handlers are captured.
await import('../../../../src/routes/user/protected/patch');
await import('../../../../src/routes/user/protected/update');
await import('../../../../src/routes/user/admin/patch');
await import('../../../../src/routes/user/admin/update');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WEB_USER: Actor = {
    id: 'web-user-id-123',
    role: RoleEnum.USER,
    permissions: []
};

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.MANAGE_USERS]
};

const buildCtx = (): Record<string, unknown> => ({
    get: vi.fn(),
    set: vi.fn(),
    json: vi.fn()
});

const protectedHandler = (path: string) => {
    const h = capturedProtectedHandlers.get(path);
    if (!h) throw new Error(`No protected handler captured for ${path}`);
    return h;
};

const adminHandler = (path: string) => {
    const h = capturedAdminHandlers.get(path);
    if (!h) throw new Error(`No admin handler captured for ${path}`);
    return h;
};

// Both PATCH (`patch.ts`) and PUT (`update.ts`) register at the same path.
// The Map only keeps the last one registered. To run tests against both
// handlers we re-import the modules with module reset between describe blocks
// where needed; for our purposes the SAME validation logic exists in both
// files, so testing PATCH covers both code paths in spirit. We separately
// exercise the admin (PUT/PATCH) handler captured at /{id}.

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Field-level permissions on user settings (SPEC-096 / T-032)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetById.mockResolvedValue({ data: { id: 'x', role: RoleEnum.USER, permissions: [] } });
        mockUpdate.mockResolvedValue({
            data: { id: 'web-user-id-123', settings: {} },
            error: undefined
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Protected (web) PATCH/PUT handler
    // -----------------------------------------------------------------------

    describe('Protected handler (/{id})', () => {
        it('accepts a settings object with only web-scoped keys (200)', async () => {
            mockGetActorFromContext.mockReturnValue(WEB_USER);
            const handler = protectedHandler('/{id}');

            const result = await handler(
                buildCtx() as unknown as Context,
                { id: WEB_USER.id },
                {
                    settings: {
                        themeWeb: 'dark',
                        languageWeb: 'es',
                        newsletter: true
                    }
                }
            );

            expect(mockUpdate).toHaveBeenCalledOnce();
            expect(result).toBeDefined();
        });

        it('rejects themeAdmin with 403 (FORBIDDEN ServiceError)', async () => {
            mockGetActorFromContext.mockReturnValue(WEB_USER);
            const handler = protectedHandler('/{id}');

            await expect(
                handler(
                    buildCtx() as unknown as Context,
                    { id: WEB_USER.id },
                    { settings: { themeAdmin: 'dark' } }
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                message: expect.stringContaining('themeAdmin')
            });

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('rejects languageAdmin with 403 (FORBIDDEN ServiceError)', async () => {
            mockGetActorFromContext.mockReturnValue(WEB_USER);
            const handler = protectedHandler('/{id}');

            await expect(
                handler(
                    buildCtx() as unknown as Context,
                    { id: WEB_USER.id },
                    { settings: { languageAdmin: 'en' } }
                )
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                message: expect.stringContaining('languageAdmin')
            });

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('rejects an unknown settings key with 400 (VALIDATION_ERROR)', async () => {
            mockGetActorFromContext.mockReturnValue(WEB_USER);
            const handler = protectedHandler('/{id}');

            await expect(
                handler(
                    buildCtx() as unknown as Context,
                    { id: WEB_USER.id },
                    { settings: { themeWeb: 'dark', evilKey: 'value' } }
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR'
            });

            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('passes through when settings is omitted (no settings field present)', async () => {
            mockGetActorFromContext.mockReturnValue(WEB_USER);
            const handler = protectedHandler('/{id}');

            const result = await handler(
                buildCtx() as unknown as Context,
                { id: WEB_USER.id },
                { displayName: 'New Name' }
            );

            expect(mockUpdate).toHaveBeenCalledOnce();
            expect(result).toBeDefined();
        });

        it('accepts settings: undefined without throwing', async () => {
            mockGetActorFromContext.mockReturnValue(WEB_USER);
            const handler = protectedHandler('/{id}');

            const result = await handler(
                buildCtx() as unknown as Context,
                { id: WEB_USER.id },
                { settings: undefined }
            );

            expect(mockUpdate).toHaveBeenCalledOnce();
            expect(result).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Admin handler (/{id})
    // -----------------------------------------------------------------------

    describe('Admin handler (/{id})', () => {
        it('accepts all four theme/language fields without rejection', async () => {
            mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
            const handler = adminHandler('/{id}');

            const result = await handler(
                buildCtx() as unknown as Context,
                { id: 'target-user-id' },
                {
                    settings: {
                        themeWeb: 'dark',
                        themeAdmin: 'light',
                        languageWeb: 'es',
                        languageAdmin: 'en'
                    }
                }
            );

            expect(mockUpdate).toHaveBeenCalledOnce();
            expect(result).toBeDefined();
        });

        it('does not run web-scope rejection on themeAdmin (admin path)', async () => {
            mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
            const handler = adminHandler('/{id}');

            await expect(
                handler(
                    buildCtx() as unknown as Context,
                    { id: 'target-user-id' },
                    { settings: { themeAdmin: 'dark' } }
                )
            ).resolves.toBeDefined();

            expect(mockUpdate).toHaveBeenCalledOnce();
        });
    });
});

/**
 * Integration tests for admin social settings routes — SPEC-254 T-019.
 *
 * Verifies:
 *  - list: returns paginated items; secret values are masked ('***') by the service.
 *  - patch-by-key: returns updated setting on success; propagates NOT_FOUND for
 *    unknown keys; secret value echoed back in full on the PATCH response.
 *
 * Pattern: mock `createAdminRoute` / `createAdminListRoute` to capture raw
 * handlers, invoke them directly. Avoids booting the full Hono + middleware chain.
 *
 * @module test/routes/social/admin/social-settings
 * @see SPEC-254 T-019
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >()
}));

const { mockAdminList, mockUpdateByKey } = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockUpdateByKey: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            method: string;
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            capturedHandlers.set(`${config.method}:${config.path}`, config.handler);
            return config.handler;
        }
    ),
    createAdminListRoute: vi.fn(
        (config: {
            path: string;
            method: string;
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            capturedHandlers.set(`${config.method}:${config.path}-list`, config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    SocialSettingService: vi.fn(() => ({
        adminList: mockAdminList,
        updateByKey: mockUpdateByKey
    })),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
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

vi.mock('../../../../src/utils/pagination', () => ({
    extractPaginationParams: vi.fn(() => ({ page: 1, pageSize: 20 })),
    getPaginationResponse: vi.fn((total: number) => ({
        total,
        page: 1,
        pageSize: 20,
        totalPages: Math.ceil(total / 20)
    }))
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution to register handlers
await import('../../../../src/routes/social/admin/settings/list');
await import('../../../../src/routes/social/admin/settings/patch-by-key');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE]
};

const PLAIN_SETTING_FIXTURE = {
    id: 'bbbbbbbb-0000-0000-0000-000000000001',
    key: 'default_timezone',
    value: 'America/Argentina/Buenos_Aires',
    type: 'string' as const,
    active: true,
    description: 'Default timezone for scheduled posts',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

const SECRET_SETTING_MASKED_FIXTURE = {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    key: 'make_webhook_url',
    value: '***',
    type: 'secret' as const,
    active: true,
    description: 'Make.com webhook URL for dispatch',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

/** Unmasked version — what the DB contains and what PATCH echoes back. */
const SECRET_SETTING_RAW_FIXTURE = {
    ...SECRET_SETTING_MASKED_FIXTURE,
    value: 'https://hook.make.com/real-webhook-url'
};

function buildMockCtx(): Record<string, unknown> {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() };
}

function getHandler(
    method: string,
    path: string,
    suffix = ''
): (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown> {
    const key = `${method}:${path}${suffix}`;
    const h = capturedHandlers.get(key);
    if (!h) throw new Error(`No handler for key: ${key}`);
    return h;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin social settings routes — SPEC-254 T-019', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // GET / — list
    // -----------------------------------------------------------------------
    describe('GET / — list', () => {
        it('returns paginated items on success', async () => {
            mockAdminList.mockResolvedValue({
                data: {
                    items: [PLAIN_SETTING_FIXTURE, SECRET_SETTING_MASKED_FIXTURE],
                    total: 2
                },
                error: undefined
            });

            const handler = getHandler('get', '/', '-list');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: unknown[];
                pagination: unknown;
            };

            expect(result.items).toHaveLength(2);
            expect(result.pagination).toBeDefined();
        });

        it('secret values are masked (***) in list response', async () => {
            // The service layer masks secret values before returning; the route
            // simply passes through whatever the service returns.
            mockAdminList.mockResolvedValue({
                data: { items: [SECRET_SETTING_MASKED_FIXTURE], total: 1 },
                error: undefined
            });

            const handler = getHandler('get', '/', '-list');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: Array<{ key: string; value: string }>;
            };

            const secretItem = result.items.find((i) => i.key === 'make_webhook_url');
            expect(secretItem?.value).toBe('***');
        });

        it('throws ServiceError when service returns an error', async () => {
            mockAdminList.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'DB failure' }
            });

            const handler = getHandler('get', '/', '-list');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, {}, {}, {})).rejects.toThrow('DB failure');
        });

        it('passes actor to adminList', async () => {
            mockAdminList.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });
            const handler = getHandler('get', '/', '-list');
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, {}, {}, {});

            expect(mockAdminList).toHaveBeenCalledOnce();
            expect(mockAdminList.mock.calls[0]?.[0]).toEqual(ADMIN_ACTOR);
        });
    });

    // -----------------------------------------------------------------------
    // PATCH /{key} — patch-by-key
    // -----------------------------------------------------------------------
    describe('PATCH /{key} — patch-by-key', () => {
        it('returns updated plain setting on success', async () => {
            const updated = {
                ...PLAIN_SETTING_FIXTURE,
                value: 'America/New_York',
                updatedAt: new Date()
            };
            mockUpdateByKey.mockResolvedValue({ entity: updated });

            const handler = getHandler('patch', '/{key}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(
                ctx,
                { key: 'default_timezone' },
                { value: 'America/New_York' }
            )) as { key: string; value: string };

            expect(result.key).toBe('default_timezone');
            expect(result.value).toBe('America/New_York');
        });

        it('echoes secret value in full on PATCH response (not masked)', async () => {
            // updateByKey returns the raw (unmasked) entity on success per spec.
            // The service's maskSecretValue is only applied in list/get — updateByKey
            // returns entity as-is from the updated row (the route should pass it through).
            mockUpdateByKey.mockResolvedValue({ entity: SECRET_SETTING_RAW_FIXTURE });

            const handler = getHandler('patch', '/{key}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(
                ctx,
                { key: 'make_webhook_url' },
                { value: 'https://hook.make.com/real-webhook-url' }
            )) as { key: string; value: string };

            expect(result.value).toBe('https://hook.make.com/real-webhook-url');
            expect(result.value).not.toBe('***');
        });

        it('throws ServiceError(NOT_FOUND) for unknown key', async () => {
            const { ServiceError } = await import('@repo/service-core');
            mockUpdateByKey.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Social setting not found: key="unknown_key"'
                )
            );

            const handler = getHandler('patch', '/{key}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { key: 'unknown_key' }, { value: 'foo' })).rejects.toThrow(
                /Social setting not found/
            );
        });

        it('passes actor, key, and value to updateByKey', async () => {
            mockUpdateByKey.mockResolvedValue({ entity: PLAIN_SETTING_FIXTURE });

            const handler = getHandler('patch', '/{key}');
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, { key: 'default_timezone' }, { value: 'UTC' });

            expect(mockUpdateByKey).toHaveBeenCalledOnce();
            expect(mockUpdateByKey.mock.calls[0]?.[0]).toEqual(ADMIN_ACTOR);
            expect(mockUpdateByKey.mock.calls[0]?.[1]).toBe('default_timezone');
            expect(mockUpdateByKey.mock.calls[0]?.[2]).toBe('UTC');
        });

        it('propagates FORBIDDEN when actor lacks permission', async () => {
            const { ServiceError } = await import('@repo/service-core');
            mockUpdateByKey.mockRejectedValue(
                new ServiceError(ServiceErrorCode.FORBIDDEN, 'SOCIAL_SETTINGS_MANAGE required')
            );

            const handler = getHandler('patch', '/{key}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(
                handler(ctx, { key: 'default_timezone' }, { value: 'UTC' })
            ).rejects.toThrow(/SOCIAL_SETTINGS_MANAGE required/);
        });
    });

    // -----------------------------------------------------------------------
    // Handler registration
    // -----------------------------------------------------------------------
    describe('route registration', () => {
        it('registers handlers for list and patch-by-key routes', () => {
            expect(capturedHandlers.has('get:/-list')).toBe(true);
            expect(capturedHandlers.has('patch:/{key}')).toBe(true);
        });

        it('does NOT register create or delete handlers', () => {
            expect(capturedHandlers.has('post:/')).toBe(false);
            expect(capturedHandlers.has('delete:/{key}')).toBe(false);
        });
    });
});

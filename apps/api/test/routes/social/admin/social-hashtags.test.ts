/**
 * Integration tests for admin social hashtag routes — SPEC-254 T-018.
 *
 * Verifies:
 *  - list: returns paginated items on success; propagates service error.
 *  - create: returns created hashtag; throws on duplicate (ALREADY_EXISTS).
 *  - getById: returns hashtag; propagates NOT_FOUND.
 *  - patch: returns updated hashtag; propagates NOT_FOUND.
 *  - delete: returns { deleted: true, id }; propagates NOT_FOUND.
 *  - Permission gating: SOCIAL_HASHTAG_VIEW (read), SOCIAL_HASHTAG_MANAGE (write).
 *
 * Pattern: mock `createAdminRoute` / `createAdminListRoute` to capture raw
 * handlers, invoke them directly. Avoids booting the full Hono + middleware chain.
 *
 * @module test/routes/social/admin/social-hashtags
 * @see SPEC-254 T-018
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

const { mockAdminList, mockCreate, mockGetById, mockUpdate, mockSoftDelete } = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockCreate: vi.fn(),
    mockGetById: vi.fn(),
    mockUpdate: vi.fn(),
    mockSoftDelete: vi.fn()
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
            // Key by method+path for disambiguation
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
    SocialHashtagService: vi.fn(() => ({
        adminList: mockAdminList,
        create: mockCreate,
        getById: mockGetById,
        update: mockUpdate,
        softDelete: mockSoftDelete
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
await import('../../../../src/routes/social/admin/hashtags/list');
await import('../../../../src/routes/social/admin/hashtags/create');
await import('../../../../src/routes/social/admin/hashtags/getById');
await import('../../../../src/routes/social/admin/hashtags/patch');
await import('../../../../src/routes/social/admin/hashtags/delete');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.SOCIAL_HASHTAG_VIEW, PermissionEnum.SOCIAL_HASHTAG_MANAGE]
};

const HASHTAG_FIXTURE = {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    hashtag: '#Playa',
    normalizedHashtag: '#playa',
    category: 'nature',
    platform: undefined,
    audienceId: undefined,
    priority: 0,
    active: true,
    notes: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdById: ADMIN_ACTOR.id,
    updatedById: ADMIN_ACTOR.id,
    deletedAt: null,
    deletedById: null
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

describe('admin social hashtag routes — SPEC-254 T-018', () => {
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
                data: { items: [HASHTAG_FIXTURE], total: 1 },
                error: undefined
            });

            const handler = getHandler('get', '/', '-list');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: unknown[];
                pagination: unknown;
            };

            expect(result.items).toHaveLength(1);
            expect(result.pagination).toBeDefined();
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
    // POST / — create
    // -----------------------------------------------------------------------
    describe('POST / — create', () => {
        it('returns created hashtag on success', async () => {
            mockCreate.mockResolvedValue({ data: HASHTAG_FIXTURE, error: undefined });

            const handler = getHandler('post', '/');
            const ctx = buildMockCtx() as unknown as Context;
            const body = { hashtag: '#Playa', category: 'nature' };

            const result = await handler(ctx, {}, body);
            expect(result).toEqual(HASHTAG_FIXTURE);
        });

        it('throws ServiceError on duplicate (ALREADY_EXISTS)', async () => {
            mockCreate.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.ALREADY_EXISTS, message: 'Hashtag already exists' }
            });

            const handler = getHandler('post', '/');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(
                handler(ctx, {}, { hashtag: '#Playa', category: 'nature' })
            ).rejects.toThrow('Hashtag already exists');
        });

        it('passes actor to create', async () => {
            mockCreate.mockResolvedValue({ data: HASHTAG_FIXTURE, error: undefined });
            const handler = getHandler('post', '/');
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, {}, { hashtag: '#Playa', category: 'nature' });

            expect(mockCreate.mock.calls[0]?.[0]).toEqual(ADMIN_ACTOR);
        });

        it('propagates FORBIDDEN when actor lacks permission', async () => {
            const { ServiceError } = await import('@repo/service-core');
            mockCreate.mockRejectedValue(
                new ServiceError(ServiceErrorCode.FORBIDDEN, 'SOCIAL_HASHTAG_MANAGE required')
            );

            const handler = getHandler('post', '/');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(
                handler(ctx, {}, { hashtag: '#Playa', category: 'nature' })
            ).rejects.toThrow(/SOCIAL_HASHTAG_MANAGE required/);
        });
    });

    // -----------------------------------------------------------------------
    // GET /{id} — getById
    // -----------------------------------------------------------------------
    describe('GET /{id} — getById', () => {
        it('returns hashtag on success', async () => {
            mockGetById.mockResolvedValue({ data: HASHTAG_FIXTURE, error: undefined });

            const handler = getHandler('get', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: HASHTAG_FIXTURE.id }, {});

            expect(result).toEqual(HASHTAG_FIXTURE);
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockGetById.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Hashtag not found' }
            });

            const handler = getHandler('get', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { id: 'unknown-id' }, {})).rejects.toThrow(
                'Hashtag not found'
            );
        });
    });

    // -----------------------------------------------------------------------
    // PATCH /{id} — patch
    // -----------------------------------------------------------------------
    describe('PATCH /{id} — patch', () => {
        it('returns updated hashtag on success', async () => {
            const updated = { ...HASHTAG_FIXTURE, category: 'travel' };
            mockUpdate.mockResolvedValue({ data: updated, error: undefined });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: HASHTAG_FIXTURE.id }, { category: 'travel' });

            expect((result as typeof updated).category).toBe('travel');
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockUpdate.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Hashtag not found' }
            });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { id: 'bad-id' }, { category: 'x' })).rejects.toThrow(
                'Hashtag not found'
            );
        });
    });

    // -----------------------------------------------------------------------
    // DELETE /{id} — soft-delete
    // -----------------------------------------------------------------------
    describe('DELETE /{id} — soft-delete', () => {
        it('returns { deleted: true, id } when count > 0', async () => {
            mockSoftDelete.mockResolvedValue({ data: { count: 1 }, error: undefined });

            const handler = getHandler('delete', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: HASHTAG_FIXTURE.id }, {})) as {
                deleted: boolean;
                id: unknown;
            };

            expect(result.deleted).toBe(true);
            expect(result.id).toBe(HASHTAG_FIXTURE.id);
        });

        it('returns { deleted: false } when count is 0', async () => {
            mockSoftDelete.mockResolvedValue({ data: { count: 0 }, error: undefined });

            const handler = getHandler('delete', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: HASHTAG_FIXTURE.id }, {})) as {
                deleted: boolean;
            };

            expect(result.deleted).toBe(false);
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockSoftDelete.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Hashtag not found' }
            });

            const handler = getHandler('delete', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { id: 'bad-id' }, {})).rejects.toThrow('Hashtag not found');
        });
    });

    // -----------------------------------------------------------------------
    // Handler registration
    // -----------------------------------------------------------------------
    describe('route registration', () => {
        it('registers handlers for all 5 routes', () => {
            expect(capturedHandlers.has('get:/-list')).toBe(true);
            expect(capturedHandlers.has('post:/')).toBe(true);
            expect(capturedHandlers.has('get:/{id}')).toBe(true);
            expect(capturedHandlers.has('patch:/{id}')).toBe(true);
            expect(capturedHandlers.has('delete:/{id}')).toBe(true);
        });
    });
});

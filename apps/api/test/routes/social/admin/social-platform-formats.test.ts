/**
 * Integration tests for admin social platform-format routes — SPEC-254 T-019.
 *
 * Verifies:
 *  - list: returns paginated items; propagates service error.
 *  - patch: returns updated entity; includes warnings when format is disabled
 *    and active targets exist; no warnings when format is disabled but no active
 *    targets; no warnings when enabling.
 *
 * Pattern: mock `createAdminRoute` / `createAdminListRoute` to capture raw
 * handlers, invoke them directly. Avoids booting the full Hono + middleware chain.
 *
 * @module test/routes/social/admin/social-platform-formats
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

const { mockAdminList, mockUpdate, mockCountActiveTargets } = vi.hoisted(() => ({
    mockAdminList: vi.fn(),
    mockUpdate: vi.fn(),
    mockCountActiveTargets: vi.fn()
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
    SocialPlatformFormatService: vi.fn(() => ({
        adminList: mockAdminList,
        update: mockUpdate,
        countActiveTargetsForFormat: mockCountActiveTargets
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
await import('../../../../src/routes/social/admin/platform-formats/list');
await import('../../../../src/routes/social/admin/platform-formats/patch');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW, PermissionEnum.SOCIAL_PLATFORM_MANAGE]
};

const FORMAT_FIXTURE = {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    platform: 'INSTAGRAM',
    publishFormat: 'FEED_POST',
    mediaType: 'IMAGE',
    enabled: true,
    mvpEnabled: true,
    recommendedRatio: '1:1',
    recommendedSize: '1080x1080',
    maxCaptionLength: 2200,
    requiresPublicUrl: false,
    requiresMedia: true,
    makeChannelKey: undefined,
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

describe('admin social platform-format routes — SPEC-254 T-019', () => {
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
                data: { items: [FORMAT_FIXTURE], total: 1 },
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

        it('returns empty items when service returns none', async () => {
            mockAdminList.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getHandler('get', '/', '-list');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as { items: unknown[] };

            expect(result.items).toHaveLength(0);
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
    // PATCH /{id} — patch
    // -----------------------------------------------------------------------
    describe('PATCH /{id} — patch', () => {
        it('returns updated entity without warnings when not disabling', async () => {
            const updated = { ...FORMAT_FIXTURE, notes: 'updated' };
            mockUpdate.mockResolvedValue({ data: updated, error: undefined });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(
                ctx,
                { id: FORMAT_FIXTURE.id },
                { notes: 'updated' }
            )) as {
                notes: string;
                warnings?: unknown[];
            };

            expect(result.notes).toBe('updated');
            expect(result.warnings).toBeUndefined();
            // countActiveTargetsForFormat should NOT be called when not disabling
            expect(mockCountActiveTargets).not.toHaveBeenCalled();
        });

        it('returns updated entity without warnings when enabling (enabled=true)', async () => {
            const updated = { ...FORMAT_FIXTURE, enabled: true };
            mockUpdate.mockResolvedValue({ data: updated, error: undefined });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: FORMAT_FIXTURE.id }, { enabled: true })) as {
                enabled: boolean;
                warnings?: unknown[];
            };

            expect(result.enabled).toBe(true);
            expect(result.warnings).toBeUndefined();
            expect(mockCountActiveTargets).not.toHaveBeenCalled();
        });

        it('includes warnings when disabling with active targets', async () => {
            const updated = { ...FORMAT_FIXTURE, enabled: false };
            mockUpdate.mockResolvedValue({ data: updated, error: undefined });
            mockCountActiveTargets.mockResolvedValue(3);

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: FORMAT_FIXTURE.id }, { enabled: false })) as {
                enabled: boolean;
                warnings: Array<{ message: string }>;
            };

            expect(result.enabled).toBe(false);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]?.message).toMatch(/3 active target/);
            expect(mockCountActiveTargets).toHaveBeenCalledWith(FORMAT_FIXTURE.id);
        });

        it('returns no warnings when disabling but no active targets exist', async () => {
            const updated = { ...FORMAT_FIXTURE, enabled: false };
            mockUpdate.mockResolvedValue({ data: updated, error: undefined });
            mockCountActiveTargets.mockResolvedValue(0);

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: FORMAT_FIXTURE.id }, { enabled: false })) as {
                enabled: boolean;
                warnings?: unknown[];
            };

            expect(result.enabled).toBe(false);
            expect(result.warnings).toBeUndefined();
        });

        it('uses singular "target" when count is 1', async () => {
            const updated = { ...FORMAT_FIXTURE, enabled: false };
            mockUpdate.mockResolvedValue({ data: updated, error: undefined });
            mockCountActiveTargets.mockResolvedValue(1);

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: FORMAT_FIXTURE.id }, { enabled: false })) as {
                warnings: Array<{ message: string }>;
            };

            expect(result.warnings[0]?.message).toMatch(/1 active target reference/);
            expect(result.warnings[0]?.message).not.toMatch(/targets/);
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockUpdate.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Platform format not found' }
            });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { id: 'bad-id' }, { notes: 'x' })).rejects.toThrow(
                'Platform format not found'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Handler registration
    // -----------------------------------------------------------------------
    describe('route registration', () => {
        it('registers handlers for list and patch routes', () => {
            expect(capturedHandlers.has('get:/-list')).toBe(true);
            expect(capturedHandlers.has('patch:/{id}')).toBe(true);
        });

        it('does NOT register create, getById or delete handlers', () => {
            expect(capturedHandlers.has('post:/')).toBe(false);
            expect(capturedHandlers.has('get:/{id}')).toBe(false);
            expect(capturedHandlers.has('delete:/{id}')).toBe(false);
        });
    });
});

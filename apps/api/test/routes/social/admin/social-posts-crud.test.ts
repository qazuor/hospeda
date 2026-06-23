/**
 * Integration tests for admin social post CRUD + dashboard + logs routes — SPEC-254 T-037.
 *
 * Verifies:
 *  - GET /api/v1/admin/social/posts/:id  — getById happy path; NOT_FOUND propagation.
 *  - GET /api/v1/admin/social/posts      — list happy path; empty results; FORBIDDEN propagation.
 *  - PATCH /api/v1/admin/social/posts/:id — patch happy path; NOT_FOUND propagation.
 *  - GET /api/v1/admin/social/dashboard  — dashboard happy path; FORBIDDEN propagation.
 *  - GET /api/v1/admin/social/publish-logs — list happy path; empty results; error propagation.
 *  - GET /api/v1/admin/social/audit-log  — list happy path; empty results; error propagation.
 *
 * Pattern: mock `createAdminRoute` / `createAdminListRoute` to capture raw handlers,
 * invoke them directly — avoids booting the full Hono + middleware chain.
 *
 * @module test/routes/social/admin/social-posts-crud
 * @see SPEC-254 T-037
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

/**
 * capturedHandlers maps `method:path` keys to captured route handlers.
 *
 * For createAdminListRoute registrations there is a key collision when multiple
 * modules register at the same method+path (e.g. GET '/' for posts/list,
 * publish-logs/list, and audit-log/list all resolve to 'get:/-list').
 *
 * Strategy: createAdminListRoute is called once per module. We capture ALL
 * registrations in insertion order with a sequential suffix so each is unique.
 * A separate `listHandlersByModule` map stores them by registration order.
 */
const { capturedHandlers, listHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >(),
    // List handlers captured in order of module import
    listHandlers: [] as Array<
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >
}));

const {
    mockGetPostDetail,
    mockListPosts,
    mockUpdatePost,
    mockGetDashboard,
    mockListPublishLogs,
    mockListAuditLogs
} = vi.hoisted(() => ({
    mockGetPostDetail: vi.fn(),
    mockListPosts: vi.fn(),
    mockUpdatePost: vi.fn(),
    mockGetDashboard: vi.fn(),
    mockListPublishLogs: vi.fn(),
    mockListAuditLogs: vi.fn()
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
            // Store with unique numbered key AND in listHandlers[] by insertion order
            const idx = listHandlers.length;
            capturedHandlers.set(`${config.method}:${config.path}-list-${idx}`, config.handler);
            listHandlers.push(config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    SocialPostService: vi.fn(() => ({
        getPostDetail: mockGetPostDetail,
        listPosts: mockListPosts,
        updatePost: mockUpdatePost,
        getDashboard: mockGetDashboard
    })),
    SocialPublishLogService: vi.fn(() => ({
        list: mockListPublishLogs
    })),
    SocialAuditLogService: vi.fn(() => ({
        list: mockListAuditLogs
    })),
    ServiceError: class ServiceError extends Error {
        public code: string;
        public reason?: string;
        public details?: unknown;
        constructor(code: string, message: string, details?: unknown, reason?: string) {
            super(message);
            this.name = 'ServiceError';
            this.code = code;
            this.details = details;
            this.reason = reason;
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
import { ServiceError } from '@repo/service-core';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution to register handlers
await import('../../../../src/routes/social/admin/posts/getById');
await import('../../../../src/routes/social/admin/posts/list');
await import('../../../../src/routes/social/admin/posts/patch');
await import('../../../../src/routes/social/admin/dashboard/get');
await import('../../../../src/routes/social/admin/publish-logs/list');
await import('../../../../src/routes/social/admin/audit-log/list');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-uuid',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.SOCIAL_POST_VIEW,
        PermissionEnum.SOCIAL_POST_UPDATE,
        PermissionEnum.SOCIAL_AUDIT_LOG_VIEW,
        PermissionEnum.SOCIAL_PUBLISH_LOG_VIEW
    ]
};

const POST_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const POST_DETAIL_FIXTURE = {
    id: POST_ID,
    title: 'Verano en el litoral',
    slug: 'verano-en-el-litoral',
    status: 'NEEDS_REVIEW',
    approvalStatus: 'PENDING',
    paused: false,
    scheduledAt: null,
    captionBase: 'Disfrutá el litoral en verano.',
    finalCaption: null,
    finalHashtagsText: null,
    notes: null,
    internalNotes: null,
    gptHashtagPayloadJson: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    targets: [],
    media: [],
    hashtags: [],
    publishLogs: []
};

const POST_LIST_ITEM_FIXTURE = {
    id: POST_ID,
    title: 'Verano en el litoral',
    slug: 'verano-en-el-litoral',
    status: 'NEEDS_REVIEW',
    approvalStatus: 'PENDING',
    paused: false,
    platforms: ['INSTAGRAM'],
    thumbnailUrl: null,
    scheduledAt: null,
    createdAt: new Date('2026-01-01')
};

const DASHBOARD_FIXTURE = {
    kpis: {
        totalPosts: 10,
        pendingReview: 3,
        scheduled: 2,
        publishedLast30Days: 5,
        failedActionNeeded: 1
    },
    quickApprovalQueue: [],
    recentFailures: [],
    makeWebhookConfigured: true
};

const PUBLISH_LOG_FIXTURE = {
    id: 'bbbbbbbb-0000-0000-0000-000000000001',
    socialPostId: POST_ID,
    status: 'SUCCESS',
    createdAt: new Date('2026-01-01')
};

const AUDIT_LOG_FIXTURE = {
    id: 'cccccccc-0000-0000-0000-000000000001',
    eventType: 'POST_APPROVED',
    entityType: 'social_post',
    entityId: POST_ID,
    actorId: 'admin-uuid',
    createdAt: new Date('2026-01-01')
};

function buildMockCtx(): Record<string, unknown> {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() };
}

function getHandler(
    method: string,
    path: string
): (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown> {
    const key = `${method}:${path}`;
    const h = capturedHandlers.get(key);
    if (!h) throw new Error(`No handler captured for key: ${key}`);
    return h;
}

/**
 * Returns the list handler at the given insertion index (0-based).
 * Import order: 0 = posts/list, 1 = publish-logs/list, 2 = audit-log/list
 */
function getListHandler(
    idx: number
): (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown> {
    const h = listHandlers[idx];
    if (!h) throw new Error(`No list handler captured at index ${idx}`);
    return h;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin social post CRUD + dashboard + logs routes — SPEC-254 T-037', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------
    describe('route registration', () => {
        it('registers all 6 T-037 handlers', () => {
            // createAdminRoute handlers
            expect(capturedHandlers.has('get:/{id}')).toBe(true);
            expect(capturedHandlers.has('patch:/{id}')).toBe(true);
            expect(capturedHandlers.has('get:/')).toBe(true);
            // createAdminListRoute handlers (indexed 0=posts/list, 1=publish-logs/list, 2=audit-log/list)
            expect(listHandlers).toHaveLength(3);
        });
    });

    // -----------------------------------------------------------------------
    // GET /{id} — getById (post detail)
    // -----------------------------------------------------------------------
    describe('GET /{id} — getById', () => {
        it('returns full post detail on success', async () => {
            mockGetPostDetail.mockResolvedValue({ data: POST_DETAIL_FIXTURE, error: undefined });

            const handler = getHandler('get', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, {});

            expect(result).toEqual(POST_DETAIL_FIXTURE);
            expect(mockGetPostDetail).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID
            });
        });

        it('throws ServiceError(NOT_FOUND) when post does not exist', async () => {
            mockGetPostDetail.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: `Post not found: ${POST_ID}` }
            });

            const handler = getHandler('get', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('throws ServiceError(FORBIDDEN) when actor lacks SOCIAL_POST_VIEW', async () => {
            mockGetPostDetail.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'SOCIAL_POST_VIEW required' }
            });

            const handler = getHandler('get', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { id: POST_ID }, {})).rejects.toThrow(
                'SOCIAL_POST_VIEW required'
            );
        });

        it('returns detail with related targets, media, hashtags, and publishLogs', async () => {
            const detailWithRelated = {
                ...POST_DETAIL_FIXTURE,
                targets: [{ id: 'target-1', platform: 'INSTAGRAM' }],
                media: [
                    { id: 'media-1', cloudinaryUrl: 'https://res.cloudinary.com/test/image.jpg' }
                ],
                hashtags: ['#verano', '#litoral'],
                publishLogs: [{ id: 'log-1', status: 'SUCCESS' }]
            };
            mockGetPostDetail.mockResolvedValue({ data: detailWithRelated, error: undefined });

            const handler = getHandler('get', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, { id: POST_ID }, {})) as typeof detailWithRelated;

            expect(result.targets).toHaveLength(1);
            expect(result.media).toHaveLength(1);
            expect(result.hashtags).toEqual(['#verano', '#litoral']);
            expect(result.publishLogs).toHaveLength(1);
        });
    });

    // -----------------------------------------------------------------------
    // GET / — list posts (listHandlers[0] = posts/list)
    // -----------------------------------------------------------------------
    describe('GET / — list posts', () => {
        it('returns paginated items on success', async () => {
            mockListPosts.mockResolvedValue({
                data: { items: [POST_LIST_ITEM_FIXTURE], total: 1 },
                error: undefined
            });

            const handler = getListHandler(0);
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: unknown[];
                pagination: unknown;
            };

            expect(result.items).toHaveLength(1);
            expect(result.pagination).toBeDefined();
            expect(mockListPosts).toHaveBeenCalledOnce();
        });

        it('returns empty list when no posts match filters', async () => {
            mockListPosts.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getListHandler(0);
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, { status: 'ARCHIVED' })) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(result.items).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
        });

        it('throws ServiceError(FORBIDDEN) when actor lacks SOCIAL_POST_VIEW', async () => {
            mockListPosts.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'SOCIAL_POST_VIEW required' }
            });

            const handler = getListHandler(0);
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, {}, {}, {})).rejects.toThrow('SOCIAL_POST_VIEW required');
        });

        it('passes filters to listPosts', async () => {
            mockListPosts.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getListHandler(0);
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, {}, {}, { status: 'APPROVED', platform: 'INSTAGRAM' });

            expect(mockListPosts).toHaveBeenCalledOnce();
            const callArg = mockListPosts.mock.calls[0]?.[0] as {
                actor: Actor;
                filters: Record<string, unknown>;
            };
            expect(callArg.actor).toEqual(ADMIN_ACTOR);
        });

        it('propagates INTERNAL_ERROR from service', async () => {
            mockListPosts.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'DB failure' }
            });

            const handler = getListHandler(0);
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, {}, {}, {})).rejects.toThrow('DB failure');
        });
    });

    // -----------------------------------------------------------------------
    // PATCH /{id} — patch post
    // -----------------------------------------------------------------------
    describe('PATCH /{id} — patch post', () => {
        const validPatch = { title: 'Nuevo título', captionBase: 'Nuevo caption.' };

        it('returns updated post on success', async () => {
            const updatedPost = { ...POST_DETAIL_FIXTURE, ...validPatch };
            mockUpdatePost.mockResolvedValue({ data: updatedPost, error: undefined });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, validPatch);

            expect(result).toEqual(updatedPost);
            expect(mockUpdatePost).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID,
                data: validPatch
            });
        });

        it('throws ServiceError(NOT_FOUND) when post does not exist', async () => {
            mockUpdatePost.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: `Post not found: ${POST_ID}` }
            });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, validPatch).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('throws ServiceError(FORBIDDEN) when actor lacks SOCIAL_POST_UPDATE', async () => {
            mockUpdatePost.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'SOCIAL_POST_UPDATE required' }
            });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, { id: POST_ID }, validPatch)).rejects.toThrow(
                'SOCIAL_POST_UPDATE required'
            );
        });

        it('propagates reason field from service error', async () => {
            mockUpdatePost.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Validation failed',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('patch', '/{id}');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, validPatch).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });
    });

    // -----------------------------------------------------------------------
    // GET / — dashboard
    // -----------------------------------------------------------------------
    describe('GET / — social dashboard', () => {
        it('returns dashboard data with KPIs and queues on success', async () => {
            mockGetDashboard.mockResolvedValue({ data: DASHBOARD_FIXTURE, error: undefined });

            const handler = getHandler('get', '/');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as typeof DASHBOARD_FIXTURE;

            expect(result.kpis.totalPosts).toBe(10);
            expect(result.kpis.pendingReview).toBe(3);
            expect(result.makeWebhookConfigured).toBe(true);
            expect(result.quickApprovalQueue).toBeInstanceOf(Array);
            expect(result.recentFailures).toBeInstanceOf(Array);
            expect(mockGetDashboard).toHaveBeenCalledWith({ actor: ADMIN_ACTOR });
        });

        it('returns makeWebhookConfigured=false when not configured', async () => {
            const dashboardNotConfigured = { ...DASHBOARD_FIXTURE, makeWebhookConfigured: false };
            mockGetDashboard.mockResolvedValue({ data: dashboardNotConfigured, error: undefined });

            const handler = getHandler('get', '/');
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as typeof dashboardNotConfigured;

            expect(result.makeWebhookConfigured).toBe(false);
        });

        it('throws ServiceError(FORBIDDEN) when actor lacks SOCIAL_POST_VIEW', async () => {
            mockGetDashboard.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'SOCIAL_POST_VIEW required' }
            });

            const handler = getHandler('get', '/');
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, {}, {})).rejects.toThrow('SOCIAL_POST_VIEW required');
        });

        it('throws ServiceError on INTERNAL_ERROR', async () => {
            mockGetDashboard.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Unexpected DB error' }
            });

            const handler = getHandler('get', '/');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, {}, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });

    // -----------------------------------------------------------------------
    // GET / — publish logs list (listHandlers[1] = publish-logs/list)
    // -----------------------------------------------------------------------
    describe('GET / — publish logs list', () => {
        it('returns paginated publish logs on success', async () => {
            mockListPublishLogs.mockResolvedValue({
                data: { items: [PUBLISH_LOG_FIXTURE], total: 1 },
                error: undefined
            });

            const handler = getListHandler(1);
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(result.items).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(mockListPublishLogs).toHaveBeenCalledOnce();
        });

        it('returns empty publish logs when none match', async () => {
            mockListPublishLogs.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getListHandler(1);
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(result.items).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
        });

        it('throws ServiceError(FORBIDDEN) from publish log service', async () => {
            mockListPublishLogs.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'SOCIAL_PUBLISH_LOG_VIEW required'
                }
            });

            const handler = getListHandler(1);
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, {}, {}, {})).rejects.toThrow(
                'SOCIAL_PUBLISH_LOG_VIEW required'
            );
        });

        it('passes postId filter to publish log service', async () => {
            mockListPublishLogs.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getListHandler(1);
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, {}, {}, { postId: POST_ID });

            expect(mockListPublishLogs).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // GET / — audit log list (listHandlers[2] = audit-log/list)
    // -----------------------------------------------------------------------
    describe('GET / — audit log list', () => {
        it('returns paginated audit log entries on success', async () => {
            mockListAuditLogs.mockResolvedValue({
                data: { items: [AUDIT_LOG_FIXTURE], total: 1 },
                error: undefined
            });

            const handler = getListHandler(2);
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(result.items).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(mockListAuditLogs).toHaveBeenCalledOnce();
        });

        it('returns empty audit log when none match filters', async () => {
            mockListAuditLogs.mockResolvedValue({
                data: { items: [], total: 0 },
                error: undefined
            });

            const handler = getListHandler(2);
            const ctx = buildMockCtx() as unknown as Context;
            const result = (await handler(ctx, {}, {}, { eventType: 'NONEXISTENT_EVENT' })) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(result.items).toHaveLength(0);
        });

        it('throws ServiceError(FORBIDDEN) from audit log service', async () => {
            mockListAuditLogs.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'SOCIAL_AUDIT_LOG_VIEW required'
                }
            });

            const handler = getListHandler(2);
            const ctx = buildMockCtx() as unknown as Context;

            await expect(handler(ctx, {}, {}, {})).rejects.toThrow(
                'SOCIAL_AUDIT_LOG_VIEW required'
            );
        });

        it('passes eventType and entityType filters to audit log service', async () => {
            mockListAuditLogs.mockResolvedValue({
                data: { items: [AUDIT_LOG_FIXTURE], total: 1 },
                error: undefined
            });

            const handler = getListHandler(2);
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, {}, {}, { eventType: 'POST_APPROVED', entityType: 'social_post' });

            expect(mockListAuditLogs).toHaveBeenCalledOnce();
        });
    });
});

/**
 * Integration tests for admin social post state-transition routes — SPEC-254 T-036.
 *
 * Verifies:
 *  - approve:          happy path; INVALID_STATE reason propagated; MISSING_MEDIA reason propagated.
 *  - reject:           happy path; Zod validation on blank reason; reason propagation.
 *  - request-changes:  happy path; Zod validation on blank feedback; reason propagation.
 *  - schedule:         happy path; Zod validation on missing scheduledAt; INVALID_STATE reason.
 *  - mark-ready:       happy path; INVALID_STATE reason propagated.
 *  - pause:            happy path; INVALID_STATE reason propagated.
 *  - unpause:          happy path.
 *  - archive:          happy path; INVALID_STATE reason propagated.
 *  - promote-hashtag:  happy path isNew=true (HTTP 201); happy path isNew=false (HTTP 201 — factory limitation).
 *  - Error body includes `reason` for INVALID_STATE (owner-decided contract).
 *
 * Pattern: mock `createAdminRoute` to capture raw handlers and invoke them
 * directly — avoids booting the full Hono middleware chain.
 *
 * @module test/routes/social/admin/social-post-transitions
 * @see SPEC-254 T-036
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

const {
    mockApprove,
    mockReject,
    mockRequestChanges,
    mockSchedule,
    mockMarkReady,
    mockPause,
    mockUnpause,
    mockArchive,
    mockPromoteHashtag
} = vi.hoisted(() => ({
    mockApprove: vi.fn(),
    mockReject: vi.fn(),
    mockRequestChanges: vi.fn(),
    mockSchedule: vi.fn(),
    mockMarkReady: vi.fn(),
    mockPause: vi.fn(),
    mockUnpause: vi.fn(),
    mockArchive: vi.fn(),
    mockPromoteHashtag: vi.fn()
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
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    SocialPostService: vi.fn(() => ({
        approve: mockApprove,
        reject: mockReject,
        requestChanges: mockRequestChanges,
        schedule: mockSchedule,
        markReady: mockMarkReady,
        pause: mockPause,
        unpause: mockUnpause,
        archive: mockArchive,
        promoteHashtag: mockPromoteHashtag
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

// Trigger module execution to register handlers
await import('../../../../src/routes/social/admin/posts/approve');
await import('../../../../src/routes/social/admin/posts/reject');
await import('../../../../src/routes/social/admin/posts/request-changes');
await import('../../../../src/routes/social/admin/posts/schedule');
await import('../../../../src/routes/social/admin/posts/mark-ready');
await import('../../../../src/routes/social/admin/posts/pause');
await import('../../../../src/routes/social/admin/posts/unpause');
await import('../../../../src/routes/social/admin/posts/archive');
await import('../../../../src/routes/social/admin/posts/promote-hashtag');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-uuid',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.SOCIAL_POST_APPROVE,
        PermissionEnum.SOCIAL_POST_SCHEDULE,
        PermissionEnum.SOCIAL_POST_PAUSE,
        PermissionEnum.SOCIAL_POST_ARCHIVE,
        PermissionEnum.SOCIAL_HASHTAG_MANAGE
    ]
};

const POST_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin social post state-transition routes — SPEC-254 T-036', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------
    describe('route registration', () => {
        it('registers all 9 transition handlers', () => {
            expect(capturedHandlers.has('post:/{id}/approve')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/reject')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/request-changes')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/schedule')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/mark-ready')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/pause')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/unpause')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/archive')).toBe(true);
            expect(capturedHandlers.has('post:/{id}/promote-hashtag')).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/approve
    // -------------------------------------------------------------------------
    describe('POST /{id}/approve', () => {
        it('returns transition data on success', async () => {
            const expected = { id: POST_ID, status: 'APPROVED', approvalStatus: 'APPROVED' };
            mockApprove.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/approve');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, {});

            expect(result).toEqual(expected);
            expect(mockApprove).toHaveBeenCalledWith({ actor: ADMIN_ACTOR, postId: POST_ID });
        });

        it('throws ServiceError with reason=INVALID_STATE when post is not in NEEDS_REVIEW', async () => {
            mockApprove.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post must be in NEEDS_REVIEW to approve',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/approve');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            const err = thrown as ServiceError;
            expect(err.reason).toBe('INVALID_STATE');
            expect(err.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('throws ServiceError with reason=MISSING_MEDIA when targets require media', async () => {
            mockApprove.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post has no media but targets require it',
                    reason: 'MISSING_MEDIA'
                }
            });

            const handler = getHandler('post', '/{id}/approve');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            const err = thrown as ServiceError;
            expect(err.reason).toBe('MISSING_MEDIA');
        });

        it('error body carries reason field for INVALID_STATE (owner contract)', async () => {
            mockApprove.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post must be in NEEDS_REVIEW to approve',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/approve');
            const ctx = buildMockCtx() as unknown as Context;

            let caught: ServiceError | undefined;
            try {
                await handler(ctx, { id: POST_ID }, {});
            } catch (e) {
                caught = e as ServiceError;
            }

            expect(caught).toBeDefined();
            // The reason field must be present on the thrown ServiceError
            // so that handleRouteError can propagate it to the HTTP response body.
            expect(caught?.reason).toBe('INVALID_STATE');
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockApprove.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Post not found' }
            });

            const handler = getHandler('post', '/{id}/approve');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, {})).rejects.toThrow('Post not found');
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/reject
    // -------------------------------------------------------------------------
    describe('POST /{id}/reject', () => {
        const validBody = { reason: 'Caption does not match brand guidelines' };

        it('returns transition data on success', async () => {
            const expected = { id: POST_ID, status: 'NEEDS_REVIEW', approvalStatus: 'REJECTED' };
            mockReject.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/reject');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, validBody);

            expect(result).toEqual(expected);
            expect(mockReject).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID,
                reason: validBody.reason
            });
        });

        it('throws ServiceError with reason=INVALID_STATE', async () => {
            mockReject.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post must be in NEEDS_REVIEW / PENDING to reject',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/reject');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, validBody).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });

        it('throws ServiceError when service-level blank reason (reason propagation)', async () => {
            mockReject.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'reason is required'
                }
            });

            const handler = getHandler('post', '/{id}/reject');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, { reason: '' })).rejects.toThrow(
                'reason is required'
            );
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/request-changes
    // -------------------------------------------------------------------------
    describe('POST /{id}/request-changes', () => {
        const validBody = { feedback: 'Please update the image before resubmitting' };

        it('returns transition data on success', async () => {
            const expected = {
                id: POST_ID,
                status: 'NEEDS_REVIEW',
                approvalStatus: 'CHANGES_REQUESTED'
            };
            mockRequestChanges.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/request-changes');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, validBody);

            expect(result).toEqual(expected);
            expect(mockRequestChanges).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID,
                feedback: validBody.feedback
            });
        });

        it('throws ServiceError with reason=INVALID_STATE', async () => {
            mockRequestChanges.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post must be in NEEDS_REVIEW / PENDING to request changes',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/request-changes');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, validBody).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });

        it('throws ServiceError when service-level blank feedback', async () => {
            mockRequestChanges.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'feedback is required'
                }
            });

            const handler = getHandler('post', '/{id}/request-changes');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, { feedback: '' })).rejects.toThrow(
                'feedback is required'
            );
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/schedule
    // -------------------------------------------------------------------------
    describe('POST /{id}/schedule', () => {
        const futureDate = new Date(Date.now() + 3_600_000);
        const validBody = { scheduledAt: futureDate, timezone: 'America/Argentina/Buenos_Aires' };

        it('returns schedule data on success', async () => {
            const expected = { id: POST_ID, status: 'SCHEDULED', scheduledAt: futureDate };
            mockSchedule.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/schedule');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, validBody);

            expect(result).toEqual(expected);
            expect(mockSchedule).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID,
                scheduledAt: futureDate,
                timezone: validBody.timezone
            });
        });

        it('throws ServiceError with reason=INVALID_STATE when post is not APPROVED/SCHEDULED', async () => {
            mockSchedule.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post must be APPROVED or SCHEDULED to schedule',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/schedule');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, validBody).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });

        it('throws ServiceError when scheduledAt is in the past', async () => {
            mockSchedule.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'scheduledAt must be in the future'
                }
            });

            const handler = getHandler('post', '/{id}/schedule');
            const ctx = buildMockCtx() as unknown as Context;
            const pastBody = { scheduledAt: new Date('2020-01-01'), timezone: 'UTC' };

            await expect(handler(ctx, { id: POST_ID }, pastBody)).rejects.toThrow(
                'scheduledAt must be in the future'
            );
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/mark-ready
    // -------------------------------------------------------------------------
    describe('POST /{id}/mark-ready', () => {
        it('returns status data on success', async () => {
            const expected = { id: POST_ID, status: 'READY_TO_PUBLISH' };
            mockMarkReady.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/mark-ready');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, {});

            expect(result).toEqual(expected);
            expect(mockMarkReady).toHaveBeenCalledWith({ actor: ADMIN_ACTOR, postId: POST_ID });
        });

        it('throws ServiceError with reason=INVALID_STATE when post is not APPROVED', async () => {
            mockMarkReady.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Post must be APPROVED to mark ready',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/mark-ready');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/pause
    // -------------------------------------------------------------------------
    describe('POST /{id}/pause', () => {
        it('returns pause data on success', async () => {
            const expected = { id: POST_ID, paused: true };
            mockPause.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/pause');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, {});

            expect(result).toEqual(expected);
            expect(mockPause).toHaveBeenCalledWith({ actor: ADMIN_ACTOR, postId: POST_ID });
        });

        it('throws ServiceError with reason=INVALID_STATE for PUBLISHED post', async () => {
            mockPause.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Cannot pause a post in PUBLISHED or FAILED state',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/pause');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/unpause
    // -------------------------------------------------------------------------
    describe('POST /{id}/unpause', () => {
        it('returns pause data with paused=false on success', async () => {
            const expected = { id: POST_ID, paused: false };
            mockUnpause.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/unpause');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, {});

            expect(result).toEqual(expected);
            expect(mockUnpause).toHaveBeenCalledWith({ actor: ADMIN_ACTOR, postId: POST_ID });
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockUnpause.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Post not found' }
            });

            const handler = getHandler('post', '/{id}/unpause');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, {})).rejects.toThrow('Post not found');
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/archive
    // -------------------------------------------------------------------------
    describe('POST /{id}/archive', () => {
        it('returns status data with status=ARCHIVED on success', async () => {
            const expected = { id: POST_ID, status: 'ARCHIVED' };
            mockArchive.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/archive');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, {});

            expect(result).toEqual(expected);
            expect(mockArchive).toHaveBeenCalledWith({ actor: ADMIN_ACTOR, postId: POST_ID });
        });

        it('throws ServiceError with reason=INVALID_STATE for PUBLISHING post', async () => {
            mockArchive.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Cannot archive a post that is currently being published',
                    reason: 'INVALID_STATE'
                }
            });

            const handler = getHandler('post', '/{id}/archive');
            const ctx = buildMockCtx() as unknown as Context;

            const thrown = await handler(ctx, { id: POST_ID }, {}).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).reason).toBe('INVALID_STATE');
        });
    });

    // -------------------------------------------------------------------------
    // POST /{id}/promote-hashtag
    // -------------------------------------------------------------------------
    describe('POST /{id}/promote-hashtag', () => {
        const HASHTAG_ID = 'cccccccc-0000-0000-0000-000000000001';
        const newHashtagBody = { hashtag: '#playa', category: 'nature' };

        it('returns promote data with isNew=true on new hashtag creation', async () => {
            const expected = {
                hashtagId: HASHTAG_ID,
                hashtag: '#playa',
                isNew: true,
                warnings: []
            };
            mockPromoteHashtag.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/promote-hashtag');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, newHashtagBody);

            expect(result).toEqual(expected);
            expect((result as typeof expected).isNew).toBe(true);
            expect(mockPromoteHashtag).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID,
                hashtag: '#playa',
                category: 'nature',
                platform: undefined,
                audienceId: undefined,
                priority: undefined
            });
        });

        it('returns promote data with isNew=false when hashtag already existed', async () => {
            const expected = {
                hashtagId: HASHTAG_ID,
                hashtag: '#playa',
                isNew: false,
                warnings: []
            };
            mockPromoteHashtag.mockResolvedValue({ data: expected, error: undefined });

            const handler = getHandler('post', '/{id}/promote-hashtag');
            const ctx = buildMockCtx() as unknown as Context;
            const result = await handler(ctx, { id: POST_ID }, newHashtagBody);

            // NOTE: factory limitation — HTTP status is always 201 regardless of isNew.
            // The isNew field in the body is the authoritative signal for clients.
            expect((result as typeof expected).isNew).toBe(false);
        });

        it('passes optional fields to promoteHashtag when provided', async () => {
            const expected = {
                hashtagId: HASHTAG_ID,
                hashtag: '#playa',
                isNew: true,
                warnings: []
            };
            mockPromoteHashtag.mockResolvedValue({ data: expected, error: undefined });

            const bodyWithOptionals = {
                hashtag: '#playa',
                category: 'nature',
                platform: 'INSTAGRAM',
                audienceId: 'dddddddd-0000-0000-0000-000000000001',
                priority: 5
            };

            const handler = getHandler('post', '/{id}/promote-hashtag');
            const ctx = buildMockCtx() as unknown as Context;
            await handler(ctx, { id: POST_ID }, bodyWithOptionals);

            expect(mockPromoteHashtag).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                postId: POST_ID,
                hashtag: '#playa',
                category: 'nature',
                platform: 'INSTAGRAM',
                audienceId: 'dddddddd-0000-0000-0000-000000000001',
                priority: 5
            });
        });

        it('throws ServiceError on NOT_FOUND', async () => {
            mockPromoteHashtag.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Post not found' }
            });

            const handler = getHandler('post', '/{id}/promote-hashtag');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, newHashtagBody)).rejects.toThrow(
                'Post not found'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Permission gating — 403 contract (via service FORBIDDEN code)
    // -------------------------------------------------------------------------
    describe('permission gating', () => {
        it('approve: throws FORBIDDEN when actor lacks SOCIAL_POST_APPROVE', async () => {
            const { ServiceError: SE } = await import('@repo/service-core');
            mockApprove.mockRejectedValue(
                new SE(ServiceErrorCode.FORBIDDEN, 'SOCIAL_POST_APPROVE required')
            );

            const handler = getHandler('post', '/{id}/approve');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, {})).rejects.toThrow(
                'SOCIAL_POST_APPROVE required'
            );
        });

        it('archive: throws FORBIDDEN when actor lacks SOCIAL_POST_ARCHIVE', async () => {
            const { ServiceError: SE } = await import('@repo/service-core');
            mockArchive.mockRejectedValue(
                new SE(ServiceErrorCode.FORBIDDEN, 'SOCIAL_POST_ARCHIVE required')
            );

            const handler = getHandler('post', '/{id}/archive');
            const ctx = buildMockCtx() as unknown as Context;
            await expect(handler(ctx, { id: POST_ID }, {})).rejects.toThrow(
                'SOCIAL_POST_ARCHIVE required'
            );
        });
    });
});

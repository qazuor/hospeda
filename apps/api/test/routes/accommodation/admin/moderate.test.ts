/**
 * Unit tests for the admin moderate accommodation review route — SPEC-166 T-020.
 *
 * Verifies:
 *  - Handler returns the updated review on APPROVED decision.
 *  - Handler returns the updated review on REJECTED decision (with reason).
 *  - Handler throws on invalid decision value (Zod rejects PENDING).
 *  - Handler throws ServiceError when the service returns a FORBIDDEN error.
 *  - Handler throws ServiceError when the service returns a NOT_FOUND error.
 *  - Handler is registered on the correct path (`/{id}/moderate`).
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke
 * it directly — avoids booting the full Hono app and middleware chain.
 *
 * @module test/routes/accommodation/admin/moderate
 * @see SPEC-166 T-020
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >()
}));

const { mockModerateReview } = vi.hoisted(() => ({
    mockModerateReview: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedHandlers.set(config.path, config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    AccommodationReviewService: vi.fn(() => ({
        moderateReview: mockModerateReview
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
        warn: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../src/utils/actor';

await import('../../../../src/routes/accommodation/reviews/admin/moderate');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
};

const REVIEW_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const MOCK_REVIEW = {
    id: REVIEW_ID,
    accommodationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    userId: 'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
    moderationState: ModerationStatusEnum.APPROVED,
    moderatedById: 'admin-actor-id',
    moderatedAt: new Date(),
    moderationReason: null
};

function buildMockContext(): Record<string, unknown> {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() };
}

function getHandler(): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get('/{id}/moderate');
    if (!handler) {
        throw new Error('No handler captured for path: /{id}/moderate');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminModerateAccommodationReviewRoute handler — SPEC-166 T-020', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Registration
    // -----------------------------------------------------------------------

    describe('route registration', () => {
        it('handler is registered on path /{id}/moderate', () => {
            expect(capturedHandlers.has('/{id}/moderate')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path — APPROVED
    // -----------------------------------------------------------------------

    describe('on APPROVED decision', () => {
        it('returns the updated review from the service', async () => {
            const approvedReview = {
                ...MOCK_REVIEW,
                moderationState: ModerationStatusEnum.APPROVED
            };
            mockModerateReview.mockResolvedValue({ data: approvedReview });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = await handler(
                ctx,
                { id: REVIEW_ID },
                { decision: ModerationStatusEnum.APPROVED }
            );

            expect(result).toEqual(approvedReview);
        });

        it('calls moderateReview with correct parameters', async () => {
            mockModerateReview.mockResolvedValue({ data: MOCK_REVIEW });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            await handler(ctx, { id: REVIEW_ID }, { decision: ModerationStatusEnum.APPROVED });

            expect(mockModerateReview).toHaveBeenCalledOnce();
            const [callArg] = mockModerateReview.mock.calls[0] ?? [];
            expect(callArg).toMatchObject({
                id: REVIEW_ID,
                decision: ModerationStatusEnum.APPROVED,
                actor: ADMIN_ACTOR
            });
        });
    });

    // -----------------------------------------------------------------------
    // Happy path — REJECTED (with reason)
    // -----------------------------------------------------------------------

    describe('on REJECTED decision', () => {
        it('returns the updated review from the service', async () => {
            const rejectedReview = {
                ...MOCK_REVIEW,
                moderationState: ModerationStatusEnum.REJECTED,
                moderationReason: 'Inappropriate content'
            };
            mockModerateReview.mockResolvedValue({ data: rejectedReview });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = await handler(
                ctx,
                { id: REVIEW_ID },
                { decision: ModerationStatusEnum.REJECTED, reason: 'Inappropriate content' }
            );

            expect(result).toEqual(rejectedReview);
        });

        it('passes reason to the service', async () => {
            mockModerateReview.mockResolvedValue({ data: MOCK_REVIEW });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const reason = 'Contains offensive language';
            await handler(
                ctx,
                { id: REVIEW_ID },
                { decision: ModerationStatusEnum.REJECTED, reason }
            );

            const [callArg] = mockModerateReview.mock.calls[0] ?? [];
            expect((callArg as { reason: string }).reason).toBe(reason);
        });
    });

    // -----------------------------------------------------------------------
    // Invalid decision
    // -----------------------------------------------------------------------

    describe('on invalid decision value', () => {
        it('throws when decision is PENDING (not a valid moderation outcome)', async () => {
            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(
                handler(ctx, { id: REVIEW_ID }, { decision: ModerationStatusEnum.PENDING })
            ).rejects.toThrow();
        });

        it('throws when decision is an unknown string', async () => {
            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(
                handler(ctx, { id: REVIEW_ID }, { decision: 'UNKNOWN_STATE' })
            ).rejects.toThrow();
        });

        it('throws when decision is missing', async () => {
            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(handler(ctx, { id: REVIEW_ID }, {})).rejects.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // Error path — permission denial
    // -----------------------------------------------------------------------

    describe('on permission denial', () => {
        it('throws ServiceError when service returns FORBIDDEN', async () => {
            mockModerateReview.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: ACCOMMODATION_REVIEW_MODERATE required'
                }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(
                handler(ctx, { id: REVIEW_ID }, { decision: ModerationStatusEnum.APPROVED })
            ).rejects.toThrow(/ACCOMMODATION_REVIEW_MODERATE/);
        });
    });

    // -----------------------------------------------------------------------
    // Error path — not found
    // -----------------------------------------------------------------------

    describe('on review not found', () => {
        it('throws ServiceError when service returns NOT_FOUND', async () => {
            mockModerateReview.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `Accommodation review not found: ${REVIEW_ID}`
                }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(
                handler(ctx, { id: REVIEW_ID }, { decision: ModerationStatusEnum.APPROVED })
            ).rejects.toThrow(/not found/i);
        });
    });
});

/**
 * Unit tests for the admin reviews pending-count route — SPEC-166 T-019.
 *
 * Verifies:
 *  - Handler returns `{ count, byType }` on service success.
 *  - `count` equals the sum of `accommodationReviews` + `destinationReviews`.
 *  - Handler throws ServiceError when BOTH services fail (permission denied).
 *  - Partial failure (one service fails) still returns a useful response.
 *  - Handler is registered on the correct path (`/reviews/pending-count`).
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke
 * it directly — avoids booting the full Hono app and middleware chain.
 * (Same pattern as `admin-pending-count.test.ts` for SPEC-155 T-010.)
 *
 * @module test/routes/moderation/admin-reviews-pending-count
 * @see SPEC-166 T-019
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs — available inside vi.mock() factory closures.
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >()
}));

const { mockAccGetPendingCount, mockDestGetPendingCount } = vi.hoisted(() => ({
    mockAccGetPendingCount: vi.fn(),
    mockDestGetPendingCount: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/route-factory', () => ({
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

vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    AccommodationReviewService: vi.fn(() => ({
        getPendingCount: mockAccGetPendingCount
    })),
    DestinationReviewService: vi.fn(() => ({
        getPendingCount: mockDestGetPendingCount
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

vi.mock('../../../src/utils/logger', () => ({
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

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';

// Trigger module execution — causes createAdminRoute to be called, which
// stores the handler in capturedHandlers.
await import('../../../src/routes/moderation/admin/reviews-pending-count');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
        PermissionEnum.DESTINATION_REVIEW_MODERATE
    ]
};

/** Actor that holds ONLY the destination-review moderate permission (OR gate scenario). */
const DESTINATION_ONLY_MODERATOR: Actor = {
    id: 'dest-only-moderator-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.DESTINATION_REVIEW_MODERATE]
};

/** Actor that holds NEITHER moderate permission — both services should deny. */
const NO_MODERATE_ACTOR: Actor = {
    id: 'no-moderate-actor-id',
    role: RoleEnum.ADMIN,
    permissions: []
};

function buildMockContext(): Record<string, unknown> {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() };
}

function getHandler(): (ctx: unknown, params: unknown, body: unknown) => Promise<unknown> {
    const handler = capturedHandlers.get('/reviews/pending-count');
    if (!handler) {
        throw new Error('No handler captured for path: /reviews/pending-count');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminReviewsPendingCountRoute handler — SPEC-166 T-019', () => {
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
        it('handler is registered on path /reviews/pending-count', () => {
            expect(capturedHandlers.has('/reviews/pending-count')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path — both services succeed
    // -----------------------------------------------------------------------

    describe('on service success (both services)', () => {
        it('returns count and byType breakdown', async () => {
            mockAccGetPendingCount.mockResolvedValue({ data: { count: 4 } });
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 3 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as {
                count: number;
                byType: { accommodationReviews: number; destinationReviews: number };
            };

            expect(result.count).toBe(7);
            expect(result.byType.accommodationReviews).toBe(4);
            expect(result.byType.destinationReviews).toBe(3);
        });

        it('count equals sum of byType values', async () => {
            mockAccGetPendingCount.mockResolvedValue({ data: { count: 10 } });
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 5 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as {
                count: number;
                byType: { accommodationReviews: number; destinationReviews: number };
            };

            expect(result.count).toBe(
                result.byType.accommodationReviews + result.byType.destinationReviews
            );
        });

        it('returns zero count when no items are pending', async () => {
            mockAccGetPendingCount.mockResolvedValue({ data: { count: 0 } });
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 0 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as { count: number };

            expect(result.count).toBe(0);
        });

        it('response contains all required byType keys', async () => {
            mockAccGetPendingCount.mockResolvedValue({ data: { count: 2 } });
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 1 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as { byType: Record<string, number> };

            expect(result.byType).toHaveProperty('accommodationReviews');
            expect(result.byType).toHaveProperty('destinationReviews');
        });

        it('forwards the actor to both services', async () => {
            const specificActor = { ...ADMIN_ACTOR, id: 'specific-actor-99' };
            mockGetActorFromContext.mockReturnValue(specificActor);
            mockAccGetPendingCount.mockResolvedValue({ data: { count: 1 } });
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 0 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            await handler(ctx, {}, {});

            expect(mockAccGetPendingCount).toHaveBeenCalledOnce();
            expect(mockDestGetPendingCount).toHaveBeenCalledOnce();
            const [accArg] = mockAccGetPendingCount.mock.calls[0] ?? [];
            const [destArg] = mockDestGetPendingCount.mock.calls[0] ?? [];
            expect((accArg as { actor: Actor }).actor).toEqual(specificActor);
            expect((destArg as { actor: Actor }).actor).toEqual(specificActor);
        });
    });

    // -----------------------------------------------------------------------
    // Partial failure — one service returns an error
    // -----------------------------------------------------------------------

    describe('on partial service failure', () => {
        it('returns partial result when accommodation service fails (counts destination only)', async () => {
            mockAccGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'No permission' }
            });
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 6 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as {
                count: number;
                byType: { accommodationReviews: number; destinationReviews: number };
            };

            // Falls back to 0 for the failed service
            expect(result.byType.accommodationReviews).toBe(0);
            expect(result.byType.destinationReviews).toBe(6);
            expect(result.count).toBe(6);
        });

        it('returns partial result when destination service fails (counts accommodation only)', async () => {
            mockAccGetPendingCount.mockResolvedValue({ data: { count: 3 } });
            mockDestGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'No permission' }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as {
                count: number;
                byType: { accommodationReviews: number; destinationReviews: number };
            };

            expect(result.byType.accommodationReviews).toBe(3);
            expect(result.byType.destinationReviews).toBe(0);
            expect(result.count).toBe(3);
        });

        // OR gate: a destination-only moderator's accommodation service call returns
        // FORBIDDEN (service self-gates), so accommodation contributes 0.
        // The destination count is still returned — the actor is NOT blocked at the
        // route level (spec §7 OR semantics). This test documents that removing
        // requiredPermissions from the factory config is the correct fix.
        it('destination-only moderator gets partial response: accommodation=0, destination count present', async () => {
            mockGetActorFromContext.mockReturnValue(DESTINATION_ONLY_MODERATOR);
            // The accommodation service denies — actor lacks ACCOMMODATION_REVIEW_MODERATE.
            mockAccGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'Insufficient permissions' }
            });
            // The destination service succeeds — actor has DESTINATION_REVIEW_MODERATE.
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 5 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;
            const result = (await handler(ctx, {}, {})) as {
                count: number;
                byType: { accommodationReviews: number; destinationReviews: number };
            };

            expect(result.byType.accommodationReviews).toBe(0);
            expect(result.byType.destinationReviews).toBe(5);
            expect(result.count).toBe(5);
        });
    });

    // -----------------------------------------------------------------------
    // Full failure — both services return errors
    // -----------------------------------------------------------------------

    describe('on total service failure (both services error)', () => {
        it('throws ServiceError when both services fail', async () => {
            mockAccGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'Permission denied' }
            });
            mockDestGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'Permission denied' }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(handler(ctx, {}, {})).rejects.toThrow(/Permission denied/);
        });

        // Actor holds NEITHER moderate permission — both services deny at the
        // service level. The handler must re-throw so the route factory can
        // produce a 403 response (both-denied → effective OR gate failure).
        it('actor with neither moderate permission causes both services to deny, handler throws', async () => {
            mockGetActorFromContext.mockReturnValue(NO_MODERATE_ACTOR);
            mockAccGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'Insufficient permissions' }
            });
            mockDestGetPendingCount.mockResolvedValue({
                error: { code: ServiceErrorCode.FORBIDDEN, message: 'Insufficient permissions' }
            });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(handler(ctx, {}, {})).rejects.toThrow(/Insufficient permissions/);
        });

        it('propagates unexpected thrown errors from the accommodation service', async () => {
            mockAccGetPendingCount.mockRejectedValue(new Error('connection timeout'));
            mockDestGetPendingCount.mockResolvedValue({ data: { count: 0 } });

            const handler = getHandler();
            const ctx = buildMockContext() as unknown as Context;

            await expect(handler(ctx, {}, {})).rejects.toThrow('connection timeout');
        });
    });
});

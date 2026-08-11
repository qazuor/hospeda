/**
 * Admin moderation of reviews and replies (HOS-376 T-037).
 *
 * ```
 * GET  /api/v1/admin/host-trades/reviews
 * POST /api/v1/admin/host-trades/reviews/{id}/moderate
 * GET  /api/v1/admin/host-trades/replies
 * POST /api/v1/admin/host-trades/replies/{id}/moderate
 * GET  /api/v1/admin/moderation/host-trade-reviews/pending-count
 * ```
 *
 * TWO QUEUES THAT MEAN DIFFERENT THINGS, and the badge has to keep them apart.
 * A review is born APPROVED, so its pending pile is BACKLOG — nobody is waiting
 * on it. A reply is born PENDING, so its pile is providers who cannot answer a
 * complaint about their business until somebody clears them. Summed into one
 * number, forty harmless review items would look exactly like forty blocked
 * providers, and the moderator would have no way to tell which day is urgent.
 *
 * @module test/routes/host-trade/admin-reviews
 */

import type { PermissionEnum } from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum as Permissions, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const {
    mockReviewAdminList,
    mockModerateReview,
    mockReviewPendingCount,
    mockReplyAdminList,
    mockModerateReply,
    mockReplyPendingCount
} = vi.hoisted(() => ({
    mockReviewAdminList: vi.fn(),
    mockModerateReview: vi.fn(),
    mockReviewPendingCount: vi.fn(),
    mockReplyAdminList: vi.fn(),
    mockModerateReply: vi.fn(),
    mockReplyPendingCount: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeReviewService: vi.fn().mockImplementation(function () {
            return {
                adminList: mockReviewAdminList,
                moderateReview: mockModerateReview,
                getPendingCount: mockReviewPendingCount
            };
        }),
        HostTradeReviewReplyService: vi.fn().mockImplementation(function () {
            return {
                adminList: mockReplyAdminList,
                moderateReply: mockModerateReply,
                getPendingCount: mockReplyPendingCount
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const {
    adminListHostTradeRepliesRoute,
    adminListHostTradeReviewsRoute,
    adminModerateHostTradeReplyRoute,
    adminModerateHostTradeReviewRoute
} = await import('../../../src/routes/host-trade/admin/reviews.js');

const { adminHostTradeReviewsPendingCountRoute } = await import(
    '../../../src/routes/moderation/admin/host-trade-reviews-pending-count.js'
);

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const REVIEW_ID = '22222222-2222-4222-8222-222222222222';
const REPLY_ID = '33333333-3333-4333-8333-333333333333';

const HT_ID = '44444444-4444-4444-8444-444444444444';

/**
 * FULL entities, not stubs. The route factory validates the response payload
 * against the declared schema and answers 500 when it does not match, so a
 * fixture missing an audit column would fail as a server error and say nothing
 * about the route.
 */
const MOCK_REVIEW = {
    id: REVIEW_ID,
    hostTradeId: HT_ID,
    hostUserId: ADMIN_ID,
    overallRating: 2,
    rating: null,
    averageRating: null,
    respectedBenefit: false,
    content: 'No respetó el descuento acordado.',
    lifecycleState: 'ACTIVE',
    moderationState: 'PENDING',
    moderatedById: null,
    moderatedAt: null,
    moderationReason: null,
    editedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    createdById: ADMIN_ID,
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

const MOCK_REPLY = {
    id: REPLY_ID,
    reviewId: REVIEW_ID,
    authorUserId: ADMIN_ID,
    content: 'Aplicamos el descuento que figura en la ficha.',
    moderationState: 'PENDING',
    moderatedById: null,
    moderatedAt: null,
    moderationReason: null,
    reviewEditedAfterReply: false,
    createdAt: new Date('2026-08-02T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-02T00:00:00Z').toISOString(),
    createdById: ADMIN_ID,
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

/**
 * Admin routes gate on panel access FIRST and the domain permission second, so
 * every fixture here carries `ACCESS_PANEL_ADMIN`. Dropping it from a
 * "missing permission" case would prove the wrong refusal fired.
 */
const ALL_PERMISSIONS = [
    Permissions.ACCESS_PANEL_ADMIN,
    Permissions.HOST_TRADE_REVIEW_VIEW_ALL,
    Permissions.HOST_TRADE_REVIEW_MODERATE
];

function buildApp(permissions: PermissionEnum[] = ALL_PERMISSIONS): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: ADMIN_ID, roles: [RoleEnum.ADMIN], permissions });
        return next();
    });

    app.route('/', adminListHostTradeReviewsRoute);
    app.route('/', adminModerateHostTradeReviewRoute);
    app.route('/', adminListHostTradeRepliesRoute);
    app.route('/', adminModerateHostTradeReplyRoute);
    app.route('/', adminHostTradeReviewsPendingCountRoute);

    return app;
}

const post = (app: Hono<AppBindings>, path: string, body?: unknown) =>
    app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {})
    });

beforeEach(() => {
    vi.clearAllMocks();
    mockReviewAdminList.mockResolvedValue({ data: { items: [MOCK_REVIEW], total: 1 } });
    mockReplyAdminList.mockResolvedValue({ data: { items: [MOCK_REPLY], total: 1 } });
    mockModerateReview.mockResolvedValue({
        data: { review: { ...MOCK_REVIEW, moderationState: 'REJECTED' } }
    });
    mockModerateReply.mockResolvedValue({
        data: { reply: { ...MOCK_REPLY, moderationState: 'APPROVED' } }
    });
    mockReviewPendingCount.mockResolvedValue({ data: { count: 7 } });
    mockReplyPendingCount.mockResolvedValue({ data: { count: 2 } });
});

describe('registration', () => {
    it('mounts the four host-trade moderation routes on the admin router', async () => {
        const { adminHostTradeRoutes } = await import(
            '../../../src/routes/host-trade/admin/index.js'
        );
        const registered = (
            adminHostTradeRoutes as unknown as { routes: { method: string; path: string }[] }
        ).routes.map((route) => `${route.method.toUpperCase()} ${route.path}`);

        expect(registered).toContain('GET /reviews');
        expect(registered).toContain('POST /reviews/:id/moderate');
        expect(registered).toContain('GET /replies');
        expect(registered).toContain('POST /replies/:id/moderate');
    });

    it('mounts the pending-count on the admin moderation router', async () => {
        const { adminModerationRoutes } = await import(
            '../../../src/routes/moderation/admin/index.js'
        );
        const registered = (
            adminModerationRoutes as unknown as { routes: { method: string; path: string }[] }
        ).routes.map((route) => `${route.method.toUpperCase()} ${route.path}`);

        expect(registered).toContain('GET /host-trade-reviews/pending-count');
    });
});

describe('GET /reviews', () => {
    it('returns the page and its pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request('/reviews?page=1&pageSize=10');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
    });

    /** The queue screen's filter: the moderator works one state at a time. */
    it('forwards the moderationState filter', async () => {
        const app = buildApp();

        await app.request(`/reviews?moderationState=${ModerationStatusEnum.PENDING}`);

        const query = mockReviewAdminList.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(query.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    /**
     * The ADMIN read must not be narrowed to APPROVED the way the directory
     * listing is — a queue that could only show what is already published would
     * have nothing to moderate.
     */
    it('does not force a moderation state of its own', async () => {
        const app = buildApp();

        await app.request('/reviews');

        const query = mockReviewAdminList.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(query.moderationState).toBeUndefined();
    });

    it('refuses an actor without HOST_TRADE_REVIEW_VIEW_ALL', async () => {
        const app = buildApp([
            Permissions.ACCESS_PANEL_ADMIN,
            Permissions.HOST_TRADE_REVIEW_MODERATE
        ]);

        const res = await app.request('/reviews');

        expect(res.status).toBe(403);
        expect(mockReviewAdminList).not.toHaveBeenCalled();
    });
});

describe('POST /reviews/{id}/moderate', () => {
    it('passes the decision and the reason to the service', async () => {
        const app = buildApp();

        const res = await post(app, `/reviews/${REVIEW_ID}/moderate`, {
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Datos personales de un tercero.'
        });

        expect(res.status).toBe(200);
        expect(mockModerateReview).toHaveBeenCalledWith({
            id: REVIEW_ID,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Datos personales de un tercero.',
            actor: expect.anything()
        });
    });

    it('accepts a decision with no reason', async () => {
        const app = buildApp();

        const res = await post(app, `/reviews/${REVIEW_ID}/moderate`, {
            decision: ModerationStatusEnum.APPROVED
        });

        expect(res.status).toBe(200);
    });

    /** Only the two decisions exist — PENDING is a state, not a verdict. */
    it('refuses PENDING as a decision', async () => {
        const app = buildApp();

        const res = await post(app, `/reviews/${REVIEW_ID}/moderate`, {
            decision: ModerationStatusEnum.PENDING
        });

        expect(res.status).toBe(400);
        expect(mockModerateReview).not.toHaveBeenCalled();
    });

    it('refuses an actor without HOST_TRADE_REVIEW_MODERATE', async () => {
        const app = buildApp([
            Permissions.ACCESS_PANEL_ADMIN,
            Permissions.HOST_TRADE_REVIEW_VIEW_ALL
        ]);

        const res = await post(app, `/reviews/${REVIEW_ID}/moderate`, {
            decision: ModerationStatusEnum.APPROVED
        });

        expect(res.status).toBe(403);
        expect(mockModerateReview).not.toHaveBeenCalled();
    });

    it('answers 404 for a review that does not exist', async () => {
        mockModerateReview.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'Review not found' }
        });
        const app = buildApp();

        const res = await post(app, `/reviews/${REVIEW_ID}/moderate`, {
            decision: ModerationStatusEnum.APPROVED
        });

        expect(res.status).toBe(404);
    });
});

describe('GET /replies and POST /replies/{id}/moderate', () => {
    it('lists the replies with their pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request('/replies?page=1&pageSize=10');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
    });

    it('moderates a reply', async () => {
        const app = buildApp();

        const res = await post(app, `/replies/${REPLY_ID}/moderate`, {
            decision: ModerationStatusEnum.APPROVED
        });

        expect(res.status).toBe(200);
        expect(mockModerateReply).toHaveBeenCalledWith({
            id: REPLY_ID,
            decision: ModerationStatusEnum.APPROVED,
            reason: undefined,
            actor: expect.anything()
        });
    });

    it('refuses an actor without HOST_TRADE_REVIEW_MODERATE', async () => {
        const app = buildApp([
            Permissions.ACCESS_PANEL_ADMIN,
            Permissions.HOST_TRADE_REVIEW_VIEW_ALL
        ]);

        const res = await post(app, `/replies/${REPLY_ID}/moderate`, {
            decision: ModerationStatusEnum.APPROVED
        });

        expect(res.status).toBe(403);
        expect(mockModerateReply).not.toHaveBeenCalled();
    });
});

describe('GET /host-trade-reviews/pending-count', () => {
    /**
     * THE POINT OF THE ENDPOINT. Both queues, kept apart. A single total would
     * make a backlog of reviews (nobody waiting) indistinguishable from a pile
     * of replies (providers who cannot answer until cleared).
     */
    it('reports both queues separately', async () => {
        const app = buildApp();

        const res = await app.request('/host-trade-reviews/pending-count');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.byType.reviews).toBe(7);
        expect(body.data.byType.replies).toBe(2);
        expect(mockReviewPendingCount).toHaveBeenCalled();
        expect(mockReplyPendingCount).toHaveBeenCalled();
    });

    it('totals the two queues', async () => {
        const app = buildApp();

        const res = await app.request('/host-trade-reviews/pending-count');
        const body = await res.json();

        expect(body.data.count).toBe(9);
    });

    it('refuses an actor without HOST_TRADE_REVIEW_MODERATE', async () => {
        const app = buildApp([
            Permissions.ACCESS_PANEL_ADMIN,
            Permissions.HOST_TRADE_REVIEW_VIEW_ALL
        ]);

        const res = await app.request('/host-trade-reviews/pending-count');

        expect(res.status).toBe(403);
        expect(mockReviewPendingCount).not.toHaveBeenCalled();
    });
});

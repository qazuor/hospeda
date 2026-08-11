/**
 * The provider's own review listing (HOS-376 T-050, spec §7.5).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/reviews
 * ```
 *
 * Two things here matter more than the happy path.
 *
 * The SHAPE: the reply comes back with its `moderationState`, which is the only
 * reason this endpoint exists next to `GET /{id}/reviews`. The route factory
 * validates the response payload, so a service that started returning the
 * directory shape would fail these routes with a 500 rather than quietly
 * hiding a provider's own pending answer from him.
 *
 * The ROUTING: `/mine/reviews` and `/{id}/reviews` overlap — "mine" is a
 * candidate `:id`. When the wrong one wins the failure is not a crash but a
 * 400, because "mine" is not a uuid.
 *
 * @module test/routes/host-trade/mine-reviews
 */

import { type PermissionEnum, PermissionEnum as Permissions, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetOwn, mockListForOwner, mockListForDirectory } = vi.hoisted(() => ({
    mockGetOwn: vi.fn(),
    mockListForOwner: vi.fn(),
    mockListForDirectory: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return { getOwn: mockGetOwn };
        }),
        HostTradeReviewService: vi.fn().mockImplementation(function () {
            return { listForOwner: mockListForOwner, listForDirectory: mockListForDirectory };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedListOwnReviewsRoute } = await import(
    '../../../src/routes/host-trade/protected/mine-reviews.js'
);
const { protectedListProviderReviewsRoute } = await import(
    '../../../src/routes/host-trade/protected/directory-reviews.js'
);
const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = '33333333-3333-4333-8333-333333333333';
const REPLY_ID = '44444444-4444-4444-8444-444444444444';

const MOCK_REVIEW = {
    id: REVIEW_ID,
    hostTradeId: HT_ID,
    hostUserId: '55555555-5555-4555-8555-555555555555',
    overallRating: 4,
    rating: null,
    averageRating: null,
    respectedBenefit: true,
    content: 'Vino el mismo día.',
    moderationState: 'APPROVED',
    editedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString()
};

/** A row as its subject reads it: the answer carries its moderation state. */
const MOCK_OWNER_ROW = {
    review: MOCK_REVIEW,
    author: { id: MOCK_REVIEW.hostUserId, displayName: 'Ana Anfitriona', image: null },
    reply: {
        id: REPLY_ID,
        content: 'Gracias por la devolución.',
        moderationState: 'PENDING',
        moderationReason: null,
        reviewEditedAfterReply: false,
        createdAt: new Date('2026-08-02T00:00:00Z').toISOString(),
        updatedAt: new Date('2026-08-02T00:00:00Z').toISOString()
    }
};

/** An app carrying the REAL error handler, so statuses measure what ships. */
function buildApp(permissions: PermissionEnum[] = []): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((c, next) => {
        c.set('actor', { id: OWNER_ID, roles: [RoleEnum.USER], permissions });
        return next();
    });

    app.route('/', protectedListOwnReviewsRoute);
    app.route('/', protectedListProviderReviewsRoute);

    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetOwn.mockResolvedValue({ data: { trade: { id: HT_ID, slug: 'plomero-centro' } } });
    mockListForOwner.mockResolvedValue({ data: { items: [MOCK_OWNER_ROW], total: 1 } });
    mockListForDirectory.mockResolvedValue({ data: { items: [], total: 0 } });
});

describe('GET /mine/reviews', () => {
    it('returns the caller’s reviews with the pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request('/mine/reviews', { method: 'GET' });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
    });

    it('serves a PENDING reply, which the directory listing would have hidden', async () => {
        // The whole reason this endpoint exists: its author has to see that the
        // answer he wrote is waiting for a moderator, not that it vanished.
        const app = buildApp();

        const res = await app.request('/mine/reviews', { method: 'GET' });

        const body = await res.json();
        expect(body.data.items[0].reply.moderationState).toBe('PENDING');
    });

    it('serves the rejection reason when an answer was turned down', async () => {
        mockListForOwner.mockResolvedValue({
            data: {
                items: [
                    {
                        ...MOCK_OWNER_ROW,
                        reply: {
                            ...MOCK_OWNER_ROW.reply,
                            moderationState: 'REJECTED',
                            moderationReason: 'Incluía la dirección del anfitrión.'
                        }
                    }
                ],
                total: 1
            }
        });
        const app = buildApp();

        const res = await app.request('/mine/reviews', { method: 'GET' });

        const body = await res.json();
        expect(body.data.items[0].reply.moderationReason).toMatch(/dirección/i);
    });

    it('reads the listing the caller owns, resolved server-side', async () => {
        // The id never comes from the request: the path carries none and the
        // route declares no query parameter for one, so "a provider cannot read
        // another's reviews" is structural rather than a check.
        const app = buildApp();

        const res = await app.request(
            '/mine/reviews?hostTradeId=99999999-9999-4999-8999-999999999999',
            { method: 'GET' }
        );

        // An undeclared query parameter is refused by the factory outright,
        // which is a stronger answer than ignoring it.
        expect(res.status).toBe(400);
        expect(mockListForOwner).not.toHaveBeenCalled();
    });

    it('takes the listing id from the ownership lookup, not from the caller', async () => {
        const app = buildApp();

        await app.request('/mine/reviews', { method: 'GET' });

        expect(mockListForOwner.mock.calls[0]?.[0].hostTradeId).toBe(HT_ID);
    });

    it('answers 404 when the caller owns no listing', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });
        const app = buildApp();

        const res = await app.request('/mine/reviews', { method: 'GET' });

        expect(res.status).toBe(404);
        expect(mockListForOwner).not.toHaveBeenCalled();
    });

    it('serves a provider holding no host-trade permission', async () => {
        // HOS-278 AC-7: an approved provider is an ordinary account. Requiring a
        // HOST_TRADE_* permission would lock him out of his own listing.
        const app = buildApp([]);

        const res = await app.request('/mine/reviews', { method: 'GET' });

        expect(res.status).toBe(200);
    });

    it('forwards the page window', async () => {
        const app = buildApp();

        await app.request('/mine/reviews?page=2&pageSize=5', { method: 'GET' });

        expect(mockListForOwner.mock.calls[0]?.[0]).toMatchObject({ page: 2, pageSize: 5 });
    });
});

describe('routing — /mine/reviews must not be read as a provider id', () => {
    it('reaches the owner listing, not the directory one', async () => {
        const app = buildApp([Permissions.HOST_TRADE_VIEW]);

        const res = await app.request('/mine/reviews', { method: 'GET' });

        expect(res.status).toBe(200);
        expect(mockListForOwner).toHaveBeenCalledTimes(1);
        expect(mockListForDirectory).not.toHaveBeenCalled();
    });

    it('still reaches the directory listing for a real provider id', async () => {
        // The complementary half: without it, "the owner route wins" would also
        // pass on a mount where the directory route never resolves at all.
        const app = buildApp([Permissions.HOST_TRADE_VIEW]);

        const res = await app.request(`/${HT_ID}/reviews`, { method: 'GET' });

        expect(res.status).toBe(200);
        expect(mockListForDirectory).toHaveBeenCalledTimes(1);
        expect(mockListForOwner).not.toHaveBeenCalled();
    });
});

/**
 * The directory's review listing (HOS-376 T-036).
 *
 * ```
 * GET /api/v1/protected/host-trades/{id}/reviews
 * ```
 *
 * What this layer owns is narrow and worth pinning anyway: the provider comes
 * from the path, the page window from the query, the gate is the directory's
 * own `HOST_TRADE_VIEW`, and the endpoint declares NO moderation filter.
 *
 * The two rules underneath it are asserted where they live, on purpose:
 *
 * - "a PENDING review never appears" is the service's forced filter, covered in
 *   `packages/service-core/test/services/hostTrade/host-trade-review.service.test.ts`.
 * - "a PENDING reply hides the ANSWER but keeps the REVIEW" is a SQL join
 *   predicate, covered against a real database in
 *   `packages/db/test/integration/host-trade-review-directory.integration.test.ts`.
 *
 * A request-level test with a mocked service could restate either of them and
 * would prove neither.
 *
 * @module test/routes/host-trade/directory-reviews
 */

import type { PermissionEnum } from '@repo/schemas';
import { PermissionEnum as Permissions, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockListForDirectory } = vi.hoisted(() => ({ mockListForDirectory: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeReviewService: vi.fn().mockImplementation(function () {
            return { listForDirectory: mockListForDirectory };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedListProviderReviewsRoute } = await import(
    '../../../src/routes/host-trade/protected/directory-reviews.js'
);

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const HOST_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';

const MOCK_ROW = {
    review: {
        id: '33333333-3333-4333-8333-333333333333',
        hostTradeId: HT_ID,
        hostUserId: HOST_ID,
        overallRating: 5,
        rating: null,
        averageRating: null,
        respectedBenefit: true,
        content: 'Vino el mismo día y respetó el descuento.',
        moderationState: 'APPROVED',
        editedAt: null,
        createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
        updatedAt: new Date('2026-08-01T00:00:00Z').toISOString()
    },
    author: { id: HOST_ID, displayName: 'Marta Giménez', image: null },
    reply: null
};

function buildApp(
    permissions: PermissionEnum[] = [Permissions.HOST_TRADE_VIEW]
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());

    app.use((c, next) => {
        c.set('actor', { id: HOST_ID, roles: [RoleEnum.HOST], permissions });
        return next();
    });

    app.route('/', protectedListProviderReviewsRoute);

    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockListForDirectory.mockResolvedValue({ data: { items: [MOCK_ROW], total: 1 } });
});

describe('registration', () => {
    it('mounts the directory listing on the protected router', async () => {
        const { protectedHostTradeRoutes } = await import(
            '../../../src/routes/host-trade/protected/index.js'
        );
        const registered = (
            protectedHostTradeRoutes as unknown as { routes: { method: string; path: string }[] }
        ).routes.map((route) => `${route.method.toUpperCase()} ${route.path}`);

        expect(registered).toContain('GET /:id/reviews');
    });
});

describe('GET /{id}/reviews', () => {
    it('returns the page and its pagination envelope', async () => {
        const app = buildApp();

        const res = await app.request(`/${HT_ID}/reviews?page=1&pageSize=10`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.pagination.total).toBe(1);
    });

    it('takes the provider from the path and the window from the query', async () => {
        const app = buildApp();

        await app.request(`/${HT_ID}/reviews?page=2&pageSize=5`);

        expect(mockListForDirectory).toHaveBeenCalledWith(
            { hostTradeId: HT_ID, page: 2, pageSize: 5 },
            expect.anything()
        );
    });

    /**
     * The directory's own gate — these rows ARE the directory. A provider
     * reading his own reviews holds no such permission; that is `/mine/reviews`,
     * a different endpoint.
     */
    it('refuses an actor without HOST_TRADE_VIEW', async () => {
        const app = buildApp([]);

        const res = await app.request(`/${HT_ID}/reviews`);

        expect(res.status).toBe(403);
        expect(mockListForDirectory).not.toHaveBeenCalled();
    });

    /**
     * The endpoint declares no moderation filter, and the list factory REFUSES
     * a query parameter it does not declare rather than dropping it quietly —
     * measured, not assumed: this answers 400 and the service is never reached.
     * That is stronger than a silent strip, because an attempt to widen the
     * read shows up as an error instead of as a normal-looking page.
     */
    it('refuses a caller-supplied moderationState instead of dropping it', async () => {
        const app = buildApp();

        const res = await app.request(`/${HT_ID}/reviews?moderationState=PENDING`);

        expect(res.status).toBe(400);
        expect(mockListForDirectory).not.toHaveBeenCalled();
    });

    it('rejects a provider id that is not a uuid', async () => {
        const app = buildApp();

        const res = await app.request('/not-a-uuid/reviews');

        expect(res.status).toBe(400);
        expect(mockListForDirectory).not.toHaveBeenCalled();
    });

    it('serves the author of each review so the card can name them', async () => {
        const app = buildApp();

        const res = await app.request(`/${HT_ID}/reviews`);
        const body = await res.json();

        expect(body.data.items[0].author.displayName).toBe('Marta Giménez');
    });
});

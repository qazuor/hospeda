/**
 * The provider's own tab counts in one read (owner decision 22, Mi cuenta UI
 * epic).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/tab-counts
 * ```
 */

import { RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetOwn, mockListForProvider, mockListForOwner } = vi.hoisted(() => ({
    mockGetOwn: vi.fn(),
    mockListForProvider: vi.fn(),
    mockListForOwner: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeService: vi.fn().mockImplementation(function () {
            return { getOwn: mockGetOwn };
        }),
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return { listForProvider: mockListForProvider };
        }),
        HostTradeReviewService: vi.fn().mockImplementation(function () {
            return { listForOwner: mockListForOwner };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedGetMyTabCountsRoute } = await import(
    '../../../src/routes/host-trade/protected/mine-tab-counts.js'
);
const { protectedHostTradeRoutes } = await import(
    '../../../src/routes/host-trade/protected/index.js'
);
const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const HT_ID = '22222222-2222-4222-8222-222222222222';

function buildApp(router: Hono<AppBindings>): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((c, next) => {
        c.set('actor', { id: OWNER_ID, roles: [RoleEnum.USER], permissions: [] });
        return next();
    });
    app.route('/', router);
    return app;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetOwn.mockResolvedValue({ data: { trade: { id: HT_ID } } });
    mockListForProvider.mockResolvedValue({ data: { items: [], total: 3 } });
    mockListForOwner.mockResolvedValue({ data: { items: [], total: 7 } });
});

describe('GET /mine/tab-counts', () => {
    it('answers both counts with the filters the page used', async () => {
        // Act
        const res = await buildApp(protectedGetMyTabCountsRoute).request('/mine/tab-counts');

        // Assert
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ pendingUsages: 3, reviews: 7 });
        expect(mockListForProvider).toHaveBeenCalledWith(
            {
                hostTradeId: HT_ID,
                status: 'PENDING',
                declaredBy: 'HOST',
                page: 1,
                pageSize: 1
            },
            expect.objectContaining({ id: OWNER_ID })
        );
        expect(mockListForOwner).toHaveBeenCalledWith(
            { hostTradeId: HT_ID, page: 1, pageSize: 1 },
            expect.objectContaining({ id: OWNER_ID })
        );
    });

    it('answers 404 when the caller owns no listing, reading no count', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });

        const res = await buildApp(protectedGetMyTabCountsRoute).request('/mine/tab-counts');

        expect(res.status).toBe(404);
        expect(mockListForProvider).not.toHaveBeenCalled();
        expect(mockListForOwner).not.toHaveBeenCalled();
    });

    it('a failed count is null and does not hide the other', async () => {
        mockListForOwner.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });

        const res = await buildApp(protectedGetMyTabCountsRoute).request('/mine/tab-counts');

        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ pendingUsages: 3, reviews: null });
    });

    it('is reached through the router, not swallowed by /{slug}', async () => {
        const res = await buildApp(protectedHostTradeRoutes as never).request('/mine/tab-counts');

        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ pendingUsages: 3, reviews: 7 });
    });
});

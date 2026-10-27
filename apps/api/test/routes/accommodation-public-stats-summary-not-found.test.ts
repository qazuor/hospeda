/**
 * Unit tests for the public accommodation `/stats` and `/summary` handlers.
 *
 * Both must answer NOT_FOUND (404 via the error pipeline) for an unknown or
 * hidden listing instead of `200 null` (HOS-1902). `createCRUDRoute` is mocked
 * to hand back its config so the handler can be invoked directly.
 *
 * @module test/routes/accommodation-public-stats-summary-not-found
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetById, mockGetStats } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockGetStats: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { getById: mockGetById, getStats: mockGetStats };
        })
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/route-factory.js', () => ({
    createCRUDRoute: (config: unknown) => config
}));

type RouteConfig = {
    readonly handler: (ctx: Context, params: Record<string, unknown>) => Promise<unknown>;
};

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ctx = {} as Context;

describe('public accommodation stats/summary: unknown or hidden listing', () => {
    let statsRoute: RouteConfig;
    let summaryRoute: RouteConfig;

    beforeEach(async () => {
        vi.clearAllMocks();
        statsRoute = (await import('../../src/routes/accommodation/public/getStats.js'))
            .getStatsRoute as unknown as RouteConfig;
        summaryRoute = (await import('../../src/routes/accommodation/public/getSummary.js'))
            .getSummaryRoute as unknown as RouteConfig;
    });

    it('stats: rejects with NOT_FOUND when getById reports NOT_FOUND', async () => {
        mockGetById.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'nope' }
        });

        await expect(statsRoute.handler(ctx, { id: ID })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
        expect(mockGetStats).not.toHaveBeenCalled();
    });

    it('stats: rejects with NOT_FOUND when getById returns no data and no error', async () => {
        mockGetById.mockResolvedValue({ data: null });

        await expect(statsRoute.handler(ctx, { id: ID })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('stats: returns the unwrapped stats for a visible listing', async () => {
        const stats = { total: 1, totalFeatured: 0, averageRating: 0, totalByType: { HOTEL: 1 } };
        mockGetById.mockResolvedValue({ data: { id: ID } });
        mockGetStats.mockResolvedValue({ data: { stats } });

        await expect(statsRoute.handler(ctx, { id: ID })).resolves.toEqual(stats);
    });

    it('summary: rejects with NOT_FOUND when getById reports NOT_FOUND', async () => {
        mockGetById.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'nope' }
        });

        await expect(summaryRoute.handler(ctx, { id: ID })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('summary: rejects with NOT_FOUND when getById returns no data and no error', async () => {
        mockGetById.mockResolvedValue({ data: null });

        await expect(summaryRoute.handler(ctx, { id: ID })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });
});

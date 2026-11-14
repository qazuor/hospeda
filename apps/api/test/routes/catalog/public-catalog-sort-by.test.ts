/**
 * HOS-2068: the public feature and amenity catalogs accept `sortBy` only from an
 * allow-list. A hidden column answers 400 instead of acting as an ordering oracle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const search = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/middlewares/authorization', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/authorization')>();
    return {
        ...actual,
        publicAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next()
    };
});
vi.mock('../../../src/utils/actor', () => ({ getActorFromContext: () => ({ id: 'guest' }) }));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class FakeService {
        search = search;
    }
    return { ...actual, FeatureService: FakeService, AmenityService: FakeService };
});

import { publicListAmenitiesRoute } from '../../../src/routes/amenity/public/list';
import { publicListFeaturesRoute } from '../../../src/routes/feature/public/list';

const cases = [
    ['features', publicListFeaturesRoute],
    ['amenities', publicListAmenitiesRoute]
] as const;

describe.each(cases)('public %s catalog sortBy', (_name, app) => {
    beforeEach(() => {
        search.mockReset();
        search.mockResolvedValue({ data: { items: [], total: 0 } });
    });

    it.each([
        'displayWeight',
        'slug'
    ])('accepts %s and forwards it to the service', async (sortBy) => {
        const res = await app.request(`/?sortBy=${sortBy}&sortOrder=desc`);

        expect(res.status).toBe(200);
        expect(search.mock.calls[0]?.[1]).toMatchObject({ sortBy, sortOrder: 'desc' });
    });

    it.each([
        'createdById',
        'adminInfo',
        'deletedAt'
    ])('rejects hidden column %s with 400', async (sortBy) => {
        const res = await app.request(`/?sortBy=${sortBy}`);

        expect(res.status).toBe(400);
        expect(search).not.toHaveBeenCalled();
    });
});

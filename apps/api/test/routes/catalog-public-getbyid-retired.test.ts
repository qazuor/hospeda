/**
 * Regression — the public catalog detail endpoints must answer 404 for a
 * retired (soft-deleted) amenity or feature.
 *
 * `BaseCrudService.getByField` applies no soft-delete filter, and neither
 * AmenityModel nor FeatureModel has a soft-delete default, so after data
 * migration 0147 retired 19 catalog rows `GET /public/amenities/:id` and
 * `GET /public/features/:id` still returned them with a 200. The filter lives
 * in the public routes, not in the service: the admin getById and restore
 * routes share the same service method and must keep reading retired rows.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAmenityGetById = vi.fn();
const mockFeatureGetById = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AmenityService: vi.fn().mockImplementation(function () {
            return { getById: mockAmenityGetById };
        }),
        FeatureService: vi.fn().mockImplementation(function () {
            return { getById: mockFeatureGetById };
        })
    };
});

vi.mock('../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'guest', roles: ['GUEST'], permissions: [] }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Hands the route options back, so the handler can be called directly.
vi.mock('../../src/utils/route-factory', () => ({
    createPublicRoute: (options: unknown) => options
}));

type Handler = (ctx: unknown, params: Record<string, unknown>) => Promise<unknown>;

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const loadHandlers = async (): Promise<{ amenity: Handler; feature: Handler }> => {
    const { publicGetAmenityByIdRoute } = await import(
        '../../src/routes/amenity/public/getById.js'
    );
    const { publicGetFeatureByIdRoute } = await import('../../src/routes/feature/public/show.js');
    return {
        amenity: (publicGetAmenityByIdRoute as unknown as { handler: Handler }).handler,
        feature: (publicGetFeatureByIdRoute as unknown as { handler: Handler }).handler
    };
};

describe('public catalog getById — retired rows', () => {
    beforeEach(() => {
        mockAmenityGetById.mockReset();
        mockFeatureGetById.mockReset();
    });

    it('answers NOT_FOUND for a retired amenity', async () => {
        // Arrange
        mockAmenityGetById.mockResolvedValue({
            data: { id: ID, slug: 'retired', deletedAt: new Date('2026-11-01') }
        });
        const { amenity } = await loadHandlers();

        // Act + Assert
        await expect(amenity({}, { id: ID })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('answers NOT_FOUND for a retired feature', async () => {
        // Arrange
        mockFeatureGetById.mockResolvedValue({
            data: { id: ID, slug: 'retired', deletedAt: new Date('2026-11-01') }
        });
        const { feature } = await loadHandlers();

        // Act + Assert
        await expect(feature({}, { id: ID })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('returns a live amenity unchanged', async () => {
        // Arrange
        const live = { id: ID, slug: 'wifi', deletedAt: null };
        mockAmenityGetById.mockResolvedValue({ data: live });
        const { amenity } = await loadHandlers();

        // Act
        const result = await amenity({}, { id: ID });

        // Assert
        expect(result).toEqual(live);
    });

    it('returns a live feature unchanged', async () => {
        // Arrange
        const live = { id: ID, slug: 'river_view', deletedAt: null };
        mockFeatureGetById.mockResolvedValue({ data: live });
        const { feature } = await loadHandlers();

        // Act
        const result = await feature({}, { id: ID });

        // Assert
        expect(result).toEqual(live);
    });
});

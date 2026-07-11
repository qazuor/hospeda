/**
 * @fileoverview
 * Tests for AccommodationService's "near POI" proximity search wiring
 * (HOS-113 T-033/T-034).
 *
 * T-033 (NG-2 compliance): a `poiId`/`poiSlug` search resolves to the SAME
 * `latitude`/`longitude`/`radius` params the existing geo-search path
 * already consumes, and defaults to ranking by distance ascending.
 *
 * T-034 (precedence): a resolved POI wins over an explicit
 * `latitude`/`longitude` in the same request; supplying BOTH `poiId` AND
 * `poiSlug` is a 400 `VALIDATION_ERROR`.
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

const createSearchActor = () =>
    createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });

const paginated = (items: unknown[] = []) => ({ items, total: items.length });

/** Builds a minimal PointOfInterestService test double with mocked getById/getBySlug. */
function createPoiServiceMock(overrides: {
    getById?: ReturnType<typeof vi.fn>;
    getBySlug?: ReturnType<typeof vi.fn>;
}): PointOfInterestService {
    return {
        getById: overrides.getById ?? vi.fn(),
        getBySlug: overrides.getBySlug ?? vi.fn()
    } as unknown as PointOfInterestService;
}

describe('AccommodationService — "near POI" proximity search (HOS-113 T-033/T-034)', () => {
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createSearchActor>;

    beforeEach(() => {
        model = createModelMock();
        model.searchWithRelations = vi.fn().mockResolvedValue(paginated());
        actor = createSearchActor();
    });

    function buildService(poiService: PointOfInterestService): AccommodationService {
        return new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any,
            poiService
        );
    }

    it('T-033: resolves poiSlug into latitude/longitude/radius, defaulting sort to distance asc', async () => {
        const poi = PointOfInterestFactoryBuilder.create({
            slug: 'autodromo-cdu',
            lat: -32.4825,
            long: -58.2372
        });
        const getBySlug = vi.fn().mockResolvedValue({ data: poi });
        const service = buildService(createPoiServiceMock({ getBySlug }));

        const result = await service.search(actor, {
            poiSlug: 'autodromo-cdu',
            page: 1,
            pageSize: 10
        });

        expect(result.error).toBeUndefined();
        expect(getBySlug).toHaveBeenCalledWith(actor, 'autodromo-cdu', expect.anything());
        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({
                latitude: -32.4825,
                longitude: -58.2372,
                radius: 5,
                sorts: [{ field: 'distance', order: 'asc' }]
            })
        );
    });

    it('T-033 (NG-2): a poiId search produces the SAME latitude/longitude/radius params as an equivalent explicit search', async () => {
        const poi = PointOfInterestFactoryBuilder.create({
            lat: -32.5,
            long: -58.25
        });
        const getById = vi.fn().mockResolvedValue({ data: poi });

        const poiService = buildService(createPoiServiceMock({ getById }));
        await poiService.search(actor, { poiId: poi.id, page: 1, pageSize: 10 });
        const poiCallParams = asMock(model.searchWithRelations).mock.calls[0]?.[0];

        asMock(model.searchWithRelations).mockClear();

        const explicitService = buildService(createPoiServiceMock({}));
        await explicitService.search(actor, {
            latitude: -32.5,
            longitude: -58.25,
            radius: 5,
            sorts: [{ field: 'distance', order: 'asc' }],
            page: 1,
            pageSize: 10
        });
        const explicitCallParams = asMock(model.searchWithRelations).mock.calls[0]?.[0];

        expect(poiCallParams).toMatchObject({
            latitude: explicitCallParams.latitude,
            longitude: explicitCallParams.longitude,
            radius: explicitCallParams.radius,
            sorts: explicitCallParams.sorts
        });
    });

    it('T-033: an explicit radius is honored instead of the OQ-5 default', async () => {
        const poi = PointOfInterestFactoryBuilder.create();
        const getById = vi.fn().mockResolvedValue({ data: poi });
        const service = buildService(createPoiServiceMock({ getById }));

        await service.search(actor, { poiId: poi.id, radius: 20, page: 1, pageSize: 10 });

        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ radius: 20 })
        );
    });

    it('T-033: an explicit sorts array is respected instead of the default distance sort', async () => {
        const poi = PointOfInterestFactoryBuilder.create();
        const getById = vi.fn().mockResolvedValue({ data: poi });
        const service = buildService(createPoiServiceMock({ getById }));

        await service.search(actor, {
            poiId: poi.id,
            sorts: [{ field: 'price', order: 'desc' }],
            page: 1,
            pageSize: 10
        });

        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ sorts: [{ field: 'price', order: 'desc' }] })
        );
    });

    it('T-034: a resolved POI wins over an explicit latitude/longitude in the same request', async () => {
        const poi = PointOfInterestFactoryBuilder.create({ lat: -10, long: -50 });
        const getById = vi.fn().mockResolvedValue({ data: poi });
        const service = buildService(createPoiServiceMock({ getById }));

        await service.search(actor, {
            poiId: poi.id,
            // Conflicting explicit coordinates — must be overridden by the POI's.
            latitude: 1,
            longitude: 2,
            page: 1,
            pageSize: 10
        });

        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ latitude: -10, longitude: -50 })
        );
    });

    it('T-034: rejects poiId and poiSlug supplied together with a 400 VALIDATION_ERROR', async () => {
        const service = buildService(createPoiServiceMock({}));

        const result = await service.search(actor, {
            poiId: '12345678-1234-4234-8234-123456789012',
            poiSlug: 'some-slug',
            page: 1,
            pageSize: 10
        });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.searchWithRelations).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when the poiSlug does not resolve to any point of interest', async () => {
        const getBySlug = vi.fn().mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'pointOfInterest not found' }
        });
        const service = buildService(createPoiServiceMock({ getBySlug }));

        const result = await service.search(actor, {
            poiSlug: 'does-not-exist',
            page: 1,
            pageSize: 10
        });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.searchWithRelations).not.toHaveBeenCalled();
    });

    it('a search without poiId/poiSlug is unaffected (no POI lookup, no forced sort)', async () => {
        const getById = vi.fn();
        const getBySlug = vi.fn();
        const service = buildService(createPoiServiceMock({ getById, getBySlug }));

        await service.search(actor, { page: 1, pageSize: 10 });

        expect(getById).not.toHaveBeenCalled();
        expect(getBySlug).not.toHaveBeenCalled();
        expect(model.searchWithRelations).toHaveBeenCalledWith(
            expect.not.objectContaining({ sorts: expect.anything() })
        );
    });
});

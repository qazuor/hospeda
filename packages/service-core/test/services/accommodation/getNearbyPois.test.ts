/**
 * @fileoverview
 * Test suite for `AccommodationService.getNearbyPois` (HOS-145 T-004).
 *
 * This is the privacy-preserving core of the "near POI" accommodation
 * feature: the accommodation's EXACT coordinates (read via a raw,
 * unprojected `model.findOne`) are used only to center a
 * `PointOfInterestService.getNearby` proximity search — they must never be
 * part of the returned value.
 */
import type { AccommodationMediaModel, AccommodationModel } from '@repo/db';
import type { NearbyPoi } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

/** Builds a minimal PointOfInterestService test double with a mocked getNearby. */
function createPoiServiceMock(getNearby: ReturnType<typeof vi.fn>): PointOfInterestService {
    return { getNearby } as unknown as PointOfInterestService;
}

/** A sample NearbyPoi row, as returned by `PointOfInterestService.getNearby`. */
const buildNearbyPoi = (overrides: Partial<NearbyPoi> = {}): NearbyPoi =>
    ({
        id: getMockId('pointOfInterest', 'poi-1'),
        slug: 'test-poi-1',
        lat: -32.4825,
        long: -58.2372,
        type: 'PARK',
        description: 'A lovely park',
        nameI18n: { es: 'Un parque lindo' },
        icon: 'park-icon',
        isFeatured: false,
        isBuiltin: false,
        displayWeight: 50,
        distanceKm: 1.23,
        ...overrides
    }) as NearbyPoi;

describe('AccommodationService.getNearbyPois', () => {
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        model = createModelMock();
        actor = createActor({ permissions: [] });
    });

    function buildService(getNearby: ReturnType<typeof vi.fn>): AccommodationService {
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
            makeMediaModelStub() as unknown as AccommodationMediaModel,
            createPoiServiceMock(getNearby)
        );
    }

    it('delegates to getNearby with parsed numeric lat/long and default radius/limit', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({
                slug: 'hotel-with-coords',
                location: { coordinates: { lat: '-32.48', long: '-58.23' } }
            })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const pois = [buildNearbyPoi()];
        const getNearby = vi.fn().mockResolvedValue({ data: pois });
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.error).toBeUndefined();
        expect(model.findOne).toHaveBeenCalledWith({ slug: 'hotel-with-coords' }, undefined);
        expect(getNearby).toHaveBeenCalledWith(
            { lat: -32.48, long: -58.23, radiusKm: 5, limit: 12 },
            actor,
            expect.anything()
        );
        expect(result.data).toEqual(pois);
    });

    it('returns an empty array (and never calls getNearby) when the accommodation has no location', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({ slug: 'hotel-no-location', location: undefined })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-no-location' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array (and never calls getNearby) when the accommodation has no coordinates', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({ slug: 'hotel-no-coords', location: { street: 'Test St' } })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-no-coords' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array (and never calls getNearby) for unparseable coordinates', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({
                slug: 'hotel-bad-coords',
                location: { coordinates: { lat: 'abc', long: '-58.23' } }
            })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-bad-coords' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array when the slug does not resolve to any accommodation', async () => {
        model.findOne = vi.fn().mockResolvedValue(null);
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'does-not-exist' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('honors explicit radiusKm/limit overrides instead of the defaults', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({
                slug: 'hotel-with-coords',
                location: { coordinates: { lat: '-32.48', long: '-58.23' } }
            })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const getNearby = vi.fn().mockResolvedValue({ data: [] });
        const service = buildService(getNearby);

        await service.getNearbyPois({ slug: 'hotel-with-coords', radiusKm: 15, limit: 5 }, actor);

        expect(getNearby).toHaveBeenCalledWith(
            { lat: -32.48, long: -58.23, radiusKm: 15, limit: 5 },
            actor,
            expect.anything()
        );
    });

    it('AC-4: the returned value is exactly the POI array and never carries accommodation coordinates', async () => {
        // Deliberately distinct from the POIs' own lat/long below, so a
        // substring match against the serialized output unambiguously
        // proves the ACCOMMODATION's coordinates never leaked through.
        const accommodationLat = '-33.9999';
        const accommodationLong = '-59.8888';
        const accommodation = new AccommodationFactoryBuilder()
            .with({
                slug: 'hotel-with-coords',
                location: { coordinates: { lat: accommodationLat, long: accommodationLong } }
            })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const pois = [
            buildNearbyPoi(),
            buildNearbyPoi({ id: getMockId('pointOfInterest', 'poi-2') })
        ];
        const getNearby = vi.fn().mockResolvedValue({ data: pois });
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.data).toBe(pois);
        const serialized = JSON.stringify(result.data);
        expect(serialized).not.toContain(accommodationLat);
        expect(serialized).not.toContain(accommodationLong);
        expect(serialized).not.toContain('location');
        expect(serialized).not.toContain('ownerId');
    });

    it('propagates an error returned by PointOfInterestService.getNearby', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({
                slug: 'hotel-with-coords',
                location: { coordinates: { lat: '-32.48', long: '-58.23' } }
            })
            .build();
        model.findOne = vi.fn().mockResolvedValue(accommodation);
        const getNearby = vi.fn().mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
        });
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('returns VALIDATION_ERROR for an empty slug', async () => {
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: '' }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(asMock(model.findOne)).not.toHaveBeenCalled();
    });
});

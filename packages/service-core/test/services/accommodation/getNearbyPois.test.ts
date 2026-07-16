/**
 * @fileoverview
 * Test suite for `AccommodationService.getNearbyPois` (HOS-145 T-004,
 * revised 2026-07-14 judgment-day round 2, #4/#5).
 *
 * This is the privacy-preserving core of the "near POI" accommodation
 * feature: the proximity search is centered on the accommodation's
 * OBFUSCATED `approximateLocation`. The real coordinates are never read by
 * this method and the search center itself must never be part of the
 * returned value.
 *
 * Mocking strategy: `model.findOne` is mocked directly (a bare, relation-free
 * read — the lightweight replacement for the old `getBySlug` gated read,
 * #5), and the real `checkCanView` gate runs against the entity's actual
 * `visibility`/`lifecycleState`/`deletedAt`/`ownerSuspended`/`planRestricted`
 * fields (same pattern as `getStats.test.ts`), except where a test needs to
 * force a specific error code (e.g. a genuine backend failure), which spies
 * on `permissionHelpers.checkCanView` instead.
 */
import type { AccommodationMediaModel, AccommodationModel } from '@repo/db';
import type { NearbyPoi } from '@repo/schemas';
import { LifecycleStatusEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { projectAccommodationApproximateLocation } from '../../../src/services/accommodation/accommodation.projections';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { ServiceError } from '../../../src/types';
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
const TEST_SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';

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
        // HOS-182: always present on a real NearbyPoi (object or null).
        primaryCategory: null,
        ...overrides
    }) as NearbyPoi;

/** Builds an accommodation with real coordinates so `projectAccommodationApproximateLocation`
 * computes a real (deterministic, salt-derived) `approximateLocation`. `ownerId` is
 * pinned to a distinct mock id from the default test actor's id — both are
 * otherwise the SAME deterministic `getMockId('user')` value, which would
 * silently make the default actor look like the owner and bypass the
 * visibility gate entirely. */
const buildAccommodationWithCoords = (
    slug: string,
    coords: { lat: string; long: string } = { lat: '-32.4825', long: '-58.2372' }
) =>
    new AccommodationFactoryBuilder()
        .with({
            slug,
            ownerId: getMockId('user', 'some-other-owner'),
            location: {
                street: 'Av. Belgrano',
                number: '123',
                coordinates: coords
            }
        })
        .build();

describe('AccommodationService.getNearbyPois', () => {
    let model: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof createActor>;
    let originalSalt: string | undefined;

    beforeEach(() => {
        originalSalt = process.env.HOSPEDA_LOCATION_SALT;
        process.env.HOSPEDA_LOCATION_SALT = TEST_SALT;
        model = createModelMock();
        actor = createActor({ permissions: [] });
    });

    afterEach(() => {
        if (originalSalt === undefined) {
            delete process.env.HOSPEDA_LOCATION_SALT;
        } else {
            process.env.HOSPEDA_LOCATION_SALT = originalSalt;
        }
        vi.restoreAllMocks();
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

    it('delegates to getNearby centered on the OBFUSCATED approximateLocation (lng -> long remap), with default radius/limit', async () => {
        const accommodation = buildAccommodationWithCoords('hotel-with-coords');
        const expectedApprox = projectAccommodationApproximateLocation(accommodation, {
            salt: TEST_SALT
        }).approximateLocation;
        expect(expectedApprox).toBeDefined();

        const pois = [buildNearbyPoi()];
        const getNearby = vi.fn().mockResolvedValue({ data: pois });
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.error).toBeUndefined();
        expect(asMock(model.findOne)).toHaveBeenCalledWith(
            { slug: 'hotel-with-coords' },
            undefined
        );
        expect(getNearby).toHaveBeenCalledWith(
            {
                lat: expectedApprox?.lat,
                long: expectedApprox?.lng,
                radiusKm: 5,
                limit: 12
            },
            actor,
            expect.anything()
        );
        expect(result.data).toEqual(pois);
    });

    it('returns an empty array (AC-1/#1) and never calls getNearby when the accommodation is PRIVATE and the actor has no view-private permission', async () => {
        const accommodation = buildAccommodationWithCoords('draft-hotel');
        accommodation.visibility = VisibilityEnum.PRIVATE;
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'draft-hotel' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array (AC-8) and never calls getNearby when the accommodation is DRAFT (non-ACTIVE lifecycleState)', async () => {
        const accommodation = buildAccommodationWithCoords('draft-lifecycle-hotel');
        accommodation.lifecycleState = LifecycleStatusEnum.DRAFT;
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'draft-lifecycle-hotel' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array and never calls getNearby when the accommodation is soft-deleted (GONE)', async () => {
        const accommodation = buildAccommodationWithCoords('gone-hotel');
        accommodation.visibility = VisibilityEnum.PUBLIC;
        accommodation.deletedAt = new Date();
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'gone-hotel' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array and never calls getNearby when the accommodation does not exist (NOT_FOUND)', async () => {
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(null);

        const result = await service.getNearbyPois({ slug: 'does-not-exist' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns an empty array (and never calls getNearby) when the visible accommodation has no coordinates yet', async () => {
        const accommodation = new AccommodationFactoryBuilder()
            .with({ slug: 'hotel-no-coords' })
            .build();
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'hotel-no-coords' }, actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('honors explicit radiusKm/limit overrides instead of the defaults', async () => {
        const accommodation = buildAccommodationWithCoords('hotel-with-coords');
        const expectedApprox = projectAccommodationApproximateLocation(accommodation, {
            salt: TEST_SALT
        }).approximateLocation;
        const getNearby = vi.fn().mockResolvedValue({ data: [] });
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        await service.getNearbyPois({ slug: 'hotel-with-coords', radiusKm: 15, limit: 5 }, actor);

        expect(getNearby).toHaveBeenCalledWith(
            {
                lat: expectedApprox?.lat,
                long: expectedApprox?.lng,
                radiusKm: 15,
                limit: 5
            },
            actor,
            expect.anything()
        );
    });

    it('AC-4: the returned value is exactly the POI array and never carries any accommodation coordinate (real or approximate)', async () => {
        // Deliberately distinct from the POIs' own lat/long below, so a
        // substring match against the serialized output unambiguously
        // proves neither the real NOR the approximate coordinate leaked
        // through.
        const realCoords = { lat: '-33.9999', long: '-59.8888' };
        const accommodation = buildAccommodationWithCoords('hotel-with-coords', realCoords);
        const expectedApprox = projectAccommodationApproximateLocation(accommodation, {
            salt: TEST_SALT
        }).approximateLocation;
        const pois = [
            buildNearbyPoi(),
            buildNearbyPoi({ id: getMockId('pointOfInterest', 'poi-2') })
        ];
        const getNearby = vi.fn().mockResolvedValue({ data: pois });
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.data).toBe(pois);
        const serialized = JSON.stringify(result.data);
        expect(serialized).not.toContain(String(expectedApprox?.lat));
        expect(serialized).not.toContain(String(expectedApprox?.lng));
        expect(serialized).not.toContain(realCoords.lat);
        expect(serialized).not.toContain(realCoords.long);
        expect(serialized).not.toContain('location');
        expect(serialized).not.toContain('ownerId');
    });

    it('propagates an error returned by PointOfInterestService.getNearby', async () => {
        const accommodation = buildAccommodationWithCoords('hotel-with-coords');
        const getNearby = vi.fn().mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
        });
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('propagates a genuine backend failure from the model read as an error result, NOT swallowed to []', async () => {
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockRejectedValue(new Error('connection to database lost'));

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('propagates a non-visibility ServiceError from the gate as an error result, NOT swallowed to []', async () => {
        const accommodation = buildAccommodationWithCoords('hotel-with-coords');
        const getNearby = vi.fn();
        const service = buildService(getNearby);
        asMock(model.findOne).mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.SERVICE_UNAVAILABLE, 'relation lookup failed');
        });

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords' }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        expect(getNearby).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR for an empty slug', async () => {
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: '' }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(asMock(model.findOne)).not.toHaveBeenCalled();
    });

    it('rejects a radiusKm above the 20km upper bound (defense-in-depth, HOS-145 judgment-day)', async () => {
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois(
            { slug: 'hotel-with-coords', radiusKm: 21 },
            actor
        );

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(asMock(model.findOne)).not.toHaveBeenCalled();
    });

    it('rejects a limit above the 50 upper bound (defense-in-depth, HOS-145 judgment-day)', async () => {
        const getNearby = vi.fn();
        const service = buildService(getNearby);

        const result = await service.getNearbyPois({ slug: 'hotel-with-coords', limit: 51 }, actor);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(asMock(model.findOne)).not.toHaveBeenCalled();
    });
});

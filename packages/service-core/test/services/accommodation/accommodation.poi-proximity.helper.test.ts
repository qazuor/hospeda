/**
 * @fileoverview
 * Unit tests for `resolvePoiToCoordinates` (HOS-113 T-032).
 *
 * Covers: found-by-id, found-by-slug, not-found (both the "no id supplied"
 * and the "lookup returned nothing" cases), explicit-radius, and
 * default-radius (OQ-5, 5km) resolution.
 */
import type { PointOfInterest } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_POI_PROXIMITY_RADIUS_KM,
    resolvePoiToCoordinates
} from '../../../src/services/accommodation/accommodation.poi-proximity.helper';
import type { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';

const actor = createActor();

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

describe('resolvePoiToCoordinates (HOS-113 T-032)', () => {
    it('resolves a POI by poiId, applying the default radius (5km, OQ-5)', async () => {
        const poi: PointOfInterest = PointOfInterestFactoryBuilder.create({
            lat: -32.4825,
            long: -58.2372
        });
        const getById = vi.fn().mockResolvedValue({ data: poi });
        const service = createPoiServiceMock({ getById });

        const result = await resolvePoiToCoordinates({ poiId: poi.id }, actor, service);

        expect(getById).toHaveBeenCalledWith(actor, poi.id, undefined);
        expect(result).toEqual({
            found: true,
            lat: -32.4825,
            long: -58.2372,
            radiusKm: DEFAULT_POI_PROXIMITY_RADIUS_KM
        });
    });

    it('resolves a POI by poiSlug', async () => {
        const poi: PointOfInterest = PointOfInterestFactoryBuilder.create({
            slug: 'autodromo-cdu',
            lat: -32.5,
            long: -58.25
        });
        const getBySlug = vi.fn().mockResolvedValue({ data: poi });
        const service = createPoiServiceMock({ getBySlug });

        const result = await resolvePoiToCoordinates({ poiSlug: 'autodromo-cdu' }, actor, service);

        expect(getBySlug).toHaveBeenCalledWith(actor, 'autodromo-cdu', undefined);
        expect(result).toEqual({
            found: true,
            lat: -32.5,
            long: -58.25,
            radiusKm: DEFAULT_POI_PROXIMITY_RADIUS_KM
        });
    });

    it('applies an explicit radius override instead of the default', async () => {
        const poi: PointOfInterest = PointOfInterestFactoryBuilder.create();
        const getById = vi.fn().mockResolvedValue({ data: poi });
        const service = createPoiServiceMock({ getById });

        const result = await resolvePoiToCoordinates(
            { poiId: poi.id, radius: 12.5 },
            actor,
            service
        );

        expect(result).toEqual({
            found: true,
            lat: poi.lat,
            long: poi.long,
            radiusKm: 12.5
        });
    });

    it('returns { found: false } when neither poiId nor poiSlug is provided', async () => {
        const getById = vi.fn();
        const getBySlug = vi.fn();
        const service = createPoiServiceMock({ getById, getBySlug });

        const result = await resolvePoiToCoordinates({}, actor, service);

        expect(result).toEqual({ found: false });
        expect(getById).not.toHaveBeenCalled();
        expect(getBySlug).not.toHaveBeenCalled();
    });

    it('returns { found: false } when getById reports NOT_FOUND (never throws)', async () => {
        const getById = vi.fn().mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'pointOfInterest not found' }
        });
        const service = createPoiServiceMock({ getById });

        const result = await resolvePoiToCoordinates(
            { poiId: '12345678-1234-4234-8234-123456789099' },
            actor,
            service
        );

        expect(result).toEqual({ found: false });
    });

    it('returns { found: false } when getBySlug reports NOT_FOUND (never throws)', async () => {
        const getBySlug = vi.fn().mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'pointOfInterest not found' }
        });
        const service = createPoiServiceMock({ getBySlug });

        const result = await resolvePoiToCoordinates({ poiSlug: 'unknown-slug' }, actor, service);

        expect(result).toEqual({ found: false });
    });

    it('prefers poiId over poiSlug when both are somehow present', async () => {
        const poi: PointOfInterest = PointOfInterestFactoryBuilder.create();
        const getById = vi.fn().mockResolvedValue({ data: poi });
        const getBySlug = vi.fn();
        const service = createPoiServiceMock({ getById, getBySlug });

        const result = await resolvePoiToCoordinates(
            { poiId: poi.id, poiSlug: 'some-other-slug' },
            actor,
            service
        );

        expect(getById).toHaveBeenCalledTimes(1);
        expect(getBySlug).not.toHaveBeenCalled();
        expect(result.found).toBe(true);
    });
});

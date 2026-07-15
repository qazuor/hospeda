import { PointOfInterestModel } from '@repo/db';
import type { PointOfInterestIdType } from '@repo/schemas';
import { PointOfInterestTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const actorWithPerms = createActor({ permissions: [] });

/**
 * Builds a full `PointOfInterest & { distanceKm }` row as returned by
 * `PointOfInterestModel.findWithinRadius`, so that projecting it through
 * `NearbyPoiSchema` (the public shape + `distanceKm`) succeeds.
 */
const buildPoiRow = (overrides: Record<string, unknown> = {}) => ({
    id: getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType,
    slug: 'test-poi-1',
    lat: -32.4825,
    long: -58.2372,
    type: PointOfInterestTypeEnum.PARK,
    description: 'A lovely park near the accommodation',
    nameI18n: { es: 'Un parque lindo' },
    icon: 'park-icon',
    isFeatured: false,
    isBuiltin: false,
    displayWeight: 50,
    // Admin/internal-only fields still present on the raw model row — must
    // be stripped by NearbyPoiSchema's `.pick()`-derived shape.
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    adminNotes: null,
    distanceKm: 1.23,
    // HOS-182: always present on a real model row (object or null) — see
    // `PointOfInterestModel.findWithinRadius`.
    primaryCategory: null,
    ...overrides
});

describe('PointOfInterestService.getNearby', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findWithinRadius']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model);
    });

    it('forwards { lat, long, radiusKm, limit } to model.findWithinRadius', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([]);

        await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 12 },
            actorWithPerms
        );

        expect(model.findWithinRadius).toHaveBeenCalledWith(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 12 },
            undefined
        );
    });

    it('projects model rows to the public NearbyPoi shape with distanceKm', async () => {
        const row = buildPoiRow({ distanceKm: 2.5 });
        asMock(model.findWithinRadius).mockResolvedValue([row]);

        const result = await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 12 },
            actorWithPerms
        );

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([
            {
                id: row.id,
                slug: row.slug,
                lat: row.lat,
                long: row.long,
                type: row.type,
                nameI18n: row.nameI18n,
                description: row.description,
                icon: row.icon,
                isFeatured: row.isFeatured,
                isBuiltin: row.isBuiltin,
                displayWeight: row.displayWeight,
                distanceKm: 2.5,
                primaryCategory: null
            }
        ]);
        // Admin/internal-only fields must NOT leak into the projected shape.
        expect(result.data?.[0]).not.toHaveProperty('lifecycleState');
        expect(result.data?.[0]).not.toHaveProperty('createdAt');
        expect(result.data?.[0]).not.toHaveProperty('adminNotes');
    });

    // ========================================================================
    // HOS-182: primaryCategory pass-through
    // ========================================================================
    it('passes a non-null primaryCategory straight through NearbyPoiSchema', async () => {
        const nameI18n = { es: 'Recinto deportivo', en: 'Sports venue', pt: 'Recinto esportivo' };
        const row = buildPoiRow({
            primaryCategory: { slug: 'sports_venue', nameI18n }
        });
        asMock(model.findWithinRadius).mockResolvedValue([row]);

        const result = await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 12 },
            actorWithPerms
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.[0]?.primaryCategory).toEqual({
            slug: 'sports_venue',
            nameI18n
        });
    });

    it('passes a null primaryCategory straight through NearbyPoiSchema (no primary category row)', async () => {
        const row = buildPoiRow({ primaryCategory: null });
        asMock(model.findWithinRadius).mockResolvedValue([row]);

        const result = await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 12 },
            actorWithPerms
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.[0]?.primaryCategory).toBeNull();
    });

    it('returns an empty array when the model finds no points of interest', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([]);

        const result = await service.getNearby(
            { lat: 0, long: 0, radiusKm: 5, limit: 12 },
            actorWithPerms
        );

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual([]);
    });

    it('rejects a radiusKm above the 20km upper bound (defense-in-depth, HOS-145 judgment-day)', async () => {
        const result = await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 21, limit: 12 },
            actorWithPerms
        );

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(model.findWithinRadius).not.toHaveBeenCalled();
    });

    it('rejects a limit above the 50 upper bound (defense-in-depth, HOS-145 judgment-day)', async () => {
        const result = await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 51 },
            actorWithPerms
        );

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(model.findWithinRadius).not.toHaveBeenCalled();
    });

    it('preserves distanceKm as a number for multiple rows, sorted as returned by the model', async () => {
        const near = buildPoiRow({
            id: getMockId('pointOfInterest', 'poi-near') as PointOfInterestIdType,
            slug: 'poi-near',
            distanceKm: 0.5
        });
        const far = buildPoiRow({
            id: getMockId('pointOfInterest', 'poi-far') as PointOfInterestIdType,
            slug: 'poi-far',
            distanceKm: 4.9
        });
        asMock(model.findWithinRadius).mockResolvedValue([near, far]);

        const result = await service.getNearby(
            { lat: -32.4825, long: -58.2372, radiusKm: 5, limit: 12 },
            actorWithPerms
        );

        expect(result.data?.map((poi) => poi.distanceKm)).toEqual([0.5, 4.9]);
        for (const poi of result.data ?? []) {
            expect(typeof poi.distanceKm).toBe('number');
        }
    });
});

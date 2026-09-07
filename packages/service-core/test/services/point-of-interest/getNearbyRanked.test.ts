/**
 * @file getNearbyRanked.test.ts
 * @description Tests for `PointOfInterestService.getNearbyRanked` (HOS-327) —
 * the relevance-ranked sibling of `getNearby`.
 *
 * Covers the two things the service adds on top of the pure policy (which is
 * tested exhaustively in `nearby-relevance.test.ts`): the candidate query it
 * asks the model for, and the fact that the ranking really is applied to the
 * rows that come back, in the right order, before they are projected to the
 * public shape.
 */

import { PointOfInterestModel } from '@repo/db';
import type { PointOfInterestIdType } from '@repo/schemas';
import { PointOfInterestTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServiceConfig } from '../../../src';
import {
    NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM,
    NEARBY_POI_CANDIDATE_LIMIT
} from '../../../src/services/point-of-interest/point-of-interest.nearby-relevance';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const actor = createActor({ permissions: [] });

const CENTER = { lat: -32.4825, long: -58.2372 } as const;

/**
 * Builds a full `PointOfInterest & { distanceKm }` row as returned by
 * `PointOfInterestModel.findWithinRadius`, so projecting it through
 * `NearbyPoiSchema` succeeds.
 */
const buildPoiRow = (overrides: Record<string, unknown> = {}) => ({
    id: getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType,
    slug: 'test-poi',
    lat: -32.4825,
    long: -58.2372,
    type: PointOfInterestTypeEnum.PARK,
    description: 'A lovely point of interest near the accommodation',
    nameI18n: { es: 'Un POI' },
    descriptionI18n: null,
    address: null,
    hasOwnPage: false,
    icon: 'park-icon',
    isFeatured: false,
    isBuiltin: false,
    displayWeight: 50,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    adminNotes: null,
    distanceKm: 1,
    primaryCategory: null,
    ...overrides
});

describe('PointOfInterestService.getNearbyRanked', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findWithinRadius']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model);
    });

    it('asks the model for the widest radius any POI could earn, not the caller limit', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([]);

        await service.getNearbyRanked({ ...CENTER, limit: 8 }, actor);

        // The candidate set must be a strict SUPERSET of the eligible set, so
        // no POI can be discarded by the geo query before the ranking runs.
        expect(model.findWithinRadius).toHaveBeenCalledWith(
            {
                ...CENTER,
                radiusKm: NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM,
                limit: NEARBY_POI_CANDIDATE_LIMIT
            },
            undefined
        );
    });

    it('narrows the candidate radius when the caller supplies a smaller ceiling', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([]);

        await service.getNearbyRanked({ ...CENTER, limit: 8, radiusCapKm: 3 }, actor);

        expect(model.findWithinRadius).toHaveBeenCalledWith(
            { ...CENTER, radiusKm: 3, limit: NEARBY_POI_CANDIDATE_LIMIT },
            undefined
        );
    });

    it('never lets a caller ceiling widen the candidate radius past the absolute maximum', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([]);

        await service.getNearbyRanked({ ...CENTER, limit: 8, radiusCapKm: 20 }, actor);

        expect(model.findWithinRadius).toHaveBeenCalledWith(
            {
                ...CENTER,
                radiusKm: NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM,
                limit: NEARBY_POI_CANDIDATE_LIMIT
            },
            undefined
        );
    });

    it('drops a candidate that falls outside its own elastic radius', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([
            buildPoiRow({ slug: 'weak-far', displayWeight: 25, distanceKm: 3 }),
            buildPoiRow({ slug: 'landmark-far', displayWeight: 100, distanceKm: 9 })
        ]);

        const result = await service.getNearbyRanked({ ...CENTER, limit: 8 }, actor);

        expect(result.error).toBeUndefined();
        // weight 25 earns 2.5km and sits at 3km; weight 100 earns 10km at 9km.
        expect(result.data?.map((p) => p.slug)).toEqual(['landmark-far']);
    });

    it('returns candidates ordered by relevance, not by distance', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([
            buildPoiRow({ slug: 'pharmacy', displayWeight: 25, distanceKm: 0.3 }),
            buildPoiRow({ slug: 'palace', displayWeight: 100, distanceKm: 1 })
        ]);

        const result = await service.getNearbyRanked({ ...CENTER, limit: 8 }, actor);

        // The model hands them over nearest-first; the service must reorder.
        expect(result.data?.map((p) => p.slug)).toEqual(['palace', 'pharmacy']);
    });

    it('slices to the caller limit after ranking', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([
            buildPoiRow({ slug: 'poi-a', displayWeight: 100, distanceKm: 0.1 }),
            buildPoiRow({ slug: 'poi-b', displayWeight: 100, distanceKm: 0.2 }),
            buildPoiRow({ slug: 'poi-c', displayWeight: 100, distanceKm: 0.3 })
        ]);

        const result = await service.getNearbyRanked({ ...CENTER, limit: 2 }, actor);

        expect(result.data?.map((p) => p.slug)).toEqual(['poi-a', 'poi-b']);
    });

    it('projects survivors to the public NearbyPoi shape, stripping internal fields', async () => {
        asMock(model.findWithinRadius).mockResolvedValue([
            buildPoiRow({ slug: 'kept', displayWeight: 100, distanceKm: 1 })
        ]);

        const result = await service.getNearbyRanked({ ...CENTER, limit: 8 }, actor);

        const poi = result.data?.[0];
        expect(poi).toBeDefined();
        expect(poi?.distanceKm).toBe(1);
        // Fields the public tier must carry (HOS-327 uses all four).
        expect(poi?.displayWeight).toBe(100);
        expect(poi?.isFeatured).toBe(false);
        expect(poi).toHaveProperty('hasOwnPage');
        expect(poi).toHaveProperty('descriptionI18n');
        // Internal fields must not leak.
        expect(poi).not.toHaveProperty('lifecycleState');
        expect(poi).not.toHaveProperty('adminNotes');
        expect(poi).not.toHaveProperty('deletedAt');
    });

    it('rejects a radiusCapKm above the 20km public bound (defense in depth)', async () => {
        const result = await service.getNearbyRanked(
            { ...CENTER, limit: 8, radiusCapKm: 21 },
            actor
        );

        expect(result.error).toBeDefined();
        expect(model.findWithinRadius).not.toHaveBeenCalled();
    });

    it('rejects a limit above the 50 upper bound (defense in depth)', async () => {
        const result = await service.getNearbyRanked({ ...CENTER, limit: 51 }, actor);

        expect(result.error).toBeDefined();
        expect(model.findWithinRadius).not.toHaveBeenCalled();
    });
});

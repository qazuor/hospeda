/**
 * @fileoverview HOS-369 W2-4 regression: editing a POI ↔ destination LINK must
 * purge the edge cache, exactly like editing the POI row itself does.
 *
 * The purge chain shipped wired to `_afterCreate` / `_afterUpdate` only, so the
 * three relation mutators — link, unlink, and re-kind — changed the destination
 * detail page (it renders its PRIMARY POIs server-side) and purged nothing. The
 * stale page then survived behind Cloudflare until the TTL expired.
 *
 * The unlink case carries the subtle half: by the time the purge runs the link
 * row is already soft-deleted, so resolving slugs from the relation table can no
 * longer see the one destination whose page actually changed. It has to be
 * passed in explicitly, which is what the `extraDestinationSlugs` argument is
 * for — and what the "even though the link is already gone" test below pins.
 */

import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { DestinationIdType, PointOfInterestIdType } from '@repo/schemas';
import { PermissionEnum, PointOfInterestDestinationRelationEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// getRevalidationService() is undefined in unit tests (the singleton is never
// initialized), so without this mock every scheduleRevalidation call is a silent
// no-op and this whole suite would pass against the unfixed code.
const mockScheduleRevalidation = vi.fn();
vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => ({
        scheduleRevalidation: mockScheduleRevalidation,
        scheduleRevalidationBatch: vi.fn()
    })
}));

const pointOfInterestId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const colonId = getMockId('destination', 'dest-colon') as DestinationIdType;
const federacionId = getMockId('destination', 'dest-federacion') as DestinationIdType;

const pointOfInterest = PointOfInterestFactoryBuilder.create({
    id: pointOfInterestId,
    slug: 'palacio_san_jose'
});
const colon = { id: colonId, slug: 'colon' };
const federacion = { id: federacionId, slug: 'federacion' };

const actorWithAll = createActor({
    permissions: [
        PermissionEnum.POINT_OF_INTEREST_CREATE,
        PermissionEnum.POINT_OF_INTEREST_UPDATE,
        PermissionEnum.POINT_OF_INTEREST_DELETE
    ]
});

describe('PointOfInterestService — relation edits purge the edge cache (HOS-369)', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createTypedModelMock(PointOfInterestModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, [
            'findOne',
            'findAll',
            'create',
            'update',
            'softDelete'
        ]);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne', 'findById']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);

        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        // Default fan-out state: the POI is linked to Colón only. Each test
        // overrides this to describe the state AFTER its own write.
        asMock(relatedModel.findAll).mockResolvedValue({
            items: [{ destinationId: colonId, pointOfInterestId }],
            total: 1
        });
        asMock(destinationModel.findById).mockImplementation(async (id: unknown) =>
            id === colonId ? colon : id === federacionId ? federacion : null
        );
    });

    /** The single scheduleRevalidation payload, or a failure if none fired. */
    const soleScheduledPurge = () => {
        expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        return mockScheduleRevalidation.mock.calls[0]?.[0] as {
            entityType: string;
            slug: string;
            destinationSlugs: readonly string[];
        };
    };

    it('purges the newly linked destination when a POI is added to it', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(federacion);
        asMock(relatedModel.findOne).mockResolvedValue(null); // no existing link
        asMock(relatedModel.create).mockResolvedValue({
            destinationId: federacionId,
            pointOfInterestId
        });
        // After the write the POI is linked to both destinations.
        asMock(relatedModel.findAll).mockResolvedValue({
            items: [
                { destinationId: colonId, pointOfInterestId },
                { destinationId: federacionId, pointOfInterestId }
            ],
            total: 2
        });

        const result = await service.addPointOfInterestToDestination(actorWithAll, {
            destinationId: federacionId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.PRIMARY
        });

        expect(result.error).toBeUndefined();
        const purge = soleScheduledPurge();
        expect(purge.entityType).toBe('pointOfInterest');
        expect(purge.slug).toBe('palacio_san_jose');
        expect([...purge.destinationSlugs].sort()).toEqual(['colon', 'federacion']);
    });

    it('purges the unlinked destination even though the link is already gone', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(federacion);
        asMock(relatedModel.findOne).mockResolvedValue({
            destinationId: federacionId,
            pointOfInterestId
        });
        asMock(relatedModel.softDelete).mockResolvedValue({
            destinationId: federacionId,
            pointOfInterestId
        });
        // The relation table no longer returns Federación — that is exactly
        // why it has to be supplied explicitly by the caller.
        asMock(relatedModel.findAll).mockResolvedValue({
            items: [{ destinationId: colonId, pointOfInterestId }],
            total: 1
        });

        const result = await service.removePointOfInterestFromDestination(actorWithAll, {
            destinationId: federacionId,
            pointOfInterestId
        });

        expect(result.error).toBeUndefined();
        expect(soleScheduledPurge().destinationSlugs).toContain('federacion');
    });

    it('purges the destination when a link flips PRIMARY/NEARBY', async () => {
        // The destination page renders PRIMARY POIs only, so a re-kind adds or
        // removes an entry just as a link/unlink does.
        asMock(destinationModel.findOne).mockResolvedValue(colon);
        asMock(relatedModel.findOne).mockResolvedValue({
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.PRIMARY
        });
        asMock(relatedModel.update).mockResolvedValue({
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        });

        const result = await service.updatePointOfInterestDestinationRelation(actorWithAll, {
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        });

        expect(result.error).toBeUndefined();
        expect(soleScheduledPurge().destinationSlugs).toEqual(['colon']);
    });

    it('does not purge the same destination twice when it is still linked', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(colon);
        asMock(relatedModel.findOne).mockResolvedValue({
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.PRIMARY
        });
        asMock(relatedModel.update).mockResolvedValue({
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        });

        await service.updatePointOfInterestDestinationRelation(actorWithAll, {
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        });

        const slugs = soleScheduledPurge().destinationSlugs;
        expect(slugs).toEqual([...new Set(slugs)]);
    });

    it('never fails the write when the purge itself blows up', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(colon);
        asMock(relatedModel.findOne).mockResolvedValue({
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.PRIMARY
        });
        asMock(relatedModel.update).mockResolvedValue({
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        });
        asMock(relatedModel.findAll).mockRejectedValue(new Error('db is down'));

        const result = await service.updatePointOfInterestDestinationRelation(actorWithAll, {
            destinationId: colonId,
            pointOfInterestId,
            relation: PointOfInterestDestinationRelationEnum.NEARBY
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.relation).toBeDefined();
    });
});

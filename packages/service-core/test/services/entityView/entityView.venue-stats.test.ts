import { EntityInteractionModel, EntityViewModel, VenueModel } from '@repo/db';
import { EntityTypeEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityViewService } from '../../../src/services/entityView/entityView.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VENUE = '22222222-2222-4222-8222-222222222222';
const actor = createActor({ id: OWNER, roles: [RoleEnum.USER], permissions: [] });

describe('EntityViewService.getStatsForVenue (HOS-2261)', () => {
    let service: EntityViewService;
    let viewModel: EntityViewModel;
    let venueModel: VenueModel;
    let interactionModel: EntityInteractionModel;

    beforeEach(() => {
        viewModel = createTypedModelMock(EntityViewModel, [
            'getStatsForEntities',
            'getDailySeriesForEntityIds'
        ]);
        venueModel = createTypedModelMock(VenueModel, ['findIdsByOwnerId']);
        interactionModel = createTypedModelMock(EntityInteractionModel, ['getClickStatsForEntity']);
        service = new EntityViewService(
            { logger: createLoggerMock() },
            viewModel,
            undefined,
            venueModel,
            undefined,
            interactionModel
        );
        asMock(venueModel.findIdsByOwnerId).mockResolvedValue([VENUE]);
        asMock(viewModel.getStatsForEntities).mockResolvedValue([
            { entityId: VENUE, unique: 10, total: 10 }
        ]);
        asMock(viewModel.getDailySeriesForEntityIds).mockResolvedValue([]);
        asMock(interactionModel.getClickStatsForEntity).mockResolvedValue({
            byKind: [
                { kind: 'PHONE_CLICK', eventId: null, unique: 2, total: 2 },
                { kind: 'MAP_CLICK', eventId: null, unique: 2, total: 2 }
            ],
            visitsWithClick: 12
        });
    });

    it('composes a full 90-day response, zero-fills channels, and caps click rate', async () => {
        const result = await service.getStatsForVenue({ actor, venueId: VENUE, window: '90d' });

        expect(result.error).toBeUndefined();
        expect(result.data?.window).toBe('90d');
        expect(result.data?.dailyViews).toHaveLength(90);
        expect(result.data?.clicks.byKind.WEBSITE_CLICK).toEqual({ unique: 0, total: 0 });
        expect(result.data?.clicks.total).toBe(4);
        expect(result.data?.clickRate).toBe(1);
        expect(asMock(viewModel.getStatsForEntities)).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: EntityTypeEnum.VENUE, windowDays: 90 })
        );
    });

    it('returns null click rate when there are no views', async () => {
        asMock(viewModel.getStatsForEntities).mockResolvedValue([]);
        asMock(interactionModel.getClickStatsForEntity).mockResolvedValue({
            byKind: [],
            visitsWithClick: 1
        });

        const result = await service.getStatsForVenue({ actor, venueId: VENUE, window: '7d' });

        expect(result.data?.clickRate).toBeNull();
        expect(result.data?.views).toEqual({ unique: 0, total: 0 });
        expect(result.data?.dailyViews).toHaveLength(7);
    });

    it('returns not found for a venue outside the actor ownership scope', async () => {
        asMock(venueModel.findIdsByOwnerId).mockResolvedValue([]);

        const result = await service.getStatsForVenue({ actor, venueId: VENUE, window: '30d' });

        expect(result.error).toBeDefined();
        expect(asMock(viewModel.getStatsForEntities)).not.toHaveBeenCalled();
        expect(asMock(interactionModel.getClickStatsForEntity)).not.toHaveBeenCalled();
    });
});

/**
 * @file entityView-listing-comparison.service.test.ts
 *
 * Unit tests for {@link EntityViewService.getDailySeriesComparisonForOwnListing}
 * (HOS-2184 `get_listing_stats`): the daily series of ONE owned listing for the
 * window and for the equally long period right before it.
 *
 * Verifies ownership as the gate (missing, foreign and soft-deleted all answer
 * the same NOT_FOUND), the single `2 * window` model query, the split into
 * `previous` / `current`, gap-filling, and per-vertical model dispatch.
 *
 * All DB models are mocked; no database required.
 */

import { AccommodationModel, EntityViewModel, ExperienceModel, VenueModel } from '@repo/db';
import { EntityTypeEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EntityViewService,
    type GetDailySeriesComparisonForOwnListingInput
} from '../../../src/services/entityView/entityView.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const UUID_OWNER = '11111111-1111-4111-8111-111111111111';
const UUID_LISTING = '22222222-2222-4222-8222-222222222222';
const UUID_OTHER_LISTING = '33333333-3333-4333-8333-333333333333';

const ownerActor = createActor({ id: UUID_OWNER, roles: [RoleEnum.USER], permissions: [] });

const baseInput: GetDailySeriesComparisonForOwnListingInput = {
    actor: ownerActor,
    entityType: EntityTypeEnum.VENUE,
    listingId: UUID_LISTING,
    window: '7d'
};

describe('EntityViewService.getDailySeriesComparisonForOwnListing (HOS-2184)', () => {
    let service: EntityViewService;
    let modelMock: EntityViewModel;
    let accommodationModelMock: AccommodationModel;
    let venueModelMock: VenueModel;
    let experienceModelMock: ExperienceModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityViewModel, ['getDailySeriesForEntityIds']);
        accommodationModelMock = createTypedModelMock(AccommodationModel, ['findIdsByOwnerId']);
        venueModelMock = createTypedModelMock(VenueModel, ['findIdsByOwnerId']);
        experienceModelMock = createTypedModelMock(ExperienceModel, ['findIdsByOwnerId']);
        service = new EntityViewService(
            { logger: createLoggerMock() },
            modelMock,
            accommodationModelMock,
            venueModelMock,
            experienceModelMock
        );
        // Local today is 2026-06-14 in Argentina (see the daily-series tests).
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('rejects an invalid window with VALIDATION_ERROR', async () => {
        // Act
        const result = await service.getDailySeriesComparisonForOwnListing({
            ...baseInput,
            // @ts-expect-error intentionally invalid window
            window: '90d'
        });

        // Assert
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a non-UUID listing id with VALIDATION_ERROR', async () => {
        // Act
        const result = await service.getDailySeriesComparisonForOwnListing({
            ...baseInput,
            listingId: 'not-a-uuid'
        });

        // Assert
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers NOT_FOUND for a listing that is not among the actor own ones, without reading views', async () => {
        // Arrange
        asMock(venueModelMock.findIdsByOwnerId).mockResolvedValue([UUID_OTHER_LISTING]);

        // Act
        const result = await service.getDailySeriesComparisonForOwnListing(baseInput);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('NOT_FOUND');
        expect(asMock(modelMock.getDailySeriesForEntityIds)).not.toHaveBeenCalled();
    });

    it('queries one listing over twice the window and splits previous from current', async () => {
        // Arrange — 7d window: previous = 06-01..06-07, current = 06-08..06-14.
        asMock(venueModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING]);
        asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([
            { date: '2026-06-03', total: 4 },
            { date: '2026-06-12', total: 9 }
        ]);

        // Act
        const result = await service.getDailySeriesComparisonForOwnListing(baseInput);

        // Assert
        expect(asMock(modelMock.getDailySeriesForEntityIds)).toHaveBeenCalledWith({
            entityType: EntityTypeEnum.VENUE,
            windowDays: 14,
            entityIds: [UUID_LISTING]
        });
        expect(result.error).toBeUndefined();
        expect(result.data?.previous).toHaveLength(7);
        expect(result.data?.current).toHaveLength(7);
        expect(result.data?.previous[0]).toEqual({ date: '2026-06-01', total: 0 });
        expect(result.data?.previous[2]).toEqual({ date: '2026-06-03', total: 4 });
        expect(result.data?.previous[6]?.date).toBe('2026-06-07');
        expect(result.data?.current[0]?.date).toBe('2026-06-08');
        expect(result.data?.current[4]).toEqual({ date: '2026-06-12', total: 9 });
        expect(result.data?.current[6]?.date).toBe('2026-06-14');
    });

    it('uses 60 days for the 30d window', async () => {
        // Arrange
        asMock(venueModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING]);
        asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

        // Act
        const result = await service.getDailySeriesComparisonForOwnListing({
            ...baseInput,
            window: '30d'
        });

        // Assert
        expect(asMock(modelMock.getDailySeriesForEntityIds).mock.calls[0]?.[0]).toMatchObject({
            windowDays: 60
        });
        expect(result.data?.previous).toHaveLength(30);
        expect(result.data?.current).toHaveLength(30);
    });

    it.each([
        [EntityTypeEnum.ACCOMMODATION, 'accommodation'],
        [EntityTypeEnum.VENUE, 'venue'],
        [EntityTypeEnum.EXPERIENCE, 'experience']
    ] as const)('resolves ownership through the %s model only', async (entityType, label) => {
        // Arrange
        const models = {
            accommodation: accommodationModelMock,
            venue: venueModelMock,
            experience: experienceModelMock
        };
        asMock(models[label].findIdsByOwnerId).mockResolvedValue([UUID_LISTING]);
        asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

        // Act
        const result = await service.getDailySeriesComparisonForOwnListing({
            ...baseInput,
            entityType
        });

        // Assert
        expect(result.error).toBeUndefined();
        for (const [name, model] of Object.entries(models)) {
            expect(asMock(model.findIdsByOwnerId).mock.calls.length).toBe(name === label ? 1 : 0);
        }
        expect(asMock(models[label].findIdsByOwnerId)).toHaveBeenCalledWith(UUID_OWNER);
    });

    it('returns INTERNAL_ERROR when the view query fails', async () => {
        // Arrange
        asMock(venueModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING]);
        asMock(modelMock.getDailySeriesForEntityIds).mockRejectedValue(new Error('DB timeout'));

        // Act
        const result = await service.getDailySeriesComparisonForOwnListing(baseInput);

        // Assert
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});

/**
 * @file entityView-commerce-daily-series.service.test.ts
 *
 * Unit tests for {@link EntityViewService.getDailySeriesForOwnCommerceListings}
 * (HOS-734 — basic view stats for the gastronomy/experience commerce
 * verticals). Mirrors `entityView-host-daily-series.service.test.ts`.
 *
 * Verifies:
 *  - No `PermissionEnum` gate — ownership scoping via `findIdsByOwnerId` is
 *    the boundary (see the commerce-stats test file for the full rationale).
 *  - Zero-listing owner: fully gap-filled all-zero series, no model call.
 *  - Non-zero: aggregated per-day totals gap-filled to exactly windowDays items.
 *  - Window mapping ('7d' → 7, '30d' → 30).
 *  - Correct model dispatch per vertical (GASTRONOMY vs EXPERIENCE).
 *
 * All DB models are mocked via `createTypedModelMock` — no database required.
 * Every test follows the AAA (Arrange / Act / Assert) pattern.
 */

import { EntityViewModel, ExperienceModel, GastronomyModel } from '@repo/db';
import { EntityTypeEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EntityViewService,
    type GetStatsForOwnCommerceListingsInput
} from '../../../src/services/entityView/entityView.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UUID_OWNER = '11111111-1111-4111-8111-111111111111';
const UUID_LISTING_1 = '22222222-2222-4222-8222-222222222222';

const ownerActor = createActor({
    id: UUID_OWNER,
    roles: [RoleEnum.USER],
    permissions: []
});

const baseInput: GetStatsForOwnCommerceListingsInput = {
    actor: ownerActor,
    entityType: EntityTypeEnum.GASTRONOMY,
    window: '30d'
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EntityViewService.getDailySeriesForOwnCommerceListings (HOS-734)', () => {
    let service: EntityViewService;
    let modelMock: EntityViewModel;
    let gastronomyModelMock: GastronomyModel;
    let experienceModelMock: ExperienceModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityViewModel, [
            'insertView',
            'getStatsForEntities',
            'getDailySeriesForEntityIds',
            'purgeOlderThan'
        ]);
        gastronomyModelMock = createTypedModelMock(GastronomyModel, ['findIdsByOwnerId']);
        experienceModelMock = createTypedModelMock(ExperienceModel, ['findIdsByOwnerId']);
        loggerMock = createLoggerMock();
        service = new EntityViewService(
            { logger: loggerMock },
            modelMock,
            undefined,
            gastronomyModelMock,
            experienceModelMock
        );

        // Pin the clock so gap-fill date assertions are stable.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe('schema validation', () => {
        it('should return VALIDATION_ERROR when window is invalid', async () => {
            // Act
            const result = await service.getDailySeriesForOwnCommerceListings({
                actor: ownerActor,
                entityType: EntityTypeEnum.GASTRONOMY,
                // @ts-expect-error intentionally invalid window
                window: '90d'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('should return VALIDATION_ERROR when entityType is ACCOMMODATION', async () => {
            // Act
            const result = await service.getDailySeriesForOwnCommerceListings({
                actor: ownerActor,
                // @ts-expect-error intentionally passing ACCOMMODATION
                entityType: EntityTypeEnum.ACCOMMODATION,
                window: '30d'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('when owner has zero listings', () => {
        it('should return a gap-filled all-zero series without calling getDailySeriesForEntityIds', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForOwnCommerceListings(baseInput);

            // Assert
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.getDailySeriesForEntityIds)).not.toHaveBeenCalled();
            expect(result.data).toHaveLength(30);
            expect(result.data?.every((item) => item.total === 0)).toBe(true);
        });

        it('should return exactly 7 items for window 7d', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForOwnCommerceListings({
                ...baseInput,
                window: '7d'
            });

            // Assert
            expect(result.data).toHaveLength(7);
        });
    });

    describe('when owner has listings (GASTRONOMY)', () => {
        it('should call getDailySeriesForEntityIds with the actor-owned IDs', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            await service.getDailySeriesForOwnCommerceListings(baseInput);

            // Assert
            expect(asMock(modelMock.getDailySeriesForEntityIds)).toHaveBeenCalledOnce();
            const callArg = asMock(modelMock.getDailySeriesForEntityIds).mock.calls[0]?.[0] as {
                entityIds: string[];
                windowDays: number;
            };
            expect(callArg.entityIds).toEqual([UUID_LISTING_1]);
            expect(callArg.windowDays).toBe(30);
            expect(asMock(experienceModelMock.findIdsByOwnerId)).not.toHaveBeenCalled();
        });

        it('should gap-fill missing days to total=0 in the output', async () => {
            // Arrange — model returns only one day; all others must be gap-filled.
            // Fake clock = 2026-06-15; with window=7d, the oldest date is 2026-06-09.
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([
                { date: '2026-06-12', total: 8 }
            ]);

            // Act
            const result = await service.getDailySeriesForOwnCommerceListings({
                ...baseInput,
                window: '7d'
            });

            // Assert
            expect(result.data).toHaveLength(7);
            expect(result.data?.find((item) => item.date === '2026-06-12')?.total).toBe(8);
            expect(result.data?.find((item) => item.date === '2026-06-09')?.total).toBe(0);
        });
    });

    describe('when owner has listings (EXPERIENCE)', () => {
        it('should dispatch to ExperienceModel.findIdsByOwnerId only', async () => {
            // Arrange
            asMock(experienceModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            await service.getDailySeriesForOwnCommerceListings({
                ...baseInput,
                entityType: EntityTypeEnum.EXPERIENCE
            });

            // Assert
            expect(asMock(experienceModelMock.findIdsByOwnerId)).toHaveBeenCalledWith(UUID_OWNER);
            expect(asMock(gastronomyModelMock.findIdsByOwnerId)).not.toHaveBeenCalled();
        });
    });

    describe('when model throws', () => {
        it('should return INTERNAL_ERROR', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockRejectedValue(new Error('DB timeout'));

            // Act
            const result = await service.getDailySeriesForOwnCommerceListings(baseInput);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });
});

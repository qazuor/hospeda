/**
 * @file entityView-host-daily-series.service.test.ts
 *
 * Unit tests for {@link EntityViewService.getDailySeriesForHostAccommodations}
 * (SPEC-207 §4.1).
 *
 * Verifies:
 *  - Permission check: ACCOMMODATION_VIEW_OWN required (FORBIDDEN when absent).
 *  - Schema validation: window must be '7d' or '30d' (VALIDATION_ERROR otherwise).
 *  - Zero-accommodation host: returns a fully gap-filled all-zero series.
 *  - Non-zero: aggregated per-day totals gap-filled to exactly windowDays items.
 *  - Window mapping: '7d' → windowDays=7, '30d' → windowDays=30.
 *  - Scope isolation: actor.id is always passed to findIdsByOwnerId (no leak).
 *  - Model error propagates as INTERNAL_ERROR.
 *
 * All DB models are mocked via `createTypedModelMock` — no database required.
 * Every test follows the AAA (Arrange / Act / Assert) pattern.
 */

import { AccommodationModel, EntityViewModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EntityViewService,
    type GetDailySeriesForHostAccommodationsInput
} from '../../../src/services/entityView/entityView.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UUID_OWNER = '11111111-1111-4111-8111-111111111111';
const UUID_ACC_1 = '22222222-2222-4222-8222-222222222222';
const UUID_ACC_2 = '33333333-3333-4333-8333-333333333333';

/** Host actor with ACCOMMODATION_VIEW_OWN. */
const hostActor = createActor({
    id: UUID_OWNER,
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
});

/** Actor without any permissions. */
const noPermActor = createActor({
    id: UUID_OWNER,
    role: RoleEnum.USER,
    permissions: []
});

const baseInput: GetDailySeriesForHostAccommodationsInput = {
    actor: hostActor,
    window: '30d'
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EntityViewService.getDailySeriesForHostAccommodations (SPEC-207)', () => {
    let service: EntityViewService;
    let modelMock: EntityViewModel;
    let accommodationModelMock: AccommodationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityViewModel, [
            'insertView',
            'getStatsForEntities',
            'getDailySeriesForEntityIds',
            'purgeOlderThan'
        ]);
        accommodationModelMock = createTypedModelMock(AccommodationModel, ['findIdsByOwnerId']);
        loggerMock = createLoggerMock();
        service = new EntityViewService({ logger: loggerMock }, modelMock, accommodationModelMock);

        // Suppress the time-dependency of gap-fill by using fake timers pinned to
        // a known date (2026-06-15 UTC midnight) so date assertions are stable.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    // =========================================================================
    // Permission guard
    // =========================================================================

    describe('permission guard', () => {
        it('should return FORBIDDEN when actor lacks ACCOMMODATION_VIEW_OWN', async () => {
            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                actor: noPermActor
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should NOT call findIdsByOwnerId when permission is denied', async () => {
            // Act
            await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                actor: noPermActor
            });

            // Assert
            expect(asMock(accommodationModelMock.findIdsByOwnerId)).not.toHaveBeenCalled();
        });

        it('should NOT call model.getDailySeriesForEntityIds when permission is denied', async () => {
            // Act
            await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                actor: noPermActor
            });

            // Assert
            expect(asMock(modelMock.getDailySeriesForEntityIds)).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Schema validation
    // =========================================================================

    describe('schema validation', () => {
        it('should return VALIDATION_ERROR when window is invalid (e.g. 90d)', async () => {
            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                actor: hostActor,
                // @ts-expect-error intentionally passing invalid window
                window: '90d'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // =========================================================================
    // Zero-accommodation host
    // =========================================================================

    describe('when host owns zero accommodations', () => {
        it('should return a gap-filled all-zero series without calling getDailySeriesForEntityIds', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert — no DB model call for view data
            expect(result.error).toBeUndefined();
            expect(asMock(modelMock.getDailySeriesForEntityIds)).not.toHaveBeenCalled();
        });

        it('should return exactly 30 items for window 30d when owner has no accommodations', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert
            expect(result.data).toHaveLength(30);
        });

        it('should return exactly 7 items for window 7d when owner has no accommodations', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                window: '7d'
            });

            // Assert
            expect(result.data).toHaveLength(7);
        });

        it('should return all-zero totals when owner has no accommodations', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert — every item has total 0
            expect(result.data?.every((item) => item.total === 0)).toBe(true);
        });

        it('should return dates in YYYY-MM-DD format when owner has no accommodations', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                window: '7d'
            });

            // Assert
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            expect(result.data?.every((item) => dateRegex.test(item.date))).toBe(true);
        });
    });

    // =========================================================================
    // Happy path — host with accommodations
    // =========================================================================

    describe('when host owns accommodations', () => {
        it('should call getDailySeriesForEntityIds with the actor-owned IDs', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([
                UUID_ACC_1,
                UUID_ACC_2
            ]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert — owned IDs are passed, not caller-supplied IDs
            expect(asMock(modelMock.getDailySeriesForEntityIds)).toHaveBeenCalledOnce();
            const callArg = asMock(modelMock.getDailySeriesForEntityIds).mock.calls[0]?.[0] as {
                entityIds: string[];
                windowDays: number;
            };
            expect(callArg.entityIds).toEqual([UUID_ACC_1, UUID_ACC_2]);
        });

        it('should pass windowDays=30 for window 30d', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            await service.getDailySeriesForHostAccommodations({ ...baseInput, window: '30d' });

            // Assert
            const callArg = asMock(modelMock.getDailySeriesForEntityIds).mock.calls[0]?.[0] as {
                windowDays: number;
            };
            expect(callArg.windowDays).toBe(30);
        });

        it('should pass windowDays=7 for window 7d', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            await service.getDailySeriesForHostAccommodations({ ...baseInput, window: '7d' });

            // Assert
            const callArg = asMock(modelMock.getDailySeriesForEntityIds).mock.calls[0]?.[0] as {
                windowDays: number;
            };
            expect(callArg.windowDays).toBe(7);
        });

        it('should gap-fill missing days to total=0 in the output', async () => {
            // Arrange — model returns only one day; all others must be gap-filled
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            // Fake clock = 2026-06-15; with window=7d, the oldest date is 2026-06-09
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([
                { date: '2026-06-12', total: 8 }
            ]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                window: '7d'
            });

            // Assert — 7 items total
            expect(result.data).toHaveLength(7);
            // Day with data
            const dataDay = result.data?.find((item) => item.date === '2026-06-12');
            expect(dataDay?.total).toBe(8);
            // Gap-filled days
            const zeroDay = result.data?.find((item) => item.date === '2026-06-09');
            expect(zeroDay?.total).toBe(0);
        });

        it('should return exactly 30 items for window 30d', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert
            expect(result.data).toHaveLength(30);
        });

        it('should return exactly 7 items for window 7d', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                window: '7d'
            });

            // Assert
            expect(result.data).toHaveLength(7);
        });

        it('should order items from oldest to newest date', async () => {
            // Arrange — fake clock 2026-06-15, window 7d → dates 2026-06-09..2026-06-15
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockResolvedValue([]);

            // Act
            const result = await service.getDailySeriesForHostAccommodations({
                ...baseInput,
                window: '7d'
            });

            // Assert — first date is oldest, last is today
            expect(result.data?.[0]?.date).toBe('2026-06-09');
            expect(result.data?.[6]?.date).toBe('2026-06-15');
        });

        it('should use actor.id (not caller-supplied) to resolve owned IDs', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert — findIdsByOwnerId called with the actor's own ID
            expect(asMock(accommodationModelMock.findIdsByOwnerId)).toHaveBeenCalledWith(
                UUID_OWNER
            );
        });
    });

    // =========================================================================
    // Model error handling
    // =========================================================================

    describe('when model throws', () => {
        it('should return INTERNAL_ERROR when findIdsByOwnerId throws', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockRejectedValue(
                new Error('DB connection lost')
            );

            // Act
            const result = await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });

        it('should return INTERNAL_ERROR when getDailySeriesForEntityIds throws', async () => {
            // Arrange
            asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_ACC_1]);
            asMock(modelMock.getDailySeriesForEntityIds).mockRejectedValue(
                new Error('query timeout')
            );

            // Act
            const result = await service.getDailySeriesForHostAccommodations(baseInput);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });
});

/**
 * @file entityView-commerce-stats.service.test.ts
 *
 * Unit tests for {@link EntityViewService.getStatsForOwnCommerceListings}
 * (HOS-734 — basic view stats for the gastronomy/experience commerce
 * verticals).
 *
 * Verifies:
 *  - No `PermissionEnum` gate here (unlike accommodation's
 *    `ACCOMMODATION_VIEW_OWN`) — ownership scoping via `findIdsByOwnerId`
 *    IS the security boundary, matching `GastronomyService.listOwn`'s
 *    existing convention.
 *  - Correct model dispatch: GASTRONOMY → `GastronomyModel`, EXPERIENCE →
 *    `ExperienceModel`.
 *  - Scope isolation: actor.id (never a caller-supplied id) is passed to
 *    `findIdsByOwnerId`.
 *  - Zero-view normalization and zero-listing short-circuit (no model call).
 *  - Window mapping ('7d' → 7, '30d' → 30).
 *  - Validation: entityType restricted to GASTRONOMY/EXPERIENCE, window
 *    restricted to '7d'/'30d'.
 *  - Model error propagates as INTERNAL_ERROR.
 *
 * All DB models are mocked via `createTypedModelMock` — no database required.
 * Every test follows the AAA (Arrange / Act / Assert) pattern.
 */

import { EntityViewModel, ExperienceModel, GastronomyModel } from '@repo/db';
import { EntityTypeEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
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
const UUID_LISTING_2 = '33333333-3333-4333-8333-333333333333';

/** A plain authenticated actor — no PermissionEnum is checked by this method. */
const ownerActor = createActor({
    id: UUID_OWNER,
    roles: [RoleEnum.USER],
    permissions: []
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EntityViewService.getStatsForOwnCommerceListings (HOS-734)', () => {
    let service: EntityViewService;
    let modelMock: EntityViewModel;
    let gastronomyModelMock: GastronomyModel;
    let experienceModelMock: ExperienceModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityViewModel, [
            'insertView',
            'getStatsForEntities',
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
    });

    // =========================================================================
    // GASTRONOMY
    // =========================================================================

    describe('entityType: GASTRONOMY', () => {
        const baseInput: GetStatsForOwnCommerceListingsInput = {
            actor: ownerActor,
            entityType: EntityTypeEnum.GASTRONOMY,
            window: '30d'
        };

        it('should return stats for all owned gastronomy listings', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([
                UUID_LISTING_1,
                UUID_LISTING_2
            ]);
            asMock(modelMock.getStatsForEntities).mockResolvedValue([
                { entityId: UUID_LISTING_1, unique: 5, total: 10 },
                { entityId: UUID_LISTING_2, unique: 3, total: 7 }
            ]);

            // Act
            const result = await service.getStatsForOwnCommerceListings(baseInput);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toHaveLength(2);
            expect(result.data).toContainEqual({ entityId: UUID_LISTING_1, unique: 5, total: 10 });
            expect(asMock(experienceModelMock.findIdsByOwnerId)).not.toHaveBeenCalled();
        });

        it('should pass actor.id (not a caller-supplied id) to GastronomyModel.findIdsByOwnerId', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getStatsForEntities).mockResolvedValue([]);

            // Act
            await service.getStatsForOwnCommerceListings(baseInput);

            // Assert
            expect(asMock(gastronomyModelMock.findIdsByOwnerId)).toHaveBeenCalledWith(UUID_OWNER);
        });

        it('should normalize zero-view listings to {unique:0, total:0}', async () => {
            // Arrange — UUID_LISTING_2 absent from model result
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([
                UUID_LISTING_1,
                UUID_LISTING_2
            ]);
            asMock(modelMock.getStatsForEntities).mockResolvedValue([
                { entityId: UUID_LISTING_1, unique: 5, total: 10 }
            ]);

            // Act
            const result = await service.getStatsForOwnCommerceListings(baseInput);

            // Assert
            expect(result.data).toContainEqual({ entityId: UUID_LISTING_2, unique: 0, total: 0 });
        });

        it('should return empty array and skip the model call when actor owns no listings', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([]);

            // Act
            const result = await service.getStatsForOwnCommerceListings(baseInput);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([]);
            expect(asMock(modelMock.getStatsForEntities)).not.toHaveBeenCalled();
        });

        it('should map window 7d to windowDays=7', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getStatsForEntities).mockResolvedValue([]);

            // Act
            await service.getStatsForOwnCommerceListings({ ...baseInput, window: '7d' });

            // Assert
            const callArg = asMock(modelMock.getStatsForEntities).mock.calls[0]?.[0] as {
                windowDays: number;
                entityType: string;
            };
            expect(callArg.windowDays).toBe(7);
            expect(callArg.entityType).toBe(EntityTypeEnum.GASTRONOMY);
        });

        it('should return INTERNAL_ERROR when the model throws', async () => {
            // Arrange
            asMock(gastronomyModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getStatsForEntities).mockRejectedValue(new Error('DB error'));

            // Act
            const result = await service.getStatsForOwnCommerceListings(baseInput);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    // =========================================================================
    // EXPERIENCE
    // =========================================================================

    describe('entityType: EXPERIENCE', () => {
        const baseInput: GetStatsForOwnCommerceListingsInput = {
            actor: ownerActor,
            entityType: EntityTypeEnum.EXPERIENCE,
            window: '30d'
        };

        it('should return stats for all owned experience listings, dispatching to ExperienceModel only', async () => {
            // Arrange
            asMock(experienceModelMock.findIdsByOwnerId).mockResolvedValue([UUID_LISTING_1]);
            asMock(modelMock.getStatsForEntities).mockResolvedValue([
                { entityId: UUID_LISTING_1, unique: 4, total: 9 }
            ]);

            // Act
            const result = await service.getStatsForOwnCommerceListings(baseInput);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toContainEqual({ entityId: UUID_LISTING_1, unique: 4, total: 9 });
            expect(asMock(gastronomyModelMock.findIdsByOwnerId)).not.toHaveBeenCalled();
            const callArg = asMock(modelMock.getStatsForEntities).mock.calls[0]?.[0] as {
                entityType: string;
            };
            expect(callArg.entityType).toBe(EntityTypeEnum.EXPERIENCE);
        });
    });

    // =========================================================================
    // Validation
    // =========================================================================

    describe('validation errors', () => {
        it('should return VALIDATION_ERROR when entityType is ACCOMMODATION', async () => {
            // Act
            const result = await service.getStatsForOwnCommerceListings({
                actor: ownerActor,
                // @ts-expect-error intentionally passing ACCOMMODATION
                entityType: EntityTypeEnum.ACCOMMODATION,
                window: '30d'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('should return VALIDATION_ERROR when window is 90d', async () => {
            // Act
            const result = await service.getStatsForOwnCommerceListings({
                actor: ownerActor,
                entityType: EntityTypeEnum.GASTRONOMY,
                // @ts-expect-error intentionally invalid window
                window: '90d'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });
});

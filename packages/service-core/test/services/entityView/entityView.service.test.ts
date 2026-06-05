/**
 * @file entityView.service.test.ts
 *
 * Unit tests for {@link EntityViewService} (SPEC-159 T-006 / T-007).
 *
 * - T-006: `capture` — anonymous view recording.
 * - T-007: `getStatsForHostAccommodations` — permission-gated host aggregation.
 *          `getStatsForEditorEntities`      — permission-gated editor aggregation.
 *
 * The DB models are mocked via `createTypedModelMock` so no database connection
 * is required. Every test follows the AAA (Arrange / Act / Assert) pattern.
 */

import { AccommodationModel, EntityViewModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityViewService } from '../../../src/services/entityView/entityView.service.js';
import type {
    EntityViewCaptureServiceInput,
    GetStatsForEditorEntitiesInput,
    GetStatsForHostAccommodationsInput
} from '../../../src/services/entityView/entityView.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UUID used as a stable entity id across tests. */
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';

/** Minimal valid capture input. */
const validInput: EntityViewCaptureServiceInput = {
    entityType: EntityTypeEnum.ACCOMMODATION,
    entityId: VALID_UUID,
    visitorHash: 'a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6',
    isAuthenticated: false
};

/** Fake row returned by the model to match SelectEntityView shape. */
const fakeRow = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    entityType: EntityTypeEnum.ACCOMMODATION,
    entityId: VALID_UUID,
    visitorHash: 'a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6',
    isAuthenticated: false,
    viewedAt: new Date('2026-06-05T10:00:00.000Z')
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EntityViewService', () => {
    let service: EntityViewService;
    let modelMock: EntityViewModel;
    let accommodationModelMock: AccommodationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityViewModel, [
            'insertView',
            'getStatsForEntities',
            'purgeOlderThan'
        ]);
        accommodationModelMock = createTypedModelMock(AccommodationModel, ['findIdsByOwnerId']);
        loggerMock = createLoggerMock();
        service = new EntityViewService({ logger: loggerMock }, modelMock, accommodationModelMock);
    });

    // -----------------------------------------------------------------------
    // capture — happy path
    // -----------------------------------------------------------------------

    describe('capture — valid input', () => {
        it('should return a success Result and call insertView with exact args', async () => {
            // Arrange
            asMock(modelMock.insertView).mockResolvedValue(fakeRow);

            // Act
            const result = await service.capture(validInput);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();

            expect(asMock(modelMock.insertView)).toHaveBeenCalledOnce();
            const callArg = asMock(modelMock.insertView).mock.calls[0]?.[0] as typeof validInput;
            expect(callArg.entityType).toBe('ACCOMMODATION');
            expect(callArg.entityId).toBe(VALID_UUID);
            expect(callArg.visitorHash).toBe(validInput.visitorHash);
            expect(callArg.isAuthenticated).toBe(false);
        });

        it('should return success for an authenticated viewer (isAuthenticated: true)', async () => {
            // Arrange
            const authInput: EntityViewCaptureServiceInput = {
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: VALID_UUID,
                visitorHash: 'user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                isAuthenticated: true
            };
            asMock(modelMock.insertView).mockResolvedValue({
                ...fakeRow,
                visitorHash: authInput.visitorHash,
                isAuthenticated: true
            });

            // Act
            const result = await service.capture(authInput);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(asMock(modelMock.insertView)).toHaveBeenCalledOnce();
        });

        it('should return success for POST entity type', async () => {
            // Arrange
            asMock(modelMock.insertView).mockResolvedValue({
                ...fakeRow,
                entityType: EntityTypeEnum.POST
            });

            // Act
            const result = await service.capture({
                ...validInput,
                entityType: EntityTypeEnum.POST
            });

            // Assert
            expect(result.error).toBeUndefined();
            const callArg = asMock(modelMock.insertView).mock.calls[0]?.[0] as {
                entityType: string;
            };
            expect(callArg.entityType).toBe(EntityTypeEnum.POST);
        });

        it('should return success for EVENT entity type', async () => {
            // Arrange
            asMock(modelMock.insertView).mockResolvedValue({
                ...fakeRow,
                entityType: EntityTypeEnum.EVENT
            });

            // Act
            const result = await service.capture({
                ...validInput,
                entityType: EntityTypeEnum.EVENT
            });

            // Assert
            expect(result.error).toBeUndefined();
            const callArg = asMock(modelMock.insertView).mock.calls[0]?.[0] as {
                entityType: string;
            };
            expect(callArg.entityType).toBe(EntityTypeEnum.EVENT);
        });
    });

    // -----------------------------------------------------------------------
    // capture — validation errors
    // -----------------------------------------------------------------------

    describe('capture — invalid entityType', () => {
        it('should return a VALIDATION_ERROR Result and NOT call insertView when entityType is DESTINATION', async () => {
            // Act
            const result = await service.capture({
                ...validInput,
                // @ts-expect-error intentionally passing invalid entityType for test
                entityType: 'DESTINATION'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(asMock(modelMock.insertView)).not.toHaveBeenCalled();
        });

        it('should return a VALIDATION_ERROR Result and NOT call insertView when entityType is USER', async () => {
            // Act
            const result = await service.capture({
                ...validInput,
                // @ts-expect-error intentionally passing invalid entityType for test
                entityType: 'USER'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(asMock(modelMock.insertView)).not.toHaveBeenCalled();
        });

        it('should return a VALIDATION_ERROR Result and NOT call insertView when entityType is empty string', async () => {
            // Act
            const result = await service.capture({
                ...validInput,
                // @ts-expect-error intentionally passing invalid entityType for test
                entityType: ''
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(asMock(modelMock.insertView)).not.toHaveBeenCalled();
        });
    });

    describe('capture — invalid entityId (non-UUID)', () => {
        it('should return a VALIDATION_ERROR Result when entityId is not a UUID', async () => {
            // Act
            const result = await service.capture({
                ...validInput,
                entityId: 'not-a-uuid'
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(asMock(modelMock.insertView)).not.toHaveBeenCalled();
        });

        it('should return a VALIDATION_ERROR Result when entityId is an empty string', async () => {
            // Act
            const result = await service.capture({
                ...validInput,
                entityId: ''
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(asMock(modelMock.insertView)).not.toHaveBeenCalled();
        });
    });

    describe('capture — invalid visitorHash', () => {
        it('should return a VALIDATION_ERROR Result when visitorHash is empty string', async () => {
            // Act
            const result = await service.capture({
                ...validInput,
                visitorHash: ''
            });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect(asMock(modelMock.insertView)).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // capture — model/DB failure
    // -----------------------------------------------------------------------

    describe('capture — model throws', () => {
        it('should return an INTERNAL_ERROR Result when the model throws an Error', async () => {
            // Arrange
            asMock(modelMock.insertView).mockRejectedValue(new Error('DB connection lost'));

            // Act
            const result = await service.capture(validInput);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toContain('DB connection lost');
        });

        it('should return an INTERNAL_ERROR Result when the model throws a non-Error value', async () => {
            // Arrange
            asMock(modelMock.insertView).mockRejectedValue('string error');

            // Act
            const result = await service.capture(validInput);

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should NOT rethrow — the returned Result must carry the error, not propagate it', async () => {
            // Arrange
            asMock(modelMock.insertView).mockRejectedValue(new Error('unexpected'));

            // Act + Assert: must not throw
            await expect(service.capture(validInput)).resolves.toBeDefined();
            const result = await service.capture(validInput);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    // -----------------------------------------------------------------------
    // T-007: getStatsForHostAccommodations
    // -----------------------------------------------------------------------

    describe('getStatsForHostAccommodations', () => {
        const hostActor = createActor({
            id: UUID_1,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
        });

        const noPermActor = createActor({
            id: UUID_1,
            role: RoleEnum.USER,
            permissions: []
        });

        const baseInput: GetStatsForHostAccommodationsInput = {
            actor: hostActor,
            window: '30d'
        };

        describe('when actor has ACCOMMODATION_VIEW_OWN', () => {
            it('should return stats for all owned accommodations', async () => {
                // Arrange
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_2, UUID_3]);
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_2, unique: 5, total: 10 },
                    { entityId: UUID_3, unique: 3, total: 7 }
                ]);

                // Act
                const result = await service.getStatsForHostAccommodations(baseInput);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(2);
                expect(result.data).toContainEqual({ entityId: UUID_2, unique: 5, total: 10 });
                expect(result.data).toContainEqual({ entityId: UUID_3, unique: 3, total: 7 });
            });

            it('should normalize zero-view accommodations to {unique:0, total:0}', async () => {
                // Arrange — UUID_3 has no rows in the window (absent from model result)
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_2, UUID_3]);
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_2, unique: 5, total: 10 }
                ]);

                // Act
                const result = await service.getStatsForHostAccommodations(baseInput);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(2);
                expect(result.data).toContainEqual({ entityId: UUID_3, unique: 0, total: 0 });
            });

            it('should pass actor.id (not caller-supplied id) to findIdsByOwnerId', async () => {
                // Arrange
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_2]);
                asMock(modelMock.getStatsForEntities).mockResolvedValue([]);

                // Act
                await service.getStatsForHostAccommodations(baseInput);

                // Assert: ownership is resolved with the actor's own id
                expect(asMock(accommodationModelMock.findIdsByOwnerId)).toHaveBeenCalledWith(
                    UUID_1
                );
            });

            it('should return empty array when actor owns no accommodations', async () => {
                // Arrange
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([]);

                // Act
                const result = await service.getStatsForHostAccommodations(baseInput);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toEqual([]);
                expect(asMock(modelMock.getStatsForEntities)).not.toHaveBeenCalled();
            });

            it('should map window 7d to windowDays=7', async () => {
                // Arrange
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_2]);
                asMock(modelMock.getStatsForEntities).mockResolvedValue([]);

                // Act
                await service.getStatsForHostAccommodations({ ...baseInput, window: '7d' });

                // Assert
                const callArg = asMock(modelMock.getStatsForEntities).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(7);
            });

            it('should map window 30d to windowDays=30', async () => {
                // Arrange
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_2]);
                asMock(modelMock.getStatsForEntities).mockResolvedValue([]);

                // Act
                await service.getStatsForHostAccommodations({ ...baseInput, window: '30d' });

                // Assert
                const callArg = asMock(modelMock.getStatsForEntities).mock.calls[0]?.[0] as {
                    windowDays: number;
                };
                expect(callArg.windowDays).toBe(30);
            });
        });

        describe('when actor lacks ACCOMMODATION_VIEW_OWN', () => {
            it('should return FORBIDDEN error Result', async () => {
                // Act
                const result = await service.getStatsForHostAccommodations({
                    ...baseInput,
                    actor: noPermActor
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('FORBIDDEN');
                expect(asMock(accommodationModelMock.findIdsByOwnerId)).not.toHaveBeenCalled();
            });
        });

        describe('when window is invalid', () => {
            it('should return VALIDATION_ERROR for window 90d', async () => {
                // Act
                const result = await service.getStatsForHostAccommodations({
                    actor: hostActor,
                    // @ts-expect-error intentionally passing invalid window
                    window: '90d'
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('when model throws', () => {
            it('should return INTERNAL_ERROR Result', async () => {
                // Arrange
                asMock(accommodationModelMock.findIdsByOwnerId).mockResolvedValue([UUID_2]);
                asMock(modelMock.getStatsForEntities).mockRejectedValue(new Error('DB error'));

                // Act
                const result = await service.getStatsForHostAccommodations(baseInput);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('INTERNAL_ERROR');
            });
        });
    });

    // -----------------------------------------------------------------------
    // T-007: getStatsForEditorEntities
    // -----------------------------------------------------------------------

    describe('getStatsForEditorEntities', () => {
        const editorActorPost = createActor({
            id: UUID_1,
            role: RoleEnum.EDITOR,
            permissions: [PermissionEnum.POST_VIEW_ALL]
        });

        const editorActorEvent = createActor({
            id: UUID_1,
            role: RoleEnum.EDITOR,
            permissions: [PermissionEnum.EVENT_VIEW_ALL]
        });

        const noPermActor = createActor({
            id: UUID_1,
            role: RoleEnum.USER,
            permissions: []
        });

        const validPostInput: GetStatsForEditorEntitiesInput = {
            actor: editorActorPost,
            entityType: EntityTypeEnum.POST,
            entityIds: [UUID_2, UUID_3],
            window: '30d'
        };

        describe('POST entityType with POST_VIEW_ALL', () => {
            it('should return stats for all requested POST ids', async () => {
                // Arrange
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_2, unique: 8, total: 20 },
                    { entityId: UUID_3, unique: 2, total: 5 }
                ]);

                // Act
                const result = await service.getStatsForEditorEntities(validPostInput);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(2);
                expect(result.data).toContainEqual({ entityId: UUID_2, unique: 8, total: 20 });
            });

            it('should normalize zero-view POST entities to {unique:0, total:0}', async () => {
                // Arrange — UUID_3 absent from model result
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_2, unique: 8, total: 20 }
                ]);

                // Act
                const result = await service.getStatsForEditorEntities(validPostInput);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(2);
                expect(result.data).toContainEqual({ entityId: UUID_3, unique: 0, total: 0 });
            });
        });

        describe('EVENT entityType with EVENT_VIEW_ALL', () => {
            it('should return stats for EVENT entities', async () => {
                // Arrange
                asMock(modelMock.getStatsForEntities).mockResolvedValue([
                    { entityId: UUID_2, unique: 4, total: 9 }
                ]);

                // Act
                const result = await service.getStatsForEditorEntities({
                    actor: editorActorEvent,
                    entityType: EntityTypeEnum.EVENT,
                    entityIds: [UUID_2],
                    window: '7d'
                });

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toContainEqual({ entityId: UUID_2, unique: 4, total: 9 });
            });
        });

        describe('permission checks', () => {
            it('should return FORBIDDEN when actor lacks POST_VIEW_ALL for POST', async () => {
                // Act
                const result = await service.getStatsForEditorEntities({
                    ...validPostInput,
                    actor: noPermActor
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('FORBIDDEN');
            });

            it('should return FORBIDDEN when actor lacks EVENT_VIEW_ALL for EVENT', async () => {
                // Act
                const result = await service.getStatsForEditorEntities({
                    actor: noPermActor,
                    entityType: EntityTypeEnum.EVENT,
                    entityIds: [UUID_2],
                    window: '30d'
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('FORBIDDEN');
            });
        });

        describe('validation errors', () => {
            it('should return VALIDATION_ERROR when entityType is ACCOMMODATION', async () => {
                // Act
                const result = await service.getStatsForEditorEntities({
                    actor: editorActorPost,
                    // @ts-expect-error intentionally passing ACCOMMODATION
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    entityIds: [UUID_2],
                    window: '30d'
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            });

            it('should return VALIDATION_ERROR when entityIds is empty', async () => {
                // Act
                const result = await service.getStatsForEditorEntities({
                    ...validPostInput,
                    entityIds: []
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            });

            it('should return VALIDATION_ERROR when entityIds exceeds 100', async () => {
                // Arrange: 101 valid UUIDs
                const tooMany = Array.from(
                    { length: 101 },
                    (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`
                );

                // Act
                const result = await service.getStatsForEditorEntities({
                    ...validPostInput,
                    entityIds: tooMany
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            });

            it('should return VALIDATION_ERROR when window is 90d', async () => {
                // Act
                const result = await service.getStatsForEditorEntities({
                    ...validPostInput,
                    // @ts-expect-error intentionally invalid window
                    window: '90d'
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            });

            it('should return VALIDATION_ERROR when an entityId is not a UUID', async () => {
                // Act
                const result = await service.getStatsForEditorEntities({
                    ...validPostInput,
                    entityIds: ['not-a-uuid']
                });

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('when model throws', () => {
            it('should return INTERNAL_ERROR Result', async () => {
                // Arrange
                asMock(modelMock.getStatsForEntities).mockRejectedValue(new Error('DB timeout'));

                // Act
                const result = await service.getStatsForEditorEntities(validPostInput);

                // Assert
                expect(result.data).toBeUndefined();
                expect(result.error?.code).toBe('INTERNAL_ERROR');
            });
        });
    });
});

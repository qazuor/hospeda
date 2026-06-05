/**
 * @file entityView.service.test.ts
 *
 * Unit tests for {@link EntityViewService.capture} (SPEC-159 T-006).
 *
 * The DB model is mocked via `createTypedModelMock` so no database connection
 * is required. Every test follows the AAA (Arrange / Act / Assert) pattern.
 */

import { EntityViewModel } from '@repo/db';
import { EntityTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityViewService } from '../../../src/services/entityView/entityView.service.js';
import type { EntityViewCaptureServiceInput } from '../../../src/services/entityView/entityView.service.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UUID used as a stable entity id across tests. */
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

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
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityViewModel, [
            'insertView',
            'getStatsForEntities',
            'purgeOlderThan'
        ]);
        loggerMock = createLoggerMock();
        service = new EntityViewService({ logger: loggerMock }, modelMock);
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
});

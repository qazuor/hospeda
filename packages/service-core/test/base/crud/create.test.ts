import type { BaseModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import { mockActor, mockAdminActor, mockEntity } from '../base/base.service.mockData';
import {
    type CreateTestEntitySchema,
    type TestEntity,
    TestService
} from '../base/base.service.test.setup';

/**
 * Test suite for the `create` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity creation on valid input and permissions
 * - Validation and error codes for invalid, forbidden, and internal errors
 * - Stripping of extra fields from payload
 * - Robustness against errors in hooks and database operations
 * - Use of custom normalizers for create data
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: create', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;
    const mockCreateData: z.infer<typeof CreateTestEntitySchema> = {
        name: 'New Entity',
        value: 456
    };

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
    });

    it('should create an entity and ignore extra properties in input', async () => {
        asMock(modelMock.create).mockResolvedValue(mockEntity);
        const dataWithExtra = {
            name: 'New Entity',
            value: 456,
            extraField: 'should be ignored'
        };
        const result = await service.create(mockAdminActor, dataWithExtra);
        expect(asMock(modelMock.create)).toHaveBeenCalledWith(
            expect.not.objectContaining({ extraField: 'should be ignored' })
        );
        expectSuccess(result);
        expect(result.data).toEqual(mockEntity);
    });

    it('should create an entity with valid data and permissions', async () => {
        asMock(modelMock.create).mockResolvedValue(mockEntity);
        const data = { name: 'New Entity', value: 456 };
        const result = await service.create(mockAdminActor, data);
        expect(asMock(modelMock.create)).toHaveBeenCalled();
        expectSuccess(result);
        expect(result.data).toEqual(mockEntity);
    });

    it('should return validation error for invalid data', async () => {
        const data = { name: 'New Entity' }; // Missing 'value'
        // @ts-expect-error: Testing invalid input on purpose
        const result = await service.create(mockAdminActor, data);
        expectValidationError(result);
    });

    it('should return forbidden error if actor lacks permission', async () => {
        asMock(modelMock.create).mockResolvedValue(mockEntity); // Should not be called
        const data = { name: 'New Entity', value: 456 };
        const result = await service.create(mockActor, data); // mockActor has no permissions
        expectForbiddenError(result);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('should handle errors from the _beforeCreate lifecycle hook', async () => {
        // Arrange
        asMock(modelMock.create).mockResolvedValue(mockEntity); // Should not be called
        const hookError = new Error('Error in beforeCreate hook');
        vi.spyOn(
            service as unknown as { _beforeCreate: () => void },
            '_beforeCreate'
        ).mockRejectedValue(hookError);
        const data = { name: 'New Entity', value: 456 };
        // Act
        const result = await service.create(mockAdminActor, data);
        // Assert
        expectInternalError(result);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('should return an internal error if database creation fails', async () => {
        // Arrange
        asMock(modelMock.create).mockRejectedValue(new Error('DB connection failed'));
        const data = { name: 'New Entity', value: 456 };
        // Act
        const result = await service.create(mockAdminActor, data);
        // Assert
        expectInternalError(result);
        expect(result.data).toBeUndefined();
    });

    it('should strip extra fields from payload', async () => {
        asMock(modelMock.create).mockResolvedValue(mockEntity);
        const payloadWithExtra = {
            ...mockCreateData,
            extraField: 'should be stripped'
        };
        await service.create(mockAdminActor, payloadWithExtra);
        expect(asMock(modelMock.create)).toHaveBeenCalledWith(
            expect.objectContaining({
                name: mockCreateData.name,
                value: mockCreateData.value
            })
        );
        expect(asMock(modelMock.create)).toHaveBeenCalledWith(
            expect.not.objectContaining({
                extraField: 'should be stripped'
            })
        );
    });

    it('should call the _afterCreate hook with the created entity', async () => {
        asMock(modelMock.create).mockResolvedValue(mockEntity);
        const afterCreateSpy = vi.spyOn(
            service as unknown as { _afterCreate: (...args: unknown[]) => unknown },
            '_afterCreate'
        );
        await service.create(mockAdminActor, mockCreateData);
        expect(afterCreateSpy).toHaveBeenCalledWith(mockEntity, mockAdminActor);
    });

    it('should use the create normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((data) => ({ ...data, normalized: true }));
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.create).mockResolvedValue(mockEntity);
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                create: normalizer
            };
        }
        const normalizedService = createServiceTestInstance(ServiceWithNormalizer, localModelMock);
        // Act
        await normalizedService.create(mockAdminActor, mockCreateData);
        // Assert
        expect(normalizer).toHaveBeenCalledWith(mockCreateData, mockAdminActor);
        expect(localModelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ normalized: true })
        );
    });
});

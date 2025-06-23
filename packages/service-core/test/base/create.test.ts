import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { mockModel } from '../setupTest';
import { mockActor, mockAdminActor, mockEntity } from './base.service.mockData';
import { type CreateTestEntitySchema, TestService } from './base.service.test.setup';

describe('BaseService: create', () => {
    let service: TestService;
    const mockCreateData: z.infer<typeof CreateTestEntitySchema> = {
        name: 'New Entity',
        value: 456
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    it('should create an entity and ignore extra properties in input', async () => {
        mockModel.create.mockResolvedValue(mockEntity);
        const dataWithExtra = {
            name: 'New Entity',
            value: 456,
            extraField: 'should be ignored'
        };

        const result = await service.create(mockAdminActor, dataWithExtra);

        // Zod should strip the extra field, so it shouldn't be passed to the model
        expect(mockModel.create).toHaveBeenCalledWith(
            expect.not.objectContaining({ extraField: 'should be ignored' })
        );
        expect(result.data).toEqual(mockEntity);
    });

    it('should create an entity with valid data and permissions', async () => {
        mockModel.create.mockResolvedValue(mockEntity);
        const data = { name: 'New Entity', value: 456 };
        const result = await service.create(mockAdminActor, data);

        expect(mockModel.create).toHaveBeenCalled();
        expect(result.data).toEqual(mockEntity);
    });

    it('should return validation error for invalid data', async () => {
        const data = { name: 'New Entity' }; // Missing 'value'
        // @ts-expect-error: Testing invalid input on purpose
        const result = await service.create(mockAdminActor, data);

        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return forbidden error if actor lacks permission', async () => {
        const data = { name: 'New Entity', value: 456 };
        const result = await service.create(mockActor, data); // mockActor has no permissions

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(mockModel.create).not.toHaveBeenCalled();
    });

    it('should handle errors from the _beforeCreate lifecycle hook', async () => {
        // Arrange
        const hookError = new Error('Error in beforeCreate hook');
        vi.spyOn(
            service as unknown as { _beforeCreate: () => void },
            '_beforeCreate'
        ).mockRejectedValue(hookError);
        const data = { name: 'New Entity', value: 456 };

        // Act
        const result = await service.create(mockAdminActor, data);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return an internal error if database creation fails', async () => {
        // Arrange
        const dbError = new Error('DB connection failed');
        mockModel.create.mockRejectedValue(dbError);
        const data = { name: 'New Entity', value: 456 };

        // Act
        const result = await service.create(mockAdminActor, data);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should strip extra fields from payload', async () => {
        const payloadWithExtra = {
            ...mockCreateData,
            extraField: 'should be stripped'
        };
        await service.create(mockAdminActor, payloadWithExtra);
        expect(mockModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                name: mockCreateData.name,
                value: mockCreateData.value
            })
        );
        expect(mockModel.create).toHaveBeenCalledWith(
            expect.not.objectContaining({
                extraField: 'should be stripped'
            })
        );
    });

    it('should call the _afterCreate hook with the created entity', async () => {
        // Arrange
        mockModel.create.mockResolvedValue(mockEntity);
        const afterCreateSpy = vi.spyOn(
            service as unknown as { _afterCreate: () => void },
            '_afterCreate'
        );

        // Act
        await service.create(mockAdminActor, mockCreateData);

        // Assert
        expect(afterCreateSpy).toHaveBeenCalledWith(mockEntity, mockAdminActor);
    });

    it('should use the create normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((data) => ({ ...data, normalized: true }));
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                create: normalizer
            };
        }
        const normalizedService = new ServiceWithNormalizer();
        mockModel.create.mockResolvedValue(mockEntity);

        // Act
        await normalizedService.create(mockAdminActor, mockCreateData);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(mockCreateData, mockAdminActor);
        expect(mockModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ normalized: true })
        );
    });
});

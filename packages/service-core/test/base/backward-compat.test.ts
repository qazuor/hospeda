/**
 * @fileoverview
 * Backward compatibility tests for BaseCrudService.
 *
 * Verifies that ALL public methods of BaseCrudService continue to work
 * WITHOUT passing the optional `ctx` (ServiceContext) parameter, ensuring
 * that existing callers (API routes) do not break after the ctx parameter
 * was introduced in SPEC-059.
 *
 * Each test calls a service method WITHOUT ctx and asserts:
 * - No runtime crash / throw
 * - A valid result (data or error) is returned
 */
import type { BaseModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import {
    MOCK_ENTITY_ID,
    mockAdminActor,
    mockDeletedEntity,
    mockEntity
} from './base/base.service.mockData';
import { type TestEntity, TestService } from './base/base.service.test.setup';

describe('BaseCrudService: backward compatibility (no ctx)', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    const mockPaginatedResult = {
        data: [mockEntity],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
    });

    it('getById should work without ctx parameter', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);

        // Act
        const result = await service.getById(mockAdminActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data).toEqual(mockEntity);
        expect(result.error).toBeUndefined();
    });

    it('getBySlug should work without ctx parameter', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);

        // Act
        const result = await service.getBySlug(mockAdminActor, 'test-slug');

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('getByName should work without ctx parameter', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);

        // Act
        const result = await service.getByName(mockAdminActor, 'Test Entity');

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('create should work without ctx -- returns error for validation failure', async () => {
        // Arrange - invalid data (missing required 'value' field)
        const invalidData = { name: 'Valid Name' };

        // Act - call WITHOUT ctx
        // @ts-expect-error: Testing invalid input on purpose (missing 'value')
        const result = await service.create(mockAdminActor, invalidData);

        // Assert - should return validation error, not throw
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('create should work without ctx -- successful creation', async () => {
        // Arrange
        asMock(modelMock.create).mockResolvedValue(mockEntity);
        const validData = { name: 'New Entity', value: 456 };

        // Act - call WITHOUT ctx
        const result = await service.create(mockAdminActor, validData);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('list should work without ctx', async () => {
        // Arrange
        asMock(modelMock.findAllWithRelations).mockResolvedValue(mockPaginatedResult);
        asMock(modelMock.findAll).mockResolvedValue(mockPaginatedResult);

        // Act - call WITHOUT ctx
        const result = await service.list(mockAdminActor);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('softDelete should work without ctx', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue({ ...mockEntity, deletedAt: null });
        asMock(modelMock.softDelete).mockResolvedValue(1);

        // Act - call WITHOUT ctx
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
    });

    it('hardDelete should work without ctx', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue({ ...mockEntity, deletedAt: null });
        asMock(modelMock.hardDelete).mockResolvedValue(1);

        // Act - call WITHOUT ctx
        const result = await service.hardDelete(mockAdminActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
    });

    it('restore should work without ctx', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(mockDeletedEntity);
        asMock(modelMock.restore).mockResolvedValue(1);

        // Act - call WITHOUT ctx
        const result = await service.restore(mockAdminActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
    });

    it('search should work without ctx', async () => {
        // Arrange - _executeSearch returns default result in TestService

        // Act - call WITHOUT ctx
        const result = await service.search(mockAdminActor, {});

        // Assert
        expect(result).toBeDefined();
        // search returns from _executeSearch which returns { items: [], total: 0 }
        // The important thing is no crash
    });

    it('count should work without ctx', async () => {
        // Arrange - _executeCount returns { count: 0 } in TestService

        // Act - call WITHOUT ctx
        const result = await service.count(mockAdminActor, {});

        // Assert
        expect(result).toBeDefined();
        // count returns from _executeCount which returns { count: 0 }
        // The important thing is no crash
    });

    it('update should work without ctx', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
        asMock(modelMock.update).mockResolvedValue({ ...mockEntity, name: 'Updated' });

        // Act - call WITHOUT ctx
        const result = await service.update(mockAdminActor, MOCK_ENTITY_ID, { name: 'Updated' });

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });
});

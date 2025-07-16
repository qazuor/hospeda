import type { BaseModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for BaseService getter methods: getBySlug and getByName.
 * Ensures robust, type-safe, and homogeneous delegation to getByField for both 'name' and 'slug' variants.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { mockActor, mockEntity } from './base.service.mockData';
import { type TestEntity, TestService } from './base.service.test.setup';

const asMock = <T>(fn: T) => fn as unknown as Mock;

/**
 * Tests for BaseService: getBySlug and getByName methods.
 *
 * This suite verifies:
 * - Correct delegation to getByField for both 'name' and 'slug' getters
 * - Robustness and type-safety of getter logic
 *
 * The tests use mocks and spies to ensure correct method calls and argument passing.
 */
describe('BaseService: getBySlug / getByName', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
    });

    it('getByName should call getByField with "name"', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const getByFieldSpy = vi.spyOn(service, 'getByField');
        const name = 'test-entity-name';

        // Act
        await service.getByName(mockActor, name);

        // Assert
        expect(getByFieldSpy).toHaveBeenCalledWith(mockActor, 'name', name);
    });

    it('getBySlug should call getByField with "slug"', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const getByFieldSpy = vi.spyOn(service, 'getByField');
        const slug = 'test-entity-slug';

        // Act
        await service.getBySlug(mockActor, slug);

        // Assert
        expect(getByFieldSpy).toHaveBeenCalledWith(mockActor, 'slug', slug);
    });
});

/**
 * @fileoverview
 * Test suite for BaseService getter methods: getBySlug and getByName.
 * Ensures robust, type-safe, and homogeneous delegation to getByField for both 'name' and 'slug' variants.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ModelMock, createModelMock } from '../helpers/modelMockFactory';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { mockActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

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
    let modelMock: ModelMock;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock();
        service = createServiceTestInstance(TestService, modelMock);
    });

    it('getByName should call getByField with "name"', async () => {
        // Arrange
        modelMock.findOne.mockResolvedValue(mockEntity);
        const getByFieldSpy = vi.spyOn(service, 'getByField');
        const name = 'test-entity-name';

        // Act
        await service.getByName(mockActor, name);

        // Assert
        expect(getByFieldSpy).toHaveBeenCalledWith(mockActor, 'name', name);
    });

    it('getBySlug should call getByField with "slug"', async () => {
        // Arrange
        modelMock.findOne.mockResolvedValue(mockEntity);
        const getByFieldSpy = vi.spyOn(service, 'getByField');
        const slug = 'test-entity-slug';

        // Act
        await service.getBySlug(mockActor, slug);

        // Assert
        expect(getByFieldSpy).toHaveBeenCalledWith(mockActor, 'slug', slug);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockModel } from '../setupTest';
import { mockActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: getBySlug / getByName', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    it('getByName should call getByField with "name"', async () => {
        // Arrange
        mockModel.findOne.mockResolvedValue(mockEntity);
        const getByFieldSpy = vi.spyOn(service, 'getByField');
        const name = 'test-entity-name';

        // Act
        await service.getByName(mockActor, name);

        // Assert
        expect(getByFieldSpy).toHaveBeenCalledWith(mockActor, 'name', name);
    });

    it('getBySlug should call getByField with "slug"', async () => {
        // Arrange
        mockModel.findOne.mockResolvedValue(mockEntity);
        const getByFieldSpy = vi.spyOn(service, 'getByField');
        const slug = 'test-entity-slug';

        // Act
        await service.getBySlug(mockActor, slug);

        // Assert
        expect(getByFieldSpy).toHaveBeenCalledWith(mockActor, 'slug', slug);
    });
});

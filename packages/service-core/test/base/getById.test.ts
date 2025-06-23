import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../src/types';
import { mockModel } from '../setupTest';
import { MOCK_ENTITY_ID, mockActor, mockEntity } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: getById', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    it('should return an entity when found', async () => {
        mockModel.findOne.mockResolvedValue(mockEntity);
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);
        expect(mockModel.findOne).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
        expect(result.data).toEqual(mockEntity);
        expect(result.error).toBeUndefined();
    });

    it('should return null data when entity is not found', async () => {
        mockModel.findOne.mockResolvedValue(null);
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);
        expect(result.data).toBeNull();
        expect(result.error).toBeUndefined();
    });

    it('should return a forbidden error if actor lacks view permission', async () => {
        // Arrange
        mockModel.findOne.mockResolvedValue(mockEntity);
        const service = new TestService();
        const canViewSpy = vi.spyOn(service as unknown as { _canView: () => void }, '_canView');
        canViewSpy.mockImplementationOnce(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'You shall not pass!');
        });

        // Act
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toBe('You shall not pass!');
    });

    it('should return an internal error if the database lookup fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        mockModel.findOne.mockRejectedValue(dbError);
        const service = new TestService();

        // Act
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toBe('An unexpected error occurred.');
    });

    it('should return FORBIDDEN if _canView hook throws an error', async () => {
        mockModel.findOne.mockResolvedValue(mockEntity);
        vi.spyOn(service as unknown as { _canView: () => void }, '_canView').mockImplementation(
            () => {
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden by hook');
            }
        );

        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should handle errors from the _afterGetByField hook', async () => {
        // Arrange
        mockModel.findOne.mockResolvedValue(mockEntity);
        const hookError = new Error('Error in afterGetByField hook');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);

        // Act
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the view normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((field, value) => ({ field: `${field}-normalized`, value }));
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                view: normalizer
            };
        }
        const normalizedService = new ServiceWithNormalizer();
        mockModel.findOne.mockResolvedValue(mockEntity);

        // Act
        await normalizedService.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(normalizer).toHaveBeenCalledWith('id', MOCK_ENTITY_ID, mockActor);
        expect(mockModel.findOne).toHaveBeenCalledWith({ 'id-normalized': MOCK_ENTITY_ID });
    });
});

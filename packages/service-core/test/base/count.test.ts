import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../src/types';
import { mockActor } from './base.service.mockData';
import { TestService } from './base.service.test.setup';

describe('BaseService: count', () => {
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TestService();
    });

    it('should return the total count of entities on success', async () => {
        // Arrange
        const mockCountResult = { count: 42 };
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        vi.spyOn(service as any, '_executeCount').mockResolvedValue(mockCountResult);
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        const canCountSpy = vi.spyOn(service as any, '_canCount');
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        const beforeCountSpy = vi.spyOn(service as any, '_beforeCount');
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        const afterCountSpy = vi.spyOn(service as any, '_afterCount');
        const params = { filters: { name: 'Test' } };

        // Act
        const result = await service.count(mockActor, params);

        // Assert
        expect(result.data).toEqual(mockCountResult);
        expect(result.error).toBeUndefined();
        expect(canCountSpy).toHaveBeenCalledWith(mockActor);
        expect(beforeCountSpy).toHaveBeenCalledWith(params, mockActor);
        expect(afterCountSpy).toHaveBeenCalledWith(mockCountResult, mockActor);
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        expect((service as any)._executeCount).toHaveBeenCalledWith(params, mockActor);
    });

    it('should return a FORBIDDEN error if actor lacks permission', async () => {
        // Arrange
        const forbiddenError = new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Cannot count entities'
        );
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        vi.spyOn(service as any, '_canCount').mockRejectedValue(forbiddenError);
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        const executeCountSpy = vi.spyOn(service as any, '_executeCount');
        const params = { filters: { name: 'Test' } };

        // Act
        const result = await service.count(mockActor, params);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(forbiddenError);
        expect(executeCountSpy).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if _executeCount fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        vi.spyOn(service as any, '_executeCount').mockRejectedValue(dbError);
        const params = { filters: { name: 'Test' } };

        // Act
        const result = await service.count(mockActor, params);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should handle invalid input schema and return a VALIDATION_ERROR', async () => {
        // Arrange
        const invalidParams = { filters: { name: 123 } }; // name should be a string
        // biome-ignore lint/suspicious/noExplicitAny: Testing protected method
        const executeCountSpy = vi.spyOn(service as any, '_executeCount');

        // Act
        // @ts-expect-error Testing invalid input
        const result = await service.count(mockActor, invalidParams);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(executeCountSpy).not.toHaveBeenCalled();
    });
});

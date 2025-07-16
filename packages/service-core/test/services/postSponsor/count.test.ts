import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorService.count', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const validInput = { filters: { name: 'Sponsor' } };

    beforeEach(() => {
        modelMock = createModelMock(['count']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should count post sponsors when permissions and input are valid', async () => {
        modelMock.count.mockResolvedValue(42);
        const result = await service.count(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(modelMock.count).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.count.mockResolvedValue(42);
        const result = await service.count(actor, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid = { filters: { name: '' } };
        const result = await service.count(actor, invalid);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.count.mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return count 0 if no post sponsors found', async () => {
        modelMock.count.mockResolvedValue(0);
        const result = await service.count(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.data).toEqual({ count: 0 });
        expect(result.error).toBeUndefined();
    });
});

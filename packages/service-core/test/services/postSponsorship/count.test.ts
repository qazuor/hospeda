import type { PostSponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorshipService } from '../../../src/services/postSponsorship/postSponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { getMockPostSponsorId } from '../../factories/postSponsorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorshipService.count', () => {
    let service: PostSponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    const validInput = {
        sponsorId: getMockPostSponsorId(),
        postId: getMockId('post'),
        page: 1,
        pageSize: 10
    };

    beforeEach(() => {
        modelMock = createModelMock(['count']);
        loggerMock = createLoggerMock();
        service = new PostSponsorshipService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorshipModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should count post sponsorships when permissions and input are valid', async () => {
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
        const invalid = { sponsorId: '' as any, postId: '' as any, page: 1, pageSize: 10 };
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

    it('should return count 0 if no post sponsorships found', async () => {
        modelMock.count.mockResolvedValue(0);
        const result = await service.count(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.data).toEqual({ count: 0 });
        expect(result.error).toBeUndefined();
    });
});

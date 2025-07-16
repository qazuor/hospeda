import type { PostSponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorshipService } from '../../../src/services/postSponsorship/postSponsorship.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockPostSponsorship,
    getMockPostSponsorshipId
} from '../../factories/postSponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorshipService.getById', () => {
    let service: PostSponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorshipId('mock-id');
    const existing = { ...createMockPostSponsorship({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['findOne']);
        loggerMock = createLoggerMock();
        service = new PostSponsorshipService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorshipModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should get a post sponsorship by id when permissions are valid', async () => {
        modelMock.findOne.mockImplementation((where) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.description).toEqual(existing.description);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOne).toHaveBeenCalledWith({ id });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findOne.mockImplementation((where) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findOne.mockResolvedValue(null);
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

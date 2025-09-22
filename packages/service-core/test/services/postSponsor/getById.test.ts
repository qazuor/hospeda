import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPostSponsor, getMockPostSponsorId } from '../../factories/postSponsorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorService.getById', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorId('mock-id');
    const existing = { ...createMockPostSponsor({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['findOne']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should get a post sponsor by id when permissions are valid', async () => {
        modelMock.findOne.mockImplementation((where) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.logo).toEqual(existing.logo);
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

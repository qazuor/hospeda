import type { PostSponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorshipService } from '../../../src/services/postSponsorship/postSponsorship.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockPostSponsorship,
    getMockPostSponsorshipId
} from '../../factories/postSponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorshipService.restore', () => {
    let service: PostSponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorshipId('mock-id');
    const existing = { ...createMockPostSponsorship({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['restore', 'findById']);
        loggerMock = createLoggerMock();
        service = new PostSponsorshipService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorshipModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should restore a post sponsorship when permissions are valid', async () => {
        const deletedEntity = { ...existing, deletedAt: new Date() };
        modelMock.findById.mockResolvedValue(deletedEntity);
        modelMock.restore.mockResolvedValue(1);
        const result = await service.restore(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(1);
        expect(result.error).toBeUndefined();
        expect(modelMock.findById).toHaveBeenCalledWith(id);
        expect(modelMock.restore).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const deletedEntity = { ...existing, deletedAt: new Date() };
        modelMock.findById.mockResolvedValue(deletedEntity);
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return count 0 if post sponsorship is not deleted', async () => {
        const notDeletedEntity = { ...existing, deletedAt: null };
        modelMock.findById.mockResolvedValue(notDeletedEntity);
        const result = await service.restore(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(0);
        expect(result.error).toBeUndefined();
        expect(modelMock.restore).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const deletedEntity = { ...existing, deletedAt: new Date() };
        modelMock.findById.mockResolvedValue(deletedEntity);
        modelMock.restore.mockRejectedValue(new Error('DB error'));
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

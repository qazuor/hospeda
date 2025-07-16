import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPostSponsor, getMockPostSponsorId } from '../../factories/postSponsorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorService.restore', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorId('mock-id');
    const existing = { ...createMockPostSponsor({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['restore', 'findById']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should restore a post sponsor when permissions are valid', async () => {
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

    it('should return count 0 if post sponsor is not deleted', async () => {
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

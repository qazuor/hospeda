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

describe('PostSponsorshipService.hardDelete', () => {
    let service: PostSponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorshipId('mock-id');
    const existing = { ...createMockPostSponsorship({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['hardDelete', 'findById']);
        loggerMock = createLoggerMock();
        service = new PostSponsorshipService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorshipModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should hard delete a post sponsorship when permissions are valid', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.hardDelete.mockResolvedValue(1);
        const result = await service.hardDelete(actor, id);
        expect(result.data).toBeDefined();
        if (result.data && 'id' in result.data) {
            expect(result.data.id).toEqual(existing.id);
        }
        expect(result.error).toBeUndefined();
        expect(modelMock.hardDelete).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.hardDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.hardDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.hardDelete.mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return 0 if already deleted', async () => {
        const deletedEntity = { ...existing, deletedAt: new Date() };
        modelMock.findById.mockResolvedValue(deletedEntity);
        modelMock.hardDelete.mockImplementation(() => {
            throw new Error('Should not be called');
        });
        const result = await service.hardDelete(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.count ?? 0).toBe(0);
        expect(result.error).toBeUndefined();
        expect(modelMock.hardDelete).not.toHaveBeenCalled();
    });
});

import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPostSponsor, getMockPostSponsorId } from '../../factories/postSponsorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('PostSponsorService.hardDelete', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorId('mock-id');
    const existing = { ...createMockPostSponsor({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['hardDelete', 'findById']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should hard delete a post sponsor when permissions are valid', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.hardDelete.mockResolvedValue(1);
        const result = await service.hardDelete(actor, id);
        expect(result.data).toBeDefined();
        if (result.data && 'logo' in result.data) {
            expect(result.data.logo).toEqual(existing.logo);
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
        // No llamar a hardDelete si ya está eliminado
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

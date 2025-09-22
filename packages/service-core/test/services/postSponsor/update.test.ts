import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockPostSponsor,
    createNewPostSponsorInput,
    getMockPostSponsorId
} from '../../factories/postSponsorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const validInput = createNewPostSponsorInput();

describe('PostSponsorService.update', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockPostSponsorId('mock-id');
    const existing = { ...createMockPostSponsor({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['update', 'findById']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should update a post sponsor when permissions and input are valid', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockResolvedValue({ ...existing, ...validInput });
        const result = await service.update(actor, id, validInput);
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(id);
        expect(result.data?.logo).toEqual(validInput.logo);
        expect(result.error).toBeUndefined();
        expect(modelMock.update).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.update(actor, id, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        modelMock.findById.mockResolvedValue(existing);
        const invalid = { ...validInput, name: '' };
        const result = await service.update(actor, id, invalid);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.update(actor, id, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, id, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

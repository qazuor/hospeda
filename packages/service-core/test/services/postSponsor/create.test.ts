import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockPostSponsor,
    createNewPostSponsorInput
} from '../../factories/postSponsorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// Reemplazar validInput por factory
const validInput = createNewPostSponsorInput();

describe('PostSponsorService.create', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createModelMock(['create']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should create a post sponsor when permissions and input are valid', async () => {
        // Arrange
        const created = { ...createMockPostSponsor(), id: 'mock-id' };
        modelMock.create.mockResolvedValue(created);
        // Act
        const result = await service.create(actor, validInput);
        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('mock-id');
        expect(result.data?.logo).toEqual(created.logo);
        expect(result.error).toBeUndefined();
        expect(modelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: validInput.name })
        );
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        actor = createActor({ permissions: [] });
        // Act
        const result = await service.create(actor, validInput);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const invalid = { ...validInput, name: '' };
        // Act
        const result = await service.create(actor, invalid);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        modelMock.create.mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.create(actor, validInput);
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

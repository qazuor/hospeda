import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/post/post.helpers';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockPost, createNewPostInput } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess, expectValidationError } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.create (custom business logic)', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({
        id: getMockId('user'),
        permissions: [PermissionEnum.POST_CREATE]
    });
    const postId = getMockId('post') as PostId;
    const baseData = createNewPostInput();

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findOne', 'create']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
        vi.spyOn(helpers, 'generatePostSlug').mockResolvedValue('mock-slug');
    });

    it('should create a post with a unique slug', async () => {
        (modelMock.findOne as Mock).mockImplementation(() => null);
        (modelMock.create as Mock).mockImplementation(async (data) =>
            createMockPost({ ...data, id: postId, slug: 'mock-slug' })
        );
        const uniqueInput = createNewPostInput();
        const result = await service.create(actor, uniqueInput);
        expectSuccess(result);
        expect(result.data?.slug).toBe('mock-slug');
    });

    it('should return validation error if title is not unique in category', async () => {
        const duplicateInput = createNewPostInput({
            title: 'Duplicated Title',
            category: baseData.category
        });
        (modelMock.findOne as Mock).mockResolvedValue(createMockPost({ ...duplicateInput }));
        const result = await service.create(actor, duplicateInput);
        expectValidationError(result);
    });

    it('should return validation error if expiresAt is missing for news', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const data = createNewPostInput({ isNews: true });
        const result = await service.create(actor, data);
        expectValidationError(result);
    });

    it('should return validation error if expiresAt is not a future date for news', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const data = createNewPostInput({ isNews: true, expiresAt: new Date(Date.now() - 1000) });
        const result = await service.create(actor, data);
        expectValidationError(result);
    });

    it('should create a news post with valid expiresAt and slug', async () => {
        (modelMock.findOne as Mock).mockImplementation(() => null);
        (modelMock.create as Mock).mockImplementation(async (data) =>
            createMockPost({ ...data, id: postId, slug: 'mock-slug' })
        );
        const uniqueNewsInput = createNewPostInput({
            isNews: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        const result = await service.create(actor, uniqueNewsInput);
        expectSuccess(result);
        expect(result.data?.slug).toBe('mock-slug');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findOne as Mock).mockImplementation(() => null);
        (modelMock.create as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, baseData);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks POST_CREATE permission', async () => {
        const forbiddenActor = createActor({
            id: getMockId('user'),
            permissions: []
        });
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const result = await service.create(forbiddenActor, createNewPostInput());
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.data).toBeUndefined();
    });
});

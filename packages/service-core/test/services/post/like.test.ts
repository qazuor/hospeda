import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectUnauthorizedError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.like', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({ id: getMockId('user') });
    const postId = getMockId('post') as PostId;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findOne', 'update']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should increment likes (success)', async () => {
        const post = createMockPost({ id: postId, likes: 2 });
        (modelMock.findOne as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockResolvedValue({ ...post, likes: 3 });
        const result = await service.like(actor, { postId });
        expectSuccess(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: postId });
        expect(modelMock.update).toHaveBeenCalledWith({ id: postId }, { likes: 3 });
    });

    it('should return not found if post does not exist', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const result = await service.like(actor, { postId });
        expectNotFoundError(result);
    });

    it('should return forbidden if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.like(undefined, { postId });
        expectUnauthorizedError(result);
    });

    it('should return validation error if input is invalid', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.like(actor, { postId: 123 });
        expectValidationError(result);
        // missing postId
        // @ts-expect-error purposely invalid
        const result2 = await service.like(actor, {});
        expectValidationError(result2);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findOne as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.like(actor, { postId });
        expectInternalError(result);
    });
});

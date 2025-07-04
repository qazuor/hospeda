import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceInput } from '../../../src/types';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
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
        const input = { actor, postId };
        const result = await service.like(input);
        expectSuccess(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: postId });
        expect(modelMock.update).toHaveBeenCalledWith({ id: postId }, { likes: 3 });
    });

    it('should return not found if post does not exist', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const input = { actor, postId };
        const result = await service.like(input);
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return forbidden if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.like({ postId });
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.like({ actor: 123, postId });
        expectValidationError(result);
        // missing postId
        const result2 = await service.like({ actor } as unknown as ServiceInput<
            import('../../../src/services/post/post.schemas').LikePostInput
        >);
        expectValidationError(result2);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findOne as Mock).mockRejectedValue(new Error('DB error'));
        const input = { actor, postId };
        const result = await service.like(input);
        expectInternalError(result);
    });
});

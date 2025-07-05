/**
 * @fileoverview
 * Test suite for the PostService.getSummary method.
 * Ensures robust, type-safe, and homogeneous handling of summary retrieval, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { PostModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import * as assertions from '../../helpers/assertions';
import {
    expectForbiddenError,
    expectInternalError,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('PostService.getSummary', () => {
    let service: PostService;
    let modelMock: PostModel;
    let actor: ReturnType<typeof createActor>;
    let post: ReturnType<typeof createMockPost>;
    let input: { id: string };

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findOne']);
        service = createServiceTestInstance(PostService, modelMock);
        actor = createActor();
        post = createMockPost();
        input = { id: post.id };
    });

    it('should return summary for a post', async () => {
        asMock(modelMock.findOne).mockResolvedValue(post);
        const result = await service.getSummary(actor, input);
        assertions.expectSuccess(result);
        expect(result.data).toEqual({
            id: post.id,
            slug: post.slug,
            title: post.title,
            category: post.category,
            media: post.media,
            isFeatured: post.isFeatured,
            isNews: post.isNews,
            createdAt: post.createdAt,
            authorId: post.authorId,
            summary: post.summary
        });
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: post.id });
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        asMock(modelMock.findOne).mockResolvedValue(null);
        const result = await service.getSummary(actor, input);
        assertions.expectNotFoundError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: post.id });
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        asMock(modelMock.findOne).mockResolvedValue(post);
        vi.spyOn(Object.getPrototypeOf(service), '_canView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getSummary(actor, input);
        expectForbiddenError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: post.id });
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getSummary(actor, input);
        expectInternalError(result);
        expect(modelMock.findOne).toHaveBeenCalledWith({ id: post.id });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // purposely invalid input
        const result = await service.getSummary(actor, {});
        expectValidationError(result);
    });
});

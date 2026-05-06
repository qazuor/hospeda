import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum, type UserIdType, VisibilityEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import * as assertions from '../../helpers/assertions';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.getBySlug', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let actor: ReturnType<typeof createActor>;
    let forbiddenActor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findOne']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost();
        actor = createActor({
            id: getMockId('user'),
            permissions: [PermissionEnum.POST_VIEW_PRIVATE],
            role: RoleEnum.USER
        });
        forbiddenActor = createActor({
            id: getMockId('post'),
            permissions: [],
            role: RoleEnum.USER
        });
    });

    it('should return the post if it exists and actor has permission', async () => {
        (modelMock.findOne as Mock).mockImplementation((where) =>
            String(where.slug) === String(post.slug) ? post : null
        );
        (modelMock.findOneWithRelations as Mock).mockImplementation((where) =>
            String(where.slug) === String(post.slug) ? post : null
        );
        const result = await service.getBySlug(actor, post.slug);
        assertions.expectSuccess(result);
        expect(result.data?.slug).toBe(post.slug);
    });

    it('should return FORBIDDEN if actor cannot view the post', async () => {
        // post privado, actor no es autor ni tiene permiso
        const privatePost = createMockPost({
            visibility: VisibilityEnum.PRIVATE,
            authorId: getMockId('user') as UserIdType,
            slug: 'private-slug'
        });
        (modelMock.findOne as Mock).mockImplementation((where) =>
            String(where.slug) === String(privatePost.slug) ? privatePost : null
        );
        (modelMock.findOneWithRelations as Mock).mockImplementation((where) =>
            String(where.slug) === String(privatePost.slug) ? privatePost : null
        );
        const result = await service.getBySlug(forbiddenActor, privatePost.slug);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        (modelMock.findOneWithRelations as Mock).mockResolvedValue(null);
        const result = await service.getBySlug(actor, 'not-found-slug');
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findOne as Mock).mockRejectedValue(new Error('DB error'));
        (modelMock.findOneWithRelations as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getBySlug(actor, post.slug);
        expectInternalError(result);
    });

    it('flattens nested r_post_post_tag rows into a top-level postTags array (SPEC-086)', async () => {
        const postTagA = {
            id: getMockId('feature'),
            name: 'Gastronomía',
            slug: 'gastronomia',
            color: 'ORANGE',
            icon: null,
            description: null,
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };
        const postTagB = {
            id: getMockId('user'),
            name: 'Familia',
            slug: 'familia',
            color: 'BLUE',
            icon: null,
            description: null,
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };
        const postWithJoinRows = {
            ...post,
            postTags: [
                { postId: post.id, postTagId: postTagA.id, postTag: postTagA },
                { postId: post.id, postTagId: postTagB.id, postTag: postTagB }
            ]
        };
        (modelMock.findOne as Mock).mockResolvedValue(postWithJoinRows);
        (modelMock.findOneWithRelations as Mock).mockResolvedValue(postWithJoinRows);
        const result = await service.getBySlug(actor, post.slug);
        assertions.expectSuccess(result);
        const flattened = (result.data as { postTags?: unknown[] }).postTags;
        expect(Array.isArray(flattened)).toBe(true);
        expect(flattened).toHaveLength(2);
        expect((flattened as Array<{ slug: string }>)[0]?.slug).toBe('gastronomia');
        expect((flattened as Array<{ slug: string }>)[1]?.slug).toBe('familia');
    });

    it('returns an empty array when the post has no postTags assigned', async () => {
        const postWithEmptyTags = { ...post, postTags: [] };
        (modelMock.findOne as Mock).mockResolvedValue(postWithEmptyTags);
        (modelMock.findOneWithRelations as Mock).mockResolvedValue(postWithEmptyTags);
        const result = await service.getBySlug(actor, post.slug);
        assertions.expectSuccess(result);
        const flattened = (result.data as { postTags?: unknown[] }).postTags;
        expect(Array.isArray(flattened)).toBe(true);
        expect(flattened).toHaveLength(0);
    });
});

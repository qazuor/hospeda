import { LifecycleStatusEnum, RoleEnum, type UserId, VisibilityEnum } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostModel } from '../../../models/post/post.model';
import { PostService } from '../../../services/post/post.service';
import { getMockPost, getMockPublicUser, getMockUser } from '../mockData';

const admin = getMockUser({ role: RoleEnum.ADMIN });
const superAdmin = getMockUser({ role: RoleEnum.SUPER_ADMIN });
const author = getMockUser({ id: 'author-1' as UserId, role: RoleEnum.USER });
const otherUser = getMockUser({ id: 'user-2' as UserId, role: RoleEnum.USER });
const disabledUser = getMockUser({
    id: 'user-3' as UserId,
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const publicActor = getMockPublicUser();

const publicPost = getMockPost({
    slug: 'public-post',
    visibility: VisibilityEnum.PUBLIC,
    authorId: author.id
});
const privatePost = getMockPost({
    slug: 'private-post',
    visibility: VisibilityEnum.PRIVATE,
    authorId: author.id
});
const draftPost = getMockPost({
    slug: 'draft-post',
    visibility: VisibilityEnum.DRAFT,
    authorId: author.id
});

vi.mock('../../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('Forbidden');
    })
}));

const expectInfoLog = (method: string) => {
    expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), `${method}:start`);
    expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), `${method}:end`);
};
const expectNoPermissionLog = () => {
    expect(mockServiceLogger.permission).not.toHaveBeenCalled();
};
const expectPermissionLog = () => {
    expect(mockServiceLogger.permission).toHaveBeenCalled();
};

describe('PostService.getBySlug', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return the post for public visibility to any actor', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(publicPost);
        const result = await PostService.getBySlug({ slug: publicPost.slug }, publicActor);
        expect(result.post).toEqual(publicPost);
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });

    it('should return the post for the author regardless of visibility', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(privatePost);
        const result = await PostService.getBySlug({ slug: privatePost.slug }, author);
        expect(result.post).toEqual(privatePost);
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });

    it('should return the post for admin regardless of visibility', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(draftPost);
        const result = await PostService.getBySlug({ slug: draftPost.slug }, admin);
        expect(result.post).toEqual(draftPost);
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });

    it('should return the post for superadmin regardless of visibility', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(privatePost);
        const result = await PostService.getBySlug({ slug: privatePost.slug }, superAdmin);
        expect(result.post).toEqual(privatePost);
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });

    it('should return null for other user without permission on private post', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(privatePost);
        const result = await PostService.getBySlug({ slug: privatePost.slug }, otherUser);
        expect(result.post).toBeNull();
        expectInfoLog('getBySlug');
        expectPermissionLog();
    });

    it('should return null for disabled user', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(publicPost);
        const result = await PostService.getBySlug({ slug: publicPost.slug }, disabledUser);
        expect(result.post).toBeNull();
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });

    it('should return null if post not found', async () => {
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(undefined);
        const result = await PostService.getBySlug({ slug: 'not-exist' }, admin);
        expect(result.post).toBeNull();
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });

    it('should return null for unknown visibility', async () => {
        const weirdPost = { ...publicPost, visibility: 'UNKNOWN' } as unknown as ReturnType<
            typeof getMockPost
        >;
        vi.spyOn(PostModel, 'getBySlug').mockResolvedValue(
            weirdPost as unknown as import('@repo/types').PostType
        );
        const result = await PostService.getBySlug({ slug: weirdPost.slug }, admin);
        expect(result.post).toBeNull();
        expectInfoLog('getBySlug');
        expectNoPermissionLog();
    });
});

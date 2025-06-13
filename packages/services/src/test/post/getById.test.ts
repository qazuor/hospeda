import { PostModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost, getMockPostId } from '../factories/postFactory';
import { getMockPublicUser, getMockUser, getMockUserId } from '../factories/userFactory';

const admin = getMockUser({ role: RoleEnum.ADMIN });
const superAdmin = getMockUser({ role: RoleEnum.SUPER_ADMIN });
const author = getMockUser({ id: getMockUserId('author-1'), role: RoleEnum.USER });
const otherUser = getMockUser({ id: getMockUserId('user-2'), role: RoleEnum.USER });
const disabledUser = getMockUser({
    id: getMockUserId('user-3'),
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const publicActor = getMockPublicUser();

const publicPost = getMockPost({
    id: getMockPostId('post-1'),
    visibility: VisibilityEnum.PUBLIC,
    authorId: author.id
});
const privatePost = getMockPost({
    id: getMockPostId('post-2'),
    visibility: VisibilityEnum.PRIVATE,
    authorId: author.id
});
const draftPost = getMockPost({
    id: getMockPostId('post-3'),
    visibility: VisibilityEnum.DRAFT,
    authorId: author.id
});

vi.mock('../../utils/permission-manager', () => ({
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

describe('PostService.getById', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return the post for public visibility to any actor', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(publicPost);
        const result = await PostService.getById({ id: publicPost.id }, publicActor);
        expect(result.post).toEqual(publicPost);
        expectInfoLog('getById');
        expectNoPermissionLog();
    });

    it('should return the post for the author regardless of visibility', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(privatePost);
        const result = await PostService.getById({ id: privatePost.id }, author);
        expect(result.post).toEqual(privatePost);
        expectInfoLog('getById');
        expectNoPermissionLog();
    });

    it('should return the post for admin regardless of visibility', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(draftPost);
        const result = await PostService.getById({ id: draftPost.id }, admin);
        expect(result.post).toEqual(draftPost);
        expectInfoLog('getById');
        expectNoPermissionLog();
    });

    it('should return the post for superadmin regardless of visibility', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(privatePost);
        const result = await PostService.getById({ id: privatePost.id }, superAdmin);
        expect(result.post).toEqual(privatePost);
        expectInfoLog('getById');
        expectNoPermissionLog();
    });

    it('should return null for other user without permission on private post', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(privatePost);
        const result = await PostService.getById({ id: privatePost.id }, otherUser);
        expect(result.post).toBeNull();
        expectInfoLog('getById');
        expectPermissionLog();
    });

    it('should return null for disabled user', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(publicPost);
        const result = await PostService.getById({ id: publicPost.id }, disabledUser);
        expect(result.post).toBeNull();
        expectInfoLog('getById');
        expectNoPermissionLog();
    });

    it('should return null if post not found', async () => {
        vi.spyOn(PostModel, 'getById').mockResolvedValue(undefined);
        const result = await PostService.getById({ id: getMockPostId('not-exist') }, admin);
        expect(result.post).toBeNull();
        expectInfoLog('getById');
        expectNoPermissionLog();
    });

    it('should return null for unknown visibility', async () => {
        const weirdPost = { ...publicPost, visibility: 'UNKNOWN' } as unknown as ReturnType<
            typeof getMockPost
        >;
        vi.spyOn(PostModel, 'getById').mockResolvedValue(
            weirdPost as unknown as import('@repo/types').PostType
        );
        const result = await PostService.getById({ id: weirdPost.id }, admin);
        expect(result.post).toBeNull();
        expectInfoLog('getById');
        expectNoPermissionLog();
    });
});

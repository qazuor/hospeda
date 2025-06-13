import { PostModel } from '@repo/db';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import * as permissionManager from '../../utils/permission-manager';
import * as serviceHelper from '../../utils/service-helper';
import {
    getMockAdminUser,
    getMockDisabledUser,
    getMockPost,
    getMockPostId,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories';
import { expectPermissionLog } from '../utils/log-assertions';

vi.mock('../../utils/service-helper', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        isUserDisabled: vi.fn(
            (actual as Record<string, unknown>).isUserDisabled as (actor: unknown) => boolean
        )
    };
});

const userId = getMockUserId();
const user = getMockUser({ id: userId });
const admin = getMockAdminUser({
    id: getMockUserId('admin-uuid')
});
const publicUser = getMockPublicUser();
const post = getMockPost({
    id: getMockPostId('post-uuid'),
    authorId: userId
});
const noPermUser = getMockUser({
    id: getMockUserId('no-perm-uuid')
});

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('PostService.softDelete', () => {
    it('should soft delete post as author', async () => {
        (PostModel.getById as Mock)
            .mockResolvedValueOnce(post)
            .mockResolvedValueOnce({ ...post, deletedAt: new Date(), deletedById: user.id });
        (PostModel.delete as Mock).mockResolvedValue({ id: post.id });
        const input = { id: post.id };
        const result = await PostService.softDelete(input, user);
        expect(result.post).toMatchObject({
            ...post,
            deletedAt: expect.any(Date),
            deletedById: user.id
        });
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should soft delete post as admin', async () => {
        (PostModel.getById as Mock)
            .mockResolvedValueOnce(post)
            .mockResolvedValueOnce({ ...post, deletedAt: new Date(), deletedById: admin.id });
        (PostModel.delete as Mock).mockResolvedValue({ id: post.id });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        const input = { id: post.id };
        const result = await PostService.softDelete(input, admin);
        expect(result.post).toMatchObject({
            ...post,
            deletedAt: expect.any(Date),
            deletedById: admin.id
        });
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should throw and log permission if user has no permission', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        (PostModel.delete as Mock).mockResolvedValue({ id: post.id });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to delete post');
        });
        const input = { id: post.id };
        await expect(PostService.softDelete(input, noPermUser)).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw and log if input is invalid', async () => {
        const input = { id: getMockPostId('') };
        await expect(PostService.softDelete(input, user)).rejects.toThrow();
        expect(mockServiceLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should throw and log if actor is public user', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        const input = { id: post.id };
        await expect(PostService.softDelete(input, publicUser)).rejects.toThrow(
            /Forbidden: Public user cannot delete posts/
        );
        expectPermissionLog({
            extraData: expect.objectContaining({
                override: expect.stringContaining('Public user cannot delete posts')
            })
        });
    });

    it('should throw and log if actor is disabled', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        vi.mocked(serviceHelper.isUserDisabled).mockReturnValue(true);
        const disabledUser = getMockDisabledUser({
            id: getMockUserId('disabled-uuid')
        });
        const input = { id: post.id };
        await expect(PostService.softDelete(input, disabledUser)).rejects.toThrow(
            /Disabled user cannot delete posts/
        );
        expectPermissionLog({
            extraData: expect.objectContaining({
                error: expect.stringContaining('disabled user cannot delete')
            })
        });
    });

    it('should throw if post not found', async () => {
        (PostModel.getById as Mock).mockResolvedValue(null);
        const input = { id: getMockPostId('not-found') };
        await expect(PostService.softDelete(input, user)).rejects.toThrow(/Post not found/);
    });

    it('should throw if post already deleted', async () => {
        (PostModel.getById as Mock).mockResolvedValue({ ...post, deletedAt: new Date() });
        const input = { id: post.id };
        await expect(PostService.softDelete(input, user)).rejects.toThrow(/Post already deleted/);
    });
});

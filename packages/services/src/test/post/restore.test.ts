import { PostModel } from '@repo/db';
import type { PostId, UserId } from '@repo/types';
import { RoleEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import * as permissionManager from '../../utils/permission-manager';
import * as serviceHelper from '../../utils/service-helper';
import { getMockPost, getMockPublicUser, getMockUser } from '../mockData';

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

const user = getMockUser();
const admin = getMockUser({
    role: RoleEnum.ADMIN,
    id: 'admin-uuid' as UserId
});
const publicUser = getMockPublicUser();
const deletedPost = getMockPost({ authorId: user.id, deletedAt: new Date(), deletedById: user.id });
const activePost = getMockPost({ authorId: user.id, deletedAt: undefined, deletedById: undefined });
const noPermUser = getMockUser({
    id: 'no-perm-uuid' as UserId,
    role: RoleEnum.USER
});

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('PostService.restore', () => {
    it('should restore post as author', async () => {
        (PostModel.getById as Mock).mockResolvedValueOnce(deletedPost).mockResolvedValueOnce({
            ...deletedPost,
            deletedAt: undefined,
            deletedById: undefined
        });
        (PostModel.update as Mock).mockResolvedValue({
            ...deletedPost,
            deletedAt: undefined,
            deletedById: undefined
        });
        const input = { id: deletedPost.id };
        const result = await PostService.restore(input, user);
        expect(result.post).toMatchObject({
            ...deletedPost,
            deletedAt: undefined,
            deletedById: undefined
        });
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should restore post as admin', async () => {
        (PostModel.getById as Mock).mockResolvedValueOnce(deletedPost).mockResolvedValueOnce({
            ...deletedPost,
            deletedAt: undefined,
            deletedById: undefined
        });
        (PostModel.update as Mock).mockResolvedValue({
            ...deletedPost,
            deletedAt: undefined,
            deletedById: undefined
        });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        const input = { id: deletedPost.id };
        const result = await PostService.restore(input, admin);
        expect(result.post).toMatchObject({
            ...deletedPost,
            deletedAt: undefined,
            deletedById: undefined
        });
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should throw and log permission if user has no permission', async () => {
        (PostModel.getById as Mock).mockResolvedValue(deletedPost);
        (PostModel.update as Mock).mockResolvedValue(deletedPost);
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to restore post');
        });
        const input = { id: deletedPost.id };
        await expect(PostService.restore(input, noPermUser)).rejects.toThrow(/Forbidden/);
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
            })
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { id: '' as PostId };
        await expect(PostService.restore(input, user)).rejects.toThrow();
        expect(mockServiceLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should throw and log if actor is public user', async () => {
        (PostModel.getById as Mock).mockResolvedValue(deletedPost);
        const input = { id: deletedPost.id };
        await expect(PostService.restore(input, publicUser)).rejects.toThrow(
            /Forbidden: Public user cannot restore posts/
        );
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({
                    override: expect.stringContaining('Public user cannot restore posts')
                })
            })
        );
    });

    it('should throw and log if actor is disabled', async () => {
        (PostModel.getById as Mock).mockResolvedValue(deletedPost);
        vi.mocked(serviceHelper.isUserDisabled).mockReturnValue(true);
        const disabledUser = getMockUser({
            id: 'disabled-uuid' as UserId,
            role: RoleEnum.USER
        });
        const input = { id: deletedPost.id };
        await expect(PostService.restore(input, disabledUser)).rejects.toThrow(
            /Disabled user cannot restore posts/
        );
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({
                    error: expect.stringContaining('disabled user cannot restore')
                })
            })
        );
    });

    it('should throw if post not found', async () => {
        (PostModel.getById as Mock).mockResolvedValue(null);
        const input = { id: 'not-found' as PostId };
        await expect(PostService.restore(input, user)).rejects.toThrow(/Post not found/);
    });

    it('should throw if post is not deleted', async () => {
        (PostModel.getById as Mock).mockResolvedValue(activePost);
        const input = { id: activePost.id };
        await expect(PostService.restore(input, user)).rejects.toThrow(/Post is not deleted/);
    });
});

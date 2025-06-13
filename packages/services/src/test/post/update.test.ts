import { PostModel } from '@repo/db';
import { RoleEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import * as permissionManager from '../../utils/permission-manager';
import * as serviceHelper from '../../utils/service-helper';
import {
    getMockPost,
    getMockPostId,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories';

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
    id: getMockUserId('admin-uuid')
});
const publicUser = getMockPublicUser();
const post = getMockPost({ authorId: user.id });
const noPermUser = getMockUser({
    id: getMockUserId('no-perm-uuid'),
    role: RoleEnum.USER
});

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('PostService.update', () => {
    it('should update post as author', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        (PostModel.update as Mock).mockResolvedValue({ ...post, title: 'Updated' });
        const input = { id: post.id, title: 'Updated' };
        const result = await PostService.update(input, user);
        expect(result.post).toMatchObject({ ...post, title: 'Updated' });
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should update post as admin', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        (PostModel.update as Mock).mockResolvedValue({ ...post, title: 'Admin Updated' });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        const input = { id: post.id, title: 'Admin Updated' };
        const result = await PostService.update(input, admin);
        expect(result.post).toMatchObject({ ...post, title: 'Admin Updated' });
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should throw and log permission if user has no permission', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        (PostModel.update as Mock).mockResolvedValue(post);
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to update post');
        });
        const input = { id: post.id, title: 'NoPerm' };
        await expect(PostService.update(input, noPermUser)).rejects.toThrow(/Forbidden/);
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
            })
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { id: '', title: 'Invalid' };
        await expect(PostService.update(input, user)).rejects.toThrow();
        expect(mockServiceLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should throw and log if actor is public user', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        const input = { id: post.id, title: 'Public' };
        await expect(PostService.update(input, publicUser)).rejects.toThrow(
            /Forbidden: Public user cannot update posts/
        );
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({
                    override: expect.stringContaining('Public user cannot update posts')
                })
            })
        );
    });

    it('should throw and log if actor is disabled', async () => {
        (PostModel.getById as Mock).mockResolvedValue(post);
        vi.mocked(serviceHelper.isUserDisabled).mockReturnValue(true);
        const disabledUser = getMockUser({
            id: getMockUserId('disabled-uuid'),
            role: RoleEnum.USER
        });
        const input = { id: post.id, title: 'Disabled' };
        await expect(PostService.update(input, disabledUser)).rejects.toThrow(
            /Disabled user cannot update posts/
        );
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({
                    error: expect.stringContaining('disabled user cannot update')
                })
            })
        );
    });

    it('should throw if post not found', async () => {
        (PostModel.getById as Mock).mockResolvedValue(null);
        const input = { id: getMockPostId('not-found'), title: 'NotFound' };
        await expect(PostService.update(input, user)).rejects.toThrow(/Post not found/);
    });
});

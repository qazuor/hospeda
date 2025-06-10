import { PermissionEnum, RoleEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostModel } from '../../../models/post/post.model';
import { PostService } from '../../../services/post/post.service';
import * as permissionManager from '../../../utils/permission-manager';
import { getMockPost, getMockPostInput, getMockPublicUser, getMockUser } from '../mockData';

vi.mock('../../../models/post/post.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        PostModel: {
            ...((actual as Record<string, unknown>).PostModel ?? {}),
            create: vi.fn()
        }
    };
});

describe('PostService.create', () => {
    const user = getMockUser({
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.POST_CREATE]
    });
    const noPermUser = getMockUser({ role: RoleEnum.USER });
    const publicUser = getMockPublicUser();

    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create post and log start/end', async () => {
        (PostModel.create as Mock).mockResolvedValue(getMockPost());
        const input = getMockPostInput();
        const result = await PostService.create(input, user);
        expect(result.post).toMatchObject(
            expect.objectContaining({
                id: 'post-uuid',
                slug: 'post-slug',
                category: input.category,
                title: input.title,
                summary: input.summary,
                content: input.content,
                authorId: 'user-uuid',
                visibility: input.visibility
            })
        );
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:end');
    });

    it('should throw and log permission if user has no permission', async () => {
        (PostModel.create as Mock).mockResolvedValue(getMockPost());
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to create post');
        });
        const input = getMockPostInput();
        await expect(PostService.create(input, noPermUser)).rejects.toThrow(/Forbidden/);
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({
                    error: expect.stringContaining('Forbidden')
                })
            })
        );
    });

    it('should throw on invalid input', async () => {
        const input = { ...getMockPostInput(), title: '' };
        await expect(PostService.create(input, user)).rejects.toThrow();
    });

    it('should throw and log permission if actor is public user', async () => {
        const input = getMockPostInput();
        await expect(PostService.create(input, publicUser)).rejects.toThrow(
            /Forbidden: Public user cannot create posts/
        );
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                extraData: expect.objectContaining({
                    override: expect.stringContaining('Public user cannot create posts')
                })
            })
        );
    });
});

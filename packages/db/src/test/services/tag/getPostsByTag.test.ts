import type { TagId } from '@repo/types/common/id.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostModel } from '../../../../src/models/post/post.model';
import type { GetPostsByTagInput } from '../../../../src/services/tag/tag.schemas';
import { TagService } from '../../../../src/services/tag/tag.service';
import { getMockPost, getMockPublicUser, getMockTagId } from '../../mockData';

vi.mock('../../../../src/models/post/post.model');

const mockPost = getMockPost();
const mockTagId: TagId = getMockTagId();
const publicUser = getMockPublicUser();

describe('TagService.getPostsByTag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns posts for a valid tag', async () => {
        (PostModel.getByTag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockPost
        ]);
        const input: GetPostsByTagInput = { tagId: mockTagId };
        const result = await TagService.getPostsByTag(input, publicUser);
        expect(result.posts).toHaveLength(1);
        expect(result.posts[0]).toEqual(mockPost);
        expect(PostModel.getByTag).toHaveBeenCalledWith(mockTagId, expect.objectContaining({}));
    });

    it('returns empty array if no posts for tag', async () => {
        (PostModel.getByTag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
        const input: GetPostsByTagInput = { tagId: mockTagId };
        const result = await TagService.getPostsByTag(input, publicUser);
        expect(result.posts).toEqual([]);
    });

    it('supports pagination and ordering', async () => {
        (PostModel.getByTag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockPost
        ]);
        const input: GetPostsByTagInput = {
            tagId: mockTagId,
            limit: 1,
            offset: 0,
            order: 'desc',
            orderBy: 'title'
        };
        await TagService.getPostsByTag(input, publicUser);
        expect(PostModel.getByTag).toHaveBeenCalledWith(
            mockTagId,
            expect.objectContaining({
                limit: 1,
                offset: 0,
                order: 'desc',
                orderBy: 'title'
            })
        );
    });

    it('throws on invalid input (Zod)', async () => {
        await expect(
            TagService.getPostsByTag({ tagId: '' as TagId }, publicUser)
        ).rejects.toThrow();
    });

    it('allows public user (no permission required)', async () => {
        (PostModel.getByTag as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockPost
        ]);
        const input: GetPostsByTagInput = { tagId: mockTagId };
        const result = await TagService.getPostsByTag(input, publicUser);
        expect(result.posts).toHaveLength(1);
    });
});

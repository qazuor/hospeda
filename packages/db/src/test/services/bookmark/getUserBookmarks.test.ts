import type { UserId } from '@repo/types/common/id.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkModel } from '../../../../src/models/user/user_bookmark.model';
import type { GetUserBookmarksInput } from '../../../../src/services/bookmark/bookmark.schemas';
import { BookmarkService } from '../../../../src/services/bookmark/bookmark.service';
import { getMockPublicUser, getMockUser, getMockUserBookmark, getMockUserId } from '../../mockData';

vi.mock('../../../../src/models/user/user_bookmark.model');

const mockUser = getMockUser();
const mockUserId: UserId = getMockUserId();
const mockBookmark = getMockUserBookmark();
const publicUser = getMockPublicUser();

describe('BookmarkService.getUserBookmarks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns bookmarks for the user (happy path)', async () => {
        (
            UserBookmarkModel.getByUserId as unknown as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce([mockBookmark]);
        const input: GetUserBookmarksInput = {
            userId: mockUserId
        };
        const result = await BookmarkService.getUserBookmarks(input, mockUser);
        expect(result.bookmarks).toEqual([mockBookmark]);
        expect(UserBookmarkModel.getByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('throws if actor is not the user', async () => {
        const otherUser = getMockUser({ id: 'other-user-id' as UserId });
        const input: GetUserBookmarksInput = {
            userId: mockUserId
        };
        await expect(BookmarkService.getUserBookmarks(input, otherUser)).rejects.toThrow(
            'Forbidden'
        );
    });

    it('throws if actor is public', async () => {
        const input: GetUserBookmarksInput = {
            userId: mockUserId
        };
        await expect(BookmarkService.getUserBookmarks(input, publicUser)).rejects.toThrow(
            'Forbidden'
        );
    });

    it('throws on invalid input (Zod)', async () => {
        const input = { userId: '' as UserId } as GetUserBookmarksInput;
        await expect(BookmarkService.getUserBookmarks(input, mockUser)).rejects.toThrow();
    });
});

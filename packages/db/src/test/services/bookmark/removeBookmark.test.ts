import type { UserId } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkModel } from '../../../../src/models/user/user_bookmark.model';
import type { RemoveBookmarkInput } from '../../../../src/services/bookmark/bookmark.schemas';
import { BookmarkService } from '../../../../src/services/bookmark/bookmark.service';
import { getMockPublicUser, getMockUser, getMockUserBookmark, getMockUserId } from '../../mockData';

vi.mock('../../../../src/models/user/user_bookmark.model');

const mockUser = getMockUser();
const mockUserId: UserId = getMockUserId();
const mockBookmark = getMockUserBookmark();
const publicUser = getMockPublicUser();

describe('BookmarkService.removeBookmark', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes a bookmark for the user (happy path)', async () => {
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            mockBookmark
        );
        (UserBookmarkModel.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: mockBookmark.id
        });
        const input: RemoveBookmarkInput = {
            userId: mockUserId,
            bookmarkId: mockBookmark.id
        };
        const result = await BookmarkService.removeBookmark(input, mockUser);
        expect(result.removed).toBe(true);
        expect(UserBookmarkModel.getById).toHaveBeenCalledWith(mockBookmark.id);
        expect(UserBookmarkModel.delete).toHaveBeenCalledWith(mockBookmark.id, mockUserId);
    });

    it('throws if actor is not the user', async () => {
        const otherUser = getMockUser({ id: 'other-user-id' as UserId });
        const input: RemoveBookmarkInput = {
            userId: mockUserId,
            bookmarkId: mockBookmark.id
        };
        await expect(BookmarkService.removeBookmark(input, otherUser)).rejects.toThrow('Forbidden');
    });

    it('throws if actor is public', async () => {
        const input: RemoveBookmarkInput = {
            userId: mockUserId,
            bookmarkId: mockBookmark.id
        };
        await expect(BookmarkService.removeBookmark(input, publicUser)).rejects.toThrow(
            'Forbidden'
        );
    });

    it('throws if bookmark not found', async () => {
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            undefined
        );
        const input: RemoveBookmarkInput = {
            userId: mockUserId,
            bookmarkId: mockBookmark.id
        };
        await expect(BookmarkService.removeBookmark(input, mockUser)).rejects.toThrow(
            'Bookmark not found'
        );
    });

    it("throws if trying to remove another user's bookmark", async () => {
        const otherBookmark = { ...mockBookmark, userId: 'other-user-id' as UserId };
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            otherBookmark
        );
        const input: RemoveBookmarkInput = {
            userId: mockUserId,
            bookmarkId: mockBookmark.id
        };
        await expect(BookmarkService.removeBookmark(input, mockUser)).rejects.toThrow('Forbidden');
    });

    it('returns removed: false if delete returns undefined', async () => {
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            mockBookmark
        );
        (UserBookmarkModel.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            undefined
        );
        const input: RemoveBookmarkInput = {
            userId: mockUserId,
            bookmarkId: mockBookmark.id
        };
        const result = await BookmarkService.removeBookmark(input, mockUser);
        expect(result.removed).toBe(false);
    });

    it('throws on invalid input (Zod)', async () => {
        const input = { userId: '' as UserId, bookmarkId: '' } as RemoveBookmarkInput;
        await expect(BookmarkService.removeBookmark(input, mockUser)).rejects.toThrow();
    });
});

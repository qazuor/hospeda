import { UserBookmarkModel } from '@repo/db';
import type { UserId } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkRemoveInput } from '../../bookmark/bookmark.schemas';
import { BookmarkService } from '../../bookmark/bookmark.service';
import { getMockUserBookmark } from '../factories/userBookmarkFactory';
import { getMockPublicUser, getMockUser, getMockUserId } from '../factories/userFactory';

const mockUserId: UserId = getMockUserId();
const mockUser = getMockUser({ id: mockUserId });
const mockBookmark = getMockUserBookmark({ userId: mockUserId });
const publicUser = getMockPublicUser();
const testBookmarkId = getMockUserId('test-bookmark-id');
const mockBookmarkWithId = { ...mockBookmark, id: testBookmarkId };
const notFoundBookmarkId = getMockUserId('not-found');

describe('BookmarkService.removeBookmark', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('removes a bookmark for the user (happy path)', async () => {
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            mockBookmarkWithId
        );
        (UserBookmarkModel.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: testBookmarkId
        });
        const input: BookmarkRemoveInput = {
            userId: mockUserId,
            bookmarkId: testBookmarkId
        };
        const result = await BookmarkService.removeBookmark(input, mockUser);
        expect(result.removed).toBe(true);
        expect(UserBookmarkModel.getById).toHaveBeenCalledWith(testBookmarkId);
        expect(UserBookmarkModel.delete).toHaveBeenCalledWith(testBookmarkId, mockUserId);
    });

    it('throws if actor is not the user', async () => {
        const otherUser = getMockUser({ id: getMockUserId('other-user-id') });
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ...mockBookmarkWithId,
            userId: mockUserId
        });
        const input: BookmarkRemoveInput = {
            userId: mockUserId,
            bookmarkId: testBookmarkId
        };
        await expect(BookmarkService.removeBookmark(input, otherUser)).rejects.toThrow('Forbidden');
    });

    it('throws if actor is public', async () => {
        const input: BookmarkRemoveInput = {
            userId: mockUserId,
            bookmarkId: testBookmarkId
        };
        await expect(BookmarkService.removeBookmark(input, publicUser)).rejects.toThrow(
            'Forbidden'
        );
    });

    it('throws if bookmark not found', async () => {
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            undefined
        );
        const input: BookmarkRemoveInput = {
            userId: mockUserId,
            bookmarkId: notFoundBookmarkId
        };
        await expect(BookmarkService.removeBookmark(input, mockUser)).rejects.toThrow(
            'Bookmark not found'
        );
    });

    it("throws if trying to remove another user's bookmark", async () => {
        const otherBookmark = { ...mockBookmarkWithId, userId: getMockUserId('other-user-id') };
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            otherBookmark
        );
        const input: BookmarkRemoveInput = {
            userId: mockUserId,
            bookmarkId: testBookmarkId
        };
        await expect(BookmarkService.removeBookmark(input, mockUser)).rejects.toThrow('Forbidden');
    });

    it('returns removed: false if delete returns undefined', async () => {
        const ownedBookmark = { ...mockBookmarkWithId, userId: mockUserId };
        (UserBookmarkModel.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            ownedBookmark
        );
        (UserBookmarkModel.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            undefined
        );
        const input: BookmarkRemoveInput = {
            userId: mockUserId,
            bookmarkId: testBookmarkId
        };
        const result = await BookmarkService.removeBookmark(input, mockUser);
        expect(result.removed).toBe(false);
    });

    it('throws on invalid input (Zod)', async () => {
        const input = {
            userId: '',
            bookmarkId: ''
        } as BookmarkRemoveInput;
        await expect(BookmarkService.removeBookmark(input, mockUser)).rejects.toThrow();
    });
});

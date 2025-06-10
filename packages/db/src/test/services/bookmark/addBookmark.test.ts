import type { UserId } from '@repo/types/common/id.types';
import { EntityTypeEnum } from '@repo/types/enums/entity-type.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBookmarkModel } from '../../../../src/models/user/user_bookmark.model';
import type { AddBookmarkInput } from '../../../../src/services/bookmark/bookmark.schemas';
import { BookmarkService } from '../../../../src/services/bookmark/bookmark.service';
import { getMockPublicUser, getMockUser, getMockUserBookmark, getMockUserId } from '../../mockData';

vi.mock('../../../../src/models/user/user_bookmark.model');

const mockUser = getMockUser();
const mockUserId: UserId = getMockUserId();
const mockBookmark = getMockUserBookmark();
const publicUser = getMockPublicUser();

describe('BookmarkService.addBookmark', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a bookmark for the user (happy path)', async () => {
        (UserBookmarkModel.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            mockBookmark
        );
        const input: AddBookmarkInput = {
            userId: mockUserId,
            entityId: mockBookmark.entityId,
            entityType: mockBookmark.entityType,
            name: 'My bookmark',
            description: 'A description'
        };
        const result = await BookmarkService.addBookmark(input, mockUser);
        expect(result.bookmark).toEqual(mockBookmark);
        expect(UserBookmarkModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: mockUserId })
        );
    });

    it('throws if actor is not the user', async () => {
        const otherUser = getMockUser({ id: 'other-user-id' as UserId });
        const input: AddBookmarkInput = {
            userId: mockUserId,
            entityId: mockBookmark.entityId,
            entityType: mockBookmark.entityType,
            name: 'My bookmark',
            description: 'A description'
        };
        await expect(BookmarkService.addBookmark(input, otherUser)).rejects.toThrow('Forbidden');
    });

    it('throws if actor is public', async () => {
        const input: AddBookmarkInput = {
            userId: mockUserId,
            entityId: mockBookmark.entityId,
            entityType: mockBookmark.entityType,
            name: 'My bookmark',
            description: 'A description'
        };
        await expect(BookmarkService.addBookmark(input, publicUser)).rejects.toThrow('Forbidden');
    });

    it('throws on invalid input (Zod)', async () => {
        const input = {
            userId: '' as UserId,
            entityId: '' as UserId,
            entityType: EntityTypeEnum.ACCOMMODATION,
            name: ''
        } as AddBookmarkInput;
        await expect(BookmarkService.addBookmark(input, mockUser)).rejects.toThrow();
    });
});

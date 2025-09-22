import { UserBookmarkModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createUserBookmark } from '../../factories/userBookmarkFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.count', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const bookmark = createUserBookmark();

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['count']);
        loggerMock = createLoggerMock();
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
    });

    it('should count bookmarks for a user (success)', async () => {
        asMock(modelMock.count).mockResolvedValue(3);
        const result = await service.countBookmarksForUser(actor, { userId: bookmark.userId });
        expectSuccess(result);
        expect(result.data?.count).toBe(3);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.count).mockRejectedValue(new Error('Database error'));
        const result = await service.countBookmarksForUser(actor, { userId: bookmark.userId });
        expectInternalError(result);
    });
});

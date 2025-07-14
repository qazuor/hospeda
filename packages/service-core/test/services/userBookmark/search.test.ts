import { UserBookmarkModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createUserBookmark } from '../../factories/userBookmarkFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.search', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const bookmark = createUserBookmark();

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
    });

    it('should search bookmarks (success)', async () => {
        asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
        const result = await service.search(actor, { userId: bookmark.userId });
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.items[0]).toEqual(bookmark);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, { userId: bookmark.userId });
        expectInternalError(result);
    });
});

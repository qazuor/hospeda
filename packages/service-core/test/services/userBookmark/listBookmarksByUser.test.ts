import { UserBookmarkModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createUserBookmark } from '../../factories/userBookmarkFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.listBookmarksByUser', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let bookmark: ReturnType<typeof createUserBookmark>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['findAll']);
        loggerMock = createLoggerMock();
        bookmark = createUserBookmark();
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
    });

    it('should list bookmarks for the owner (success)', async () => {
        asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
        const result = await service.listBookmarksByUser(actor, { userId: bookmark.userId });
        expectSuccess(result);
        expect(result.data?.bookmarks).toBeDefined();
        expect(result.data?.bookmarks).toHaveLength(1);
        expect(result.data?.bookmarks?.[0]?.id).toBe(bookmark.id);
    });

    it('should return FORBIDDEN if actor is not the owner', async () => {
        asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
        const otherActor = createActor({
            id: 'not-owner',
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        const result = await service.listBookmarksByUser(otherActor, { userId: bookmark.userId });
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.listBookmarksByUser(actor, { userId: 'not-a-uuid' as any });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.listBookmarksByUser(actor, { userId: bookmark.userId });
        expectInternalError(result);
    });
});

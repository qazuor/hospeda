import { UserBookmarkModel } from '@repo/db';
import { PermissionEnum, type EntityTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createUserBookmark } from '../../factories/userBookmarkFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.countBookmarksForEntity', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let bookmark: ReturnType<typeof createUserBookmark>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['count']);
        loggerMock = createLoggerMock();
        bookmark = createUserBookmark();
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
    });

    it('should count bookmarks for an entity (success)', async () => {
        asMock(modelMock.count).mockResolvedValue(5);
        const result = await service.countBookmarksForEntity(actor, {
            entityId: bookmark.entityId,
            entityType: bookmark.entityType
        });
        expectSuccess(result);
        expect(result.data?.count).toBe(5);
    });

    it('should return FORBIDDEN if actor is missing', async () => {
        asMock(modelMock.count).mockResolvedValue(5);
        // Simula un actor faltante usando null (o un mock explícito si el método lo permite)
        // @ts-expect-error: purposely invalid for forbidden test
        const result = await service.countBookmarksForEntity(undefined, {
            entityId: bookmark.entityId,
            entityType: bookmark.entityType
        });
        expectUnauthorizedError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.countBookmarksForEntity(actor, {
            entityId: 'not-a-uuid',
            entityType: 'INVALID' as EntityTypeEnum
        });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.count).mockRejectedValue(new Error('DB error'));
        const result = await service.countBookmarksForEntity(actor, {
            entityId: bookmark.entityId,
            entityType: bookmark.entityType
        });
        expectInternalError(result);
    });
});

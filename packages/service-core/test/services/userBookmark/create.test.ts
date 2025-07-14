import { UserBookmarkModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createUserBookmark, createUserBookmarkInput } from '../../factories/userBookmarkFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.create', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let bookmark: ReturnType<typeof createUserBookmark>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['create']);
        loggerMock = createLoggerMock();
        bookmark = createUserBookmark();
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
    });

    it('should create a bookmark (success)', async () => {
        asMock(modelMock.create).mockResolvedValue(bookmark);
        const input = createUserBookmarkInput({
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            name: bookmark.name,
            description: bookmark.description
        });
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject({
            entityId: input.entityId,
            entityType: input.entityType,
            name: input.name,
            description: input.description
        });
    });

    it('should return FORBIDDEN if actor lacks USER_BOOKMARK_MANAGE permission', async () => {
        asMock(modelMock.create).mockResolvedValue(bookmark);
        actor = createActor({ id: bookmark.userId, permissions: [] });
        const input = createUserBookmarkInput({
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            name: bookmark.name,
            description: bookmark.description
        });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const { entityId, ...rest } = createUserBookmarkInput({
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            name: bookmark.name,
            description: bookmark.description
        });
        const invalidInput: Partial<ReturnType<typeof createUserBookmarkInput>> = { ...rest };
        const result = await service.create(
            actor,
            invalidInput as ReturnType<typeof createUserBookmarkInput>
        );
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.create).mockRejectedValue(new Error('DB error'));
        const input = createUserBookmarkInput({
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            name: bookmark.name,
            description: bookmark.description
        });
        const result = await service.create(actor, input);
        expectInternalError(result);
    });
});

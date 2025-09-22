import { UserBookmarkModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../../src';
import * as permissions from '../../../src/services/userBookmark/userBookmark.permissions';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { createActor } from '../../factories/actorFactory';
import { createUserBookmark } from '../../factories/userBookmarkFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.softDelete', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let bookmark: ReturnType<typeof createUserBookmark>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        bookmark = createUserBookmark();
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
    });

    it('should soft delete a bookmark (success)', async () => {
        asMock(modelMock.findById).mockResolvedValue(bookmark);
        asMock(modelMock.softDelete).mockResolvedValue({
            ...bookmark,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        });
        const result = await service.softDelete(actor, bookmark.id);
        expectSuccess(result);
        if (result.data && 'lifecycleState' in result.data) {
            expect(result.data.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
        }
    });

    it('should return NOT_FOUND if bookmark does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.softDelete(actor, bookmark.id);
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        asMock(modelMock.findById).mockResolvedValue(bookmark);
        actor = createActor({ id: bookmark.userId, permissions: [] });
        const spy = vi.spyOn(permissions, 'canAccessBookmark').mockImplementation(() => {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'FORBIDDEN: Only owner can access bookmark'
            );
        });
        const result = await service.softDelete(actor, bookmark.id);
        spy.mockRestore();
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findById).mockResolvedValue(bookmark);
        asMock(modelMock.softDelete).mockRejectedValue(new Error('DB error'));
        const result = await service.softDelete(actor, bookmark.id);
        expectInternalError(result);
    });
});

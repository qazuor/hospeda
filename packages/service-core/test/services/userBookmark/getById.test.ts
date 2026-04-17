/**
 * @fileoverview
 * Test suite for UserBookmarkService.getById method.
 * Covers happy path, not-found, permission denied, and internal error scenarios.
 */
import { UserBookmarkModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/userBookmark/userBookmark.permissions';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockUserBookmark } from '../../factories/userBookmarkFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('UserBookmarkService.getById', () => {
    let service: UserBookmarkService;
    let modelMock: UserBookmarkModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const bookmark = createMockUserBookmark();

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkModel, ['findOneWithRelations']);
        loggerMock = createLoggerMock();
        actor = createActor({
            id: bookmark.userId,
            permissions: [PermissionEnum.USER_BOOKMARK_CREATE]
        });
        service = new UserBookmarkService({ logger: loggerMock }, modelMock);
        vi.clearAllMocks();
    });

    it('should return a bookmark by id (success)', async () => {
        asMock(modelMock.findOneWithRelations).mockResolvedValue(bookmark);
        vi.spyOn(permissionHelpers, 'canAccessBookmark').mockReturnValue();

        const result = await service.getById(actor, bookmark.id);

        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(bookmark.id);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOneWithRelations).toHaveBeenCalledWith(
            { id: bookmark.id },
            { user: true },
            undefined
        );
        expect(modelMock.findOne).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND error if bookmark does not exist', async () => {
        asMock(modelMock.findOneWithRelations).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'canAccessBookmark').mockReturnValue();

        const result = await service.getById(actor, bookmark.id);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN error if actor lacks permission', async () => {
        asMock(modelMock.findOneWithRelations).mockResolvedValue(bookmark);
        vi.spyOn(permissionHelpers, 'canAccessBookmark').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });

        const result = await service.getById(actor, bookmark.id);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findOneWithRelations).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'canAccessBookmark').mockReturnValue();

        const result = await service.getById(actor, bookmark.id);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

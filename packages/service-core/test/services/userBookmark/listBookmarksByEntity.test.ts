import { UserBookmarkModel } from '@repo/db';
import { type EntityTypeEnum, PermissionEnum } from '@repo/schemas';
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

describe('UserBookmarkService.listBookmarksByEntity', () => {
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

    it('should list bookmarks for an entity (success)', async () => {
        asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
        const result = await service.listBookmarksByEntity(actor, {
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        expectSuccess(result);
        if (!result.data) throw new Error('Expected data in result');
        expect(result.data?.bookmarks).toBeDefined();
        expect(result.data?.bookmarks).toHaveLength(1);
        expect(result.data?.bookmarks?.[0]?.id).toBe(bookmark.id);
    });

    it('should return UNAUTHORIZED if actor is missing', async () => {
        asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
        const result = await service.listBookmarksByEntity(undefined as never, {
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        expectUnauthorizedError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.listBookmarksByEntity(actor, {
            entityId: 'not-a-uuid',
            entityType: 'INVALID' as EntityTypeEnum,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.listBookmarksByEntity(actor, {
            entityId: bookmark.entityId,
            entityType: bookmark.entityType,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        expectInternalError(result);
    });

    describe('ownership filtering (GAP-037-12)', () => {
        it('should filter by actor userId when actor lacks USER_BOOKMARK_VIEW_ANY', async () => {
            asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
            const regularActor = createActor({
                id: 'regular-user-id',
                permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
            });

            await service.listBookmarksByEntity(regularActor, {
                entityId: bookmark.entityId,
                entityType: bookmark.entityType,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            expect(asMock(modelMock.findAll)).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityId: bookmark.entityId,
                    entityType: bookmark.entityType,
                    deletedAt: null,
                    userId: 'regular-user-id'
                }),
                { page: 1, pageSize: 10 }
            );
        });

        it('should NOT filter by userId when actor has USER_BOOKMARK_VIEW_ANY', async () => {
            asMock(modelMock.findAll).mockResolvedValue({ items: [bookmark], total: 1 });
            const adminActor = createActor({
                id: 'admin-user-id',
                permissions: [
                    PermissionEnum.USER_BOOKMARK_MANAGE,
                    PermissionEnum.USER_BOOKMARK_VIEW_ANY
                ]
            });

            await service.listBookmarksByEntity(adminActor, {
                entityId: bookmark.entityId,
                entityType: bookmark.entityType,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            const callArgs = asMock(modelMock.findAll).mock.calls[0];
            expect(callArgs?.[0]).toEqual({
                entityId: bookmark.entityId,
                entityType: bookmark.entityType,
                deletedAt: null
            });
            expect(callArgs?.[0]).not.toHaveProperty('userId');
        });

        it('should return only actor own bookmarks for entity without VIEW_ANY', async () => {
            const ownBookmark = createUserBookmark({ userId: actor.id });
            asMock(modelMock.findAll).mockResolvedValue({ items: [ownBookmark], total: 1 });

            const result = await service.listBookmarksByEntity(actor, {
                entityId: bookmark.entityId,
                entityType: bookmark.entityType,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            expectSuccess(result);
            expect(result.data?.bookmarks).toHaveLength(1);
            expect(result.data?.bookmarks?.[0]?.userId).toBe(actor.id);
        });
    });
});

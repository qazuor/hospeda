/**
 * userBookmarkCollection.search.test.ts
 *
 * Regression test (HOS-1900): `BaseCrudRead.search` strips `page`/`pageSize`
 * from params and republishes them on `ctx.pagination`, so `_executeSearch`
 * must read pagination from the context.
 */

import { UserBookmarkCollectionModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserBookmarkCollectionService } from '../../../src/services/userBookmarkCollection/userBookmarkCollection.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const OWNER_ID = getMockId('user', 'collection-search-owner');

describe('UserBookmarkCollectionService.search pagination (HOS-1900)', () => {
    let service: UserBookmarkCollectionService;
    let modelMock: UserBookmarkCollectionModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserBookmarkCollectionModel, ['findAll']);
        service = new UserBookmarkCollectionService({ logger: createLoggerMock() }, modelMock);
        actor = createActor({
            id: OWNER_ID,
            permissions: [PermissionEnum.USER_BOOKMARK_MANAGE]
        });
        asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });
    });

    it('forwards page and pageSize from ctx.pagination to the model', async () => {
        // Act
        const result = await service.search(actor, {
            page: 2,
            pageSize: 5,
            userId: OWNER_ID,
            includeBookmarkCount: false
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(asMock(modelMock.findAll).mock.calls[0]?.[1]).toEqual({ page: 2, pageSize: 5 });
    });
});

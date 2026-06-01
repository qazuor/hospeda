import { EntityCommentModel, EventModel, PostModel } from '@repo/db';
import { EntityTypeEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import type { AdminSearchExecuteParams, PaginatedListOutput } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '44444444-4444-4444-8444-444444444444';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

const recentRow = (overrides: Record<string, unknown> = {}) => ({
    id: COMMENT_ID,
    entityType: EntityTypeEnum.POST,
    entityId: POST_ID,
    content: 'A recent comment',
    moderationState: ModerationStatusEnum.APPROVED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    author: { displayName: 'Jane Doe' },
    ...overrides
});

describe('EntityCommentService.listRecent', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        actor = createActor({
            id: ACTOR_ID,
            permissions: [PermissionEnum.POST_COMMENT_VIEW, PermissionEnum.EVENT_COMMENT_VIEW]
        });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            createTypedModelMock(PostModel),
            createTypedModelMock(EventModel)
        );
    });

    it('returns recent items flattened to the fixed feed shape (AC-18)', async () => {
        asMock(modelMock.findAllWithRelations).mockResolvedValue({
            items: [recentRow()],
            total: 1
        });
        const result = await service.listRecent(actor, { pageSize: 10 });
        expectSuccess(result);
        if ('data' in result && result.data) {
            expect(result.data).toEqual([
                {
                    id: COMMENT_ID,
                    entityType: EntityTypeEnum.POST,
                    entityId: POST_ID,
                    content: 'A recent comment',
                    authorName: 'Jane Doe',
                    moderationState: ModerationStatusEnum.APPROVED,
                    createdAt: new Date('2026-01-01T00:00:00.000Z')
                }
            ]);
        }
    });

    it('queries newest-first, excludes soft-deleted, and includes all moderation states', async () => {
        asMock(modelMock.findAllWithRelations).mockResolvedValue({ items: [], total: 0 });
        await service.listRecent(actor, { pageSize: 25 });
        const call = asMock(modelMock.findAllWithRelations).mock.calls[0];
        const where = call?.[1] as Record<string, unknown>;
        const pagination = call?.[2] as Record<string, unknown>;
        // soft-deleted excluded; no moderationState filter (all states included)
        expect(where).toEqual({ deletedAt: null });
        expect(pagination).toMatchObject({
            page: 1,
            pageSize: 25,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        // author relation is loaded for authorName
        expect(call?.[0]).toEqual({ author: true });
    });

    it('falls back to a placeholder when the author is missing', async () => {
        asMock(modelMock.findAllWithRelations).mockResolvedValue({
            items: [
                recentRow({ entityType: EntityTypeEnum.EVENT, entityId: EVENT_ID, author: null })
            ],
            total: 1
        });
        const result = await service.listRecent(actor, { pageSize: 10 });
        expectSuccess(result);
        if ('data' in result && result.data) {
            expect(result.data[0]?.authorName).toBe('[Usuario eliminado]');
            expect(result.data[0]?.entityType).toBe(EntityTypeEnum.EVENT);
        }
    });

    it('defaults pageSize to 10 when omitted', async () => {
        asMock(modelMock.findAllWithRelations).mockResolvedValue({ items: [], total: 0 });
        await service.listRecent(actor, {});
        const pagination = asMock(modelMock.findAllWithRelations).mock.calls[0]?.[2] as Record<
            string,
            unknown
        >;
        expect(pagination.pageSize).toBe(10);
    });

    it('forbids actors missing either comment view permission (defense in depth)', async () => {
        const partialActor = createActor({
            id: ACTOR_ID,
            permissions: [PermissionEnum.POST_COMMENT_VIEW]
        });
        const result = await service.listRecent(partialActor, { pageSize: 10 });
        expectForbiddenError(result);
        expect(asMock(modelMock.findAllWithRelations)).not.toHaveBeenCalled();
    });
});

/**
 * The `_executeAdminSearch` override exists so a stray `?status` admin filter
 * cannot inject `where.lifecycleState` (a column `entity_comments` lacks).
 * Invoked directly: `adminList` assembles the where (including the offending
 * key) before delegating here, so this is the exact seam under test (AC-17).
 */
type AdminSearchExecutor = {
    _executeAdminSearch(params: AdminSearchExecuteParams): Promise<PaginatedListOutput<unknown>>;
};

describe('EntityCommentService._executeAdminSearch (lifecycleState guard)', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        actor = createActor({
            id: ACTOR_ID,
            permissions: [PermissionEnum.POST_COMMENT_VIEW, PermissionEnum.EVENT_COMMENT_VIEW]
        });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            createTypedModelMock(PostModel),
            createTypedModelMock(EventModel)
        );
        asMock(modelMock.findAllWithRelations).mockResolvedValue({ items: [], total: 0 });
    });

    it('strips lifecycleState before delegating to the model', async () => {
        const executor = service as unknown as AdminSearchExecutor;
        await executor._executeAdminSearch({
            where: { lifecycleState: 'ACTIVE', deletedAt: null },
            entityFilters: {},
            pagination: { page: 1, pageSize: 10 },
            sort: { sortBy: 'createdAt', sortOrder: 'desc' },
            actor
        });
        const where = asMock(modelMock.findAllWithRelations).mock.calls[0]?.[1] as Record<
            string,
            unknown
        >;
        expect(where.lifecycleState).toBeUndefined();
        expect(where).toMatchObject({ deletedAt: null });
        // author relation still loaded by the base implementation
        expect(asMock(modelMock.findAllWithRelations).mock.calls[0]?.[0]).toEqual({ author: true });
    });
});

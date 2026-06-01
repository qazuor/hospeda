import { EntityCommentModel, EventModel, PostModel } from '@repo/db';
import { EntityTypeEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import { createActor } from '../../factories/actorFactory';
import { expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

describe('EntityCommentService.listPublic', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let postModelMock: PostModel;
    let eventModelMock: EventModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        postModelMock = createTypedModelMock(PostModel);
        eventModelMock = createTypedModelMock(EventModel);
        // guest actor (public tier): valid id, no permissions
        actor = createActor({ id: ACTOR_ID, permissions: [] });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            postModelMock,
            eventModelMock
        );
    });

    it('returns an empty page for a published post with no approved comments (AC-10)', async () => {
        asMock(postModelMock.findById).mockResolvedValue({
            id: POST_ID,
            deletedAt: null,
            visibility: VisibilityEnum.PUBLIC
        });
        asMock(modelMock.findAllWithRelations).mockResolvedValue({ items: [], total: 0 });
        const result = await service.listPublic(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID
        });
        expectSuccess(result);
        if ('data' in result && result.data) {
            expect(result.data.items).toEqual([]);
            expect(result.data.total).toBe(0);
        }
        // only APPROVED, non-deleted comments are queried
        const where = asMock(modelMock.findAllWithRelations).mock.calls[0]?.[1] as Record<
            string,
            unknown
        >;
        expect(where).toMatchObject({ moderationState: 'APPROVED', deletedAt: null });
    });

    it('returns NOT_FOUND when the post is not published (AC-9)', async () => {
        asMock(postModelMock.findById).mockResolvedValue({
            id: POST_ID,
            deletedAt: null,
            visibility: VisibilityEnum.PRIVATE
        });
        const result = await service.listPublic(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID
        });
        expectNotFoundError(result);
        expect(asMock(modelMock.findAllWithRelations)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when the post does not exist', async () => {
        asMock(postModelMock.findById).mockResolvedValue(null);
        const result = await service.listPublic(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID
        });
        expectNotFoundError(result);
    });

    it('resolves the published check against the event model for EVENT comments', async () => {
        asMock(eventModelMock.findById).mockResolvedValue({
            id: EVENT_ID,
            deletedAt: null,
            visibility: VisibilityEnum.PUBLIC
        });
        asMock(modelMock.findAllWithRelations).mockResolvedValue({ items: [], total: 0 });
        const result = await service.listPublic(actor, {
            entityType: EntityTypeEnum.EVENT,
            entityId: EVENT_ID
        });
        expectSuccess(result);
        expect(asMock(eventModelMock.findById)).toHaveBeenCalledWith(EVENT_ID, undefined);
        const where = asMock(modelMock.findAllWithRelations).mock.calls[0]?.[1] as Record<
            string,
            unknown
        >;
        expect(where).toMatchObject({ entityType: EntityTypeEnum.EVENT, entityId: EVENT_ID });
    });
});

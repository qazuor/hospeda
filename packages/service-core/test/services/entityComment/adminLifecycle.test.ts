import { EntityCommentModel, PostModel } from '@repo/db';
import { EntityTypeEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import { createActor } from '../../factories/actorFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const COMMENT_ID = '44444444-4444-4444-8444-444444444444';

function makeComment(overrides: Record<string, unknown> = {}) {
    return {
        id: COMMENT_ID,
        entityType: EntityTypeEnum.POST,
        entityId: POST_ID,
        authorId: ACTOR_ID,
        content: 'A comment',
        moderationState: ModerationStatusEnum.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: ACTOR_ID,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

describe('EntityCommentService admin delete/restore counter sync', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let postModelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        postModelMock = createTypedModelMock(PostModel);
        actor = createActor({
            id: ACTOR_ID,
            permissions: [PermissionEnum.POST_COMMENT_MODERATE]
        });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            postModelMock
        );
        asMock(modelMock.softDelete).mockResolvedValue(1);
        asMock(modelMock.hardDelete).mockResolvedValue(1);
        asMock(modelMock.restore).mockResolvedValue(1);
    });

    it('admin softDelete of an APPROVED post comment decrements the counter (AC-21)', async () => {
        asMock(modelMock.findById).mockResolvedValue(makeComment());
        const result = await service.softDelete(actor, COMMENT_ID);
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: -1 },
            undefined
        );
    });

    it('hardDelete of an APPROVED post comment decrements the counter (AC-22)', async () => {
        asMock(modelMock.findById).mockResolvedValue(makeComment());
        const result = await service.hardDelete(actor, COMMENT_ID);
        expectSuccess(result);
        expect(asMock(modelMock.hardDelete)).toHaveBeenCalled();
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: -1 },
            undefined
        );
    });

    it('restore of a soft-deleted APPROVED post comment increments the counter (AC-23)', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ deletedAt: new Date(), deletedById: ACTOR_ID })
        );
        const result = await service.restore(actor, COMMENT_ID);
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: 1 },
            undefined
        );
    });

    it('hardDelete of a REJECTED comment does not adjust the counter', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ moderationState: ModerationStatusEnum.REJECTED })
        );
        const result = await service.hardDelete(actor, COMMENT_ID);
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });

    it('admin softDelete of a REJECTED comment does not adjust the counter', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ moderationState: ModerationStatusEnum.REJECTED })
        );
        const result = await service.softDelete(actor, COMMENT_ID);
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });

    it('restore of a REJECTED comment does not adjust the counter', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ moderationState: ModerationStatusEnum.REJECTED, deletedAt: new Date() })
        );
        const result = await service.restore(actor, COMMENT_ID);
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });
});

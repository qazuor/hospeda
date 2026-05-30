import { EntityCommentModel, PostModel } from '@repo/db';
import { EntityTypeEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import { createActor } from '../../factories/actorFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const AUTHOR_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const COMMENT_ID = '44444444-4444-4444-8444-444444444444';

function makeComment(overrides: Record<string, unknown> = {}) {
    return {
        id: COMMENT_ID,
        entityType: EntityTypeEnum.POST,
        entityId: POST_ID,
        authorId: AUTHOR_ID,
        content: 'A valid comment',
        moderationState: ModerationStatusEnum.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: AUTHOR_ID,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

describe('EntityCommentService.softDeleteOwn', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let postModelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        postModelMock = createTypedModelMock(PostModel);
        actor = createActor({ id: AUTHOR_ID, permissions: [PermissionEnum.POST_COMMENT_CREATE] });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            postModelMock
        );
        asMock(modelMock.softDelete).mockResolvedValue(1);
        asMock(modelMock.updateById).mockResolvedValue(undefined);
    });

    it('lets the author soft-delete their APPROVED post comment and decrements the counter (AC-15)', async () => {
        asMock(modelMock.findById).mockResolvedValue(makeComment());
        const result = await service.softDeleteOwn(actor, { commentId: COMMENT_ID });
        expectSuccess(result);
        expect(asMock(modelMock.softDelete)).toHaveBeenCalledWith({ id: COMMENT_ID }, undefined);
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: -1 },
            undefined
        );
    });

    it('returns FORBIDDEN when the actor is not the author (AC-16)', async () => {
        asMock(modelMock.findById).mockResolvedValue(makeComment({ authorId: OTHER_USER_ID }));
        const result = await service.softDeleteOwn(actor, { commentId: COMMENT_ID });
        expectForbiddenError(result);
        expect(asMock(modelMock.softDelete)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when the comment does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const result = await service.softDeleteOwn(actor, { commentId: COMMENT_ID });
        expectNotFoundError(result);
        expect(asMock(modelMock.softDelete)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when the comment is already soft-deleted', async () => {
        asMock(modelMock.findById).mockResolvedValue(makeComment({ deletedAt: new Date() }));
        const result = await service.softDeleteOwn(actor, { commentId: COMMENT_ID });
        expectNotFoundError(result);
        expect(asMock(modelMock.softDelete)).not.toHaveBeenCalled();
    });

    it('does NOT adjust the counter when deleting an EVENT comment (AC-26)', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ entityType: EntityTypeEnum.EVENT, entityId: EVENT_ID })
        );
        const result = await service.softDeleteOwn(actor, { commentId: COMMENT_ID });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });

    it('does NOT adjust the counter when the deleted post comment was already REJECTED', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ moderationState: ModerationStatusEnum.REJECTED })
        );
        const result = await service.softDeleteOwn(actor, { commentId: COMMENT_ID });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });
});

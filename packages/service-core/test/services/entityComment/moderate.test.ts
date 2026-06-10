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

describe('EntityCommentService.moderate', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let postModelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        postModelMock = createTypedModelMock(PostModel);
        actor = createActor({
            id: ACTOR_ID,
            permissions: [
                PermissionEnum.POST_COMMENT_MODERATE,
                PermissionEnum.EVENT_COMMENT_MODERATE
            ]
        });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            postModelMock
        );
        asMock(modelMock.updateById).mockResolvedValue(undefined);
    });

    it('APPROVED → REJECTED decrements the post counter by 1 (AC-19)', async () => {
        asMock(modelMock.findById)
            .mockResolvedValueOnce(makeComment({ moderationState: ModerationStatusEnum.APPROVED }))
            .mockResolvedValueOnce(makeComment({ moderationState: ModerationStatusEnum.REJECTED }));
        const result = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'REJECTED'
        });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: -1 },
            undefined
        );
    });

    it('REJECTED → APPROVED increments the post counter by 1 (AC-20)', async () => {
        asMock(modelMock.findById)
            .mockResolvedValueOnce(makeComment({ moderationState: ModerationStatusEnum.REJECTED }))
            .mockResolvedValueOnce(makeComment({ moderationState: ModerationStatusEnum.APPROVED }));
        const result = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'APPROVED'
        });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: 1 },
            undefined
        );
    });

    it('does not adjust the counter when the state is unchanged (delta 0)', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ moderationState: ModerationStatusEnum.APPROVED })
        );
        const result = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'APPROVED'
        });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });

    it('does not touch any counter for an EVENT comment (AC-26)', async () => {
        asMock(modelMock.findById).mockResolvedValue(
            makeComment({ entityType: EntityTypeEnum.EVENT, entityId: EVENT_ID })
        );
        const result = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'REJECTED'
        });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for a missing or soft-deleted comment', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const missing = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'REJECTED'
        });
        expectNotFoundError(missing);

        asMock(modelMock.findById).mockResolvedValue(makeComment({ deletedAt: new Date() }));
        const deleted = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'REJECTED'
        });
        expectNotFoundError(deleted);
    });

    it('returns FORBIDDEN when the actor lacks the moderate permission', async () => {
        actor = createActor({ id: ACTOR_ID, permissions: [] });
        asMock(modelMock.findById).mockResolvedValue(makeComment());
        const result = await service.moderate(actor, {
            commentId: COMMENT_ID,
            moderationState: 'REJECTED'
        });
        expectForbiddenError(result);
        expect(asMock(modelMock.updateById)).not.toHaveBeenCalled();
    });
});
